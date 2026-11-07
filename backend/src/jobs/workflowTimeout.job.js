// Owner: Josh
// Purpose:
// Scheduled periodic workflow timeout check detecting stalled order assignments, stalled quality checks, and unassigned received orders.
//
// Rules:
// - Finds orders assigned to an attendant but not accepted within STALLED_ASSIGNMENT_MINUTES.
// - Finds orders sitting in quality_check longer than STALLED_QC_MINUTES (using workflow step completed_at).
// - Finds orders in received state with no assigned attendant older than STALLED_ASSIGNMENT_MINUTES.
// - Ignores orders older than STALLED_MAX_AGE_HOURS and clears their is_stalled flag.
// - Alerts branch manager and front desk (for stalled assignment and stalled QC) or manager (for unassigned).
// - Sends one summary notification per recipient per run when there are > 3 new stalls; keeps individual alerts for <= 3.
// - Deduplicates alerts by order_id and recipient regardless of read state; re-alerts only after STALLED_REALERT_HOURS.
// - Sets order.is_stalled and order.stalled_reason for stalled orders; clears it when orders are no longer stalled.
// - Excludes finished orders (cancelled, delivered, sent_out, ready).
// - Prevents overlapping runs and never crashes the server on database failures.

import cron from 'node-cron';
import Order from '../models/order.model.js';
import ProcessingWorkflow from '../models/processingWorkflow.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import createNotification from '../services/notification.service.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';
import {
  STALLED_ALERT_PREFIX,
  STALLED_REASONS,
} from '../constants/workflowTimeout.constants.js';

const TERMINAL_STATUSES = ['cancelled', 'delivered', 'sent_out', 'ready'];

/**
 * Checks all active orders and workflows for timeouts and sends alerts to branch staff.
 */
export async function runWorkflowTimeoutCheck({
  now = new Date(),
  assignmentThresholdMinutes,
  qcThresholdMinutes,
  realertHours,
  maxAgeHours,
} = {}) {
  const assignmentMinutes =
    assignmentThresholdMinutes !== undefined
      ? assignmentThresholdMinutes
      : env.stalledAssignmentMinutes || 30;
  const qcMinutes =
    qcThresholdMinutes !== undefined
      ? qcThresholdMinutes
      : env.stalledQcMinutes || 60;
  const realertHoursVal =
    realertHours !== undefined
      ? realertHours
      : env.stalledRealertHours || 4;
  const maxAgeHoursVal =
    maxAgeHours !== undefined
      ? maxAgeHours
      : env.stalledMaxAgeHours || 72;

  const assignmentThresholdMs = assignmentMinutes * 60 * 1000;
  const qcThresholdMs = qcMinutes * 60 * 1000;
  const realertCutoffMs = realertHoursVal * 60 * 60 * 1000;
  const realertCutoff = new Date(now.getTime() - realertCutoffMs);
  const maxAgeMs = maxAgeHoursVal * 60 * 60 * 1000;
  const maxAgeCutoff = new Date(now.getTime() - maxAgeMs);
  const escapedPrefix = STALLED_ALERT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const stalledOrderIds = new Set();
  const stalledItems = []; // { orderId, branchId, reference, reason, stalledAt, message, targetRoles }

  try {
    logger.info('🔄 Running workflow timeout and stalled order check...');

    // 1. Fetch active workflows with non-completed steps
    const activeWorkflows = await ProcessingWorkflow.find({
      status: 'active',
    })
      .populate('order_id', '_id status branch_id createdAt updatedAt is_stalled')
      .lean();

    for (const wf of activeWorkflows) {
      const order = wf.order_id;
      if (!order || TERMINAL_STATUSES.includes(order.status)) continue;
      if (order.createdAt && new Date(order.createdAt).getTime() < maxAgeCutoff.getTime()) {
        continue;
      }

      const activeStep = (wf.steps || []).find((s) => s.status !== 'completed');
      if (activeStep && activeStep.status === 'assigned') {
        const assignedAt = activeStep.assigned_at
          ? new Date(activeStep.assigned_at)
          : new Date(activeStep.createdAt || wf.createdAt || order.createdAt || now);
        const elapsed = now.getTime() - assignedAt.getTime();

        if (elapsed >= assignmentThresholdMs) {
          const ref = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
          const stalledAt = new Date(assignedAt.getTime() + assignmentThresholdMs);
          stalledOrderIds.add(order._id.toString());
          stalledItems.push({
            orderId: order._id,
            branchId: order.branch_id || wf.branch_id,
            reference: ref,
            reason: STALLED_REASONS.ASSIGNMENT,
            stalledAt,
            message: `${STALLED_ALERT_PREFIX} Order ${ref} has been assigned for over ${assignmentMinutes} minutes without being accepted by the attendant. Please review and reassign if necessary.`,
            targetRoles: ['branch_manager', 'front_desk'],
          });
        }
      }
    }

    // 2. Fetch orders in quality_check
    const qcOrders = await Order.find({
      status: 'quality_check',
      createdAt: { $gte: maxAgeCutoff },
    })
      .select('_id branch_id createdAt updatedAt is_stalled')
      .lean();

    for (const order of qcOrders) {
      if (stalledOrderIds.has(order._id.toString())) continue;
      if (order.createdAt && new Date(order.createdAt).getTime() < maxAgeCutoff.getTime()) {
        continue;
      }

      // Use the workflow step's completed_at to measure time spent in quality_check
      const workflow = await ProcessingWorkflow.findOne({
        order_id: order._id,
      })
        .sort({ cycle: -1 })
        .lean();

      let enteredQcAt = null;
      if (workflow && Array.isArray(workflow.steps)) {
        const lastCompletedStep = [...workflow.steps]
          .reverse()
          .find((s) => s.status === 'completed' && s.completed_at);
        if (lastCompletedStep?.completed_at) {
          enteredQcAt = new Date(lastCompletedStep.completed_at);
        } else if (workflow.updatedAt) {
          enteredQcAt = new Date(workflow.updatedAt);
        }
      }

      if (!enteredQcAt && order.updatedAt) {
        enteredQcAt = new Date(order.updatedAt);
      }

      if (enteredQcAt) {
        const elapsed = now.getTime() - enteredQcAt.getTime();
        if (elapsed >= qcThresholdMs) {
          const ref = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
          const stalledAt = new Date(enteredQcAt.getTime() + qcThresholdMs);
          stalledOrderIds.add(order._id.toString());
          stalledItems.push({
            orderId: order._id,
            branchId: order.branch_id,
            reference: ref,
            reason: STALLED_REASONS.QUALITY_CHECK,
            stalledAt,
            message: `${STALLED_ALERT_PREFIX} Order ${ref} has been in quality check for over ${qcMinutes} minutes. Please complete the review.`,
            targetRoles: ['branch_manager', 'front_desk'],
          });
        }
      }
    }

    // 3. Fetch unassigned received orders older than STALLED_ASSIGNMENT_MINUTES but within max age
    const unassignedReceivedCutoff = new Date(
      now.getTime() - assignmentThresholdMs,
    );
    const unassignedOrders = await Order.find({
      status: 'received',
      createdAt: { $lte: unassignedReceivedCutoff, $gte: maxAgeCutoff },
    })
      .select('_id branch_id createdAt updatedAt is_stalled')
      .lean();

    for (const order of unassignedOrders) {
      if (stalledOrderIds.has(order._id.toString())) continue;
      if (order.createdAt && new Date(order.createdAt).getTime() < maxAgeCutoff.getTime()) {
        continue;
      }

      const workflow = await ProcessingWorkflow.findOne({
        order_id: order._id,
        status: 'active',
      }).lean();

      const hasAttendant = (workflow?.steps || []).some(
        (s) => s.employee_id && s.status !== 'completed',
      );

      if (!workflow || !hasAttendant) {
        const ref = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
        const createdAt = order.createdAt ? new Date(order.createdAt) : now;
        const stalledAt = new Date(createdAt.getTime() + assignmentThresholdMs);
        stalledOrderIds.add(order._id.toString());
        stalledItems.push({
          orderId: order._id,
          branchId: order.branch_id,
          reference: ref,
          reason: STALLED_REASONS.UNASSIGNED,
          stalledAt,
          message: `${STALLED_ALERT_PREFIX} Order ${ref} has been received for over ${assignmentMinutes} minutes without an assigned attendant. Please assign an attendant manually.`,
          targetRoles: ['branch_manager'],
        });
      }
    }

    // 4. Update order is_stalled flag for stalled orders
    for (const item of stalledItems) {
      await Order.updateOne(
        { _id: item.orderId },
        {
          $set: {
            is_stalled: true,
            stalled_reason: item.reason,
          },
        },
      ).catch((err) =>
        logger.error('Failed to update is_stalled for order:', {
          orderId: String(item.orderId),
          error: err.message,
        }),
      );
    }

    // 5. Clear is_stalled flag for orders that are no longer stalled, terminal, or exceed max age
    const clearResult = await Order.updateMany(
      {
        $or: [
          {
            _id: { $nin: Array.from(stalledOrderIds) },
            is_stalled: true,
          },
          {
            status: { $in: TERMINAL_STATUSES },
            is_stalled: true,
          },
          {
            createdAt: { $lt: maxAgeCutoff },
            is_stalled: true,
          },
        ],
      },
      {
        $set: {
          is_stalled: false,
          stalled_reason: null,
        },
      },
    ).catch(() => ({ modifiedCount: 0 }));

    // 6. Send alerts with deduplication window and summary grouping (> 3)
    let notificationsSent = 0;
    const branchIds = [...new Set(stalledItems.map((i) => i.branchId?.toString()).filter(Boolean))];

    if (branchIds.length > 0) {
      // Find staff across affected branches
      const branchEmployees = await Employee.find({
        branch_id: { $in: branchIds },
        is_active: true,
      }).select('user_id branch_id').lean();

      const userIds = branchEmployees.map((e) => e.user_id);
      const activeUsers = await User.find({
        _id: { $in: userIds },
        role: { $in: ['branch_manager', 'front_desk'] },
        is_active: true,
      }).select('_id role').lean();

      const roleByUserId = new Map(activeUsers.map((u) => [u._id.toString(), u.role]));
      const staffByBranch = new Map();

      for (const emp of branchEmployees) {
        const uId = emp.user_id.toString();
        const role = roleByUserId.get(uId);
        if (role) {
          const bId = emp.branch_id.toString();
          if (!staffByBranch.has(bId)) staffByBranch.set(bId, []);
          staffByBranch.get(bId).push({ _id: emp.user_id, role });
        }
      }

      for (const [bId, branchStaff] of staffByBranch.entries()) {
        const uniqueRecipients = Array.from(
          new Map(branchStaff.map((s) => [s._id.toString(), s])).values(),
        );

        for (const recipient of uniqueRecipients) {
          const rIdStr = recipient._id.toString();
          const recipientItems = stalledItems.filter(
            (item) =>
              item.branchId?.toString() === bId &&
              item.targetRoles.includes(recipient.role),
          );

          if (recipientItems.length === 0) continue;

          // Check if recipient received a summary alert within the realert window
          let latestSummaryAlert = null;
          try {
            const query = Notification.findOne({
              user_id: recipient._id,
              type: 'other',
              message: { $regex: new RegExp(`^${escapedPrefix}.*orders need attention:`) },
              createdAt: { $gte: realertCutoff },
            });
            latestSummaryAlert =
              typeof query?.sort === 'function'
                ? await query.sort({ createdAt: -1 })
                : await query;
          } catch {
            latestSummaryAlert = null;
          }

          const summaryTime = latestSummaryAlert
            ? new Date(
                latestSummaryAlert.createdAt ||
                  latestSummaryAlert.sent_at ||
                  Date.now(),
              ).getTime()
            : null;

          // Filter to new stalls for this recipient
          const newItemsForRecipient = [];
          for (const item of recipientItems) {
            // Already covered by a recent summary alert sent after this stall occurred
            if (
              summaryTime !== null &&
              item.stalledAt &&
              item.stalledAt.getTime() <= summaryTime
            ) {
              continue;
            }

            // Check if this specific order had an individual alert within realertCutoff
            let recentIndividualAlert = null;
            try {
              recentIndividualAlert = await Notification.findOne({
                user_id: recipient._id,
                order_id: item.orderId,
                type: 'other',
                message: { $regex: new RegExp(`^${escapedPrefix}`) },
                createdAt: { $gte: realertCutoff },
              });
            } catch {
              recentIndividualAlert = null;
            }

            if (recentIndividualAlert) {
              continue;
            }

            newItemsForRecipient.push(item);
          }

          if (newItemsForRecipient.length === 0) {
            continue;
          }

          // If more than 3 new stalls, send one summary notification per recipient per run
          if (newItemsForRecipient.length > 3) {
            const total = newItemsForRecipient.length;
            const x = newItemsForRecipient.filter(
              (i) => i.reason === STALLED_REASONS.ASSIGNMENT,
            ).length;
            const y = newItemsForRecipient.filter(
              (i) => i.reason === STALLED_REASONS.QUALITY_CHECK,
            ).length;
            const z = newItemsForRecipient.filter(
              (i) => i.reason === STALLED_REASONS.UNASSIGNED,
            ).length;

            const summaryMessage = `${STALLED_ALERT_PREFIX} ${total} orders need attention: ${x} not accepted, ${y} awaiting quality check, ${z} unassigned`;

            try {
              await createNotification({
                user_id: recipient._id,
                type: 'other',
                message: summaryMessage,
              });
              notificationsSent++;
            } catch (err) {
              logger.error('Failed to send summary stalled alert to staff:', {
                userId: rIdStr,
                error: err.message,
              });
            }
          } else {
            // 3 or fewer new stalls: send individual alerts
            for (const item of newItemsForRecipient) {
              try {
                await createNotification({
                  user_id: recipient._id,
                  order_id: item.orderId,
                  type: 'other',
                  message: item.message,
                });
                notificationsSent++;
              } catch (notifErr) {
                logger.error('Failed to notify staff of stalled order:', {
                  orderId: String(item.orderId),
                  userId: rIdStr,
                  error: notifErr.message,
                });
              }
            }
          }
        }
      }
    }

    const summary = {
      stalledAssignments: stalledItems.filter((i) => i.reason === STALLED_REASONS.ASSIGNMENT).length,
      stalledQc: stalledItems.filter((i) => i.reason === STALLED_REASONS.QUALITY_CHECK).length,
      unassignedReceived: stalledItems.filter((i) => i.reason === STALLED_REASONS.UNASSIGNED).length,
      notificationsSent,
      clearedCount: clearResult?.modifiedCount || 0,
    };

    logger.info('✅ Workflow timeout check completed:', summary);
    return summary;
  } catch (error) {
    logger.error('❌ Error during workflow timeout check:', { error: error.message });
    return {
      stalledAssignments: 0,
      stalledQc: 0,
      unassignedReceived: 0,
      notificationsSent: 0,
      clearedCount: 0,
      error: error.message,
    };
  }
}

let isRunning = false;

/**
 * Starts the scheduled cron job for workflow timeouts.
 */
export function startWorkflowTimeoutJob() {
  const schedule = env.workflowTimeoutSchedule || '*/10 * * * *';
  logger.info(`📅 Scheduling Workflow Timeout cron job with schedule: "${schedule}"`);

  const task = cron.schedule(
    schedule,
    async () => {
      if (isRunning) {
        logger.warn('⚠️ Workflow timeout job is already running; skipping overlapping execution.');
        return;
      }
      isRunning = true;
      try {
        await runWorkflowTimeoutCheck();
      } catch (err) {
        logger.error('Unhandled error in workflow timeout job execution:', { error: err.message });
      } finally {
        isRunning = false;
      }
    },
    {
      timezone: 'Africa/Lagos',
    },
  );

  return task;
}
