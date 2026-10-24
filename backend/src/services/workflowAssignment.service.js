// Owner: Josh
// Purpose: Auto-assignment service for single processing workflows based on branch, leave, and workload.

import Employee from '../models/employee.model.js';
import LeaveRequest from '../models/leaveRequest.model.js';
import Order from '../models/order.model.js';
import ProcessingWorkflow from '../models/processingWorkflow.model.js';
import createNotification from './notification.service.js';

export const MAX_ACTIVE_ORDERS_PER_EMPLOYEE = 5;
export const NON_ACTIVE_ORDER_STATUSES = [
  'ready',
  'sent_out',
  'delivered',
  'cancelled',
];

// Count active orders currently assigned to an employee
export async function countActiveOrdersForEmployee(employeeId) {
  const orderIds = await ProcessingWorkflow.find({
    'steps.employee_id': employeeId,
  }).distinct('order_id');

  if (!orderIds.length) return 0;

  return Order.countDocuments({
    _id: { $in: orderIds },
    status: { $nin: NON_ACTIVE_ORDER_STATUSES },
  });
}

// Get timestamp of the employee's last assigned task (or 0 if never assigned)
export async function getLastAssignmentTime(employeeId) {
  const latestWf = await ProcessingWorkflow.findOne({
    'steps.employee_id': employeeId,
  })
    .sort({ createdAt: -1 })
    .select('createdAt steps');

  if (!latestWf) return 0;

  const step = latestWf.steps.find(
    (s) => s.employee_id && s.employee_id.toString() === employeeId.toString(),
  );
  if (step?.createdAt) {
    return new Date(step.createdAt).getTime();
  }
  return new Date(latestWf.createdAt).getTime();
}

// Find the best available attendant for an order
export async function findBestAttendantForOrder({ order, windowStart, windowEnd }) {
  const wStart = windowStart || order.received_at || new Date();
  const wEnd =
    windowEnd ||
    (order.delivery_time
      ? new Date(order.delivery_time)
      : new Date(
          Date.now() +
            (order.fulfillment?.turnaround_hours || 24) * 60 * 60 * 1000,
        ));

  // 1. Fetch active employees at order's branch with role 'employee' (attendant)
  const branchEmployees = await Employee.find({
    branch_id: order.branch_id,
    is_active: true,
  }).populate({
    path: 'user_id',
    select: '_id name email role is_active',
  });

  const attendants = branchEmployees.filter(
    (emp) =>
      emp.user_id &&
      emp.user_id.is_active &&
      emp.user_id.role === 'employee',
  );

  if (!attendants.length) return null;

  // 2. Filter out attendants with approved leave overlapping order window
  const attendantEmpIds = attendants.map((a) => a._id);
  const overlappingLeaves = await LeaveRequest.find({
    employee_id: { $in: attendantEmpIds },
    status: 'approved',
    start_date: { $lte: wEnd },
    end_date: { $gte: wStart },
  }).select('employee_id');

  const onLeaveEmpIdSet = new Set(
    overlappingLeaves.map((l) => l.employee_id.toString()),
  );
  const availableAttendants = attendants.filter(
    (a) => !onLeaveEmpIdSet.has(a._id.toString()),
  );

  if (!availableAttendants.length) return null;

  // 3. Check workload cap (< 5 active orders) and load
  const candidateScores = [];
  for (const attendant of availableAttendants) {
    const activeCount = await countActiveOrdersForEmployee(attendant._id);
    if (activeCount < MAX_ACTIVE_ORDERS_PER_EMPLOYEE) {
      const lastAssignedTime = await getLastAssignmentTime(attendant._id);
      candidateScores.push({
        attendant,
        activeCount,
        lastAssignedTime,
      });
    }
  }

  if (!candidateScores.length) return null;

  // 4. Sort: lightest load first; ties broken by oldest last assignment
  candidateScores.sort((a, b) => {
    if (a.activeCount !== b.activeCount) {
      return a.activeCount - b.activeCount;
    }
    return a.lastAssignedTime - b.lastAssignedTime;
  });

  return candidateScores[0].attendant;
}

// Auto-assign order upon receipt
export async function autoAssignProcessingWorkflow({ order, createdByUserId }) {
  const bestAttendant = await findBestAttendantForOrder({ order });

  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;

  if (!bestAttendant) {
    // Keep order in received; notify branch manager
    const managers = await Employee.find({
      branch_id: order.branch_id,
      is_active: true,
    }).populate({
      path: 'user_id',
      match: { role: 'branch_manager', is_active: true },
      select: '_id',
    });

    const validManagers = managers.filter((m) => m.user_id);
    await Promise.all(
      validManagers.map((m) =>
        createNotification({
          user_id: m.user_id._id,
          order_id: order._id,
          type: 'other',
          message: `No attendants are currently available to process order ${reference}. Please reassign manually when available.`,
        }),
      ),
    );

    return { assigned: false, workflow: null };
  }

  // Create single processing workflow
  const previous = await ProcessingWorkflow.findOne({ order_id: order._id }).sort({
    cycle: -1,
  });

  const workflow = await ProcessingWorkflow.create({
    order_id: order._id,
    branch_id: order.branch_id,
    cycle: (previous?.cycle ?? 0) + 1,
    created_by: createdByUserId || order.customer_id,
    steps: [
      {
        name: 'processing',
        sequence: 1,
        employee_id: bestAttendant._id,
        status: 'assigned',
      },
    ],
  });

  // Notify the assigned attendant
  const attendantUserId = bestAttendant.user_id._id || bestAttendant.user_id;
  await createNotification({
    user_id: attendantUserId,
    order_id: order._id,
    type: 'task_assigned',
    message: `You were assigned “processing” for ${reference}.`,
  });

  return { assigned: true, workflow, attendant: bestAttendant };
}

// Get workload and eligibility of all attendants for a branch
export async function getBranchAttendantsAvailability({ branch_id, order }) {
  const wStart = order?.received_at || new Date();
  const wEnd =
    order?.delivery_time
      ? new Date(order.delivery_time)
      : new Date(
          Date.now() +
            (order?.fulfillment?.turnaround_hours || 24) * 60 * 60 * 1000,
        );

  const branchEmployees = await Employee.find({
    branch_id,
    is_active: true,
  }).populate({
    path: 'user_id',
    select: '_id name email role is_active',
  });

  const attendants = branchEmployees.filter(
    (emp) =>
      emp.user_id &&
      emp.user_id.is_active &&
      emp.user_id.role === 'employee',
  );

  const attendantEmpIds = attendants.map((a) => a._id);
  const overlappingLeaves = await LeaveRequest.find({
    employee_id: { $in: attendantEmpIds },
    status: 'approved',
    start_date: { $lte: wEnd },
    end_date: { $gte: wStart },
  }).select('employee_id');

  const onLeaveEmpIdSet = new Set(
    overlappingLeaves.map((l) => l.employee_id.toString()),
  );

  const results = [];
  for (const attendant of attendants) {
    const activeCount = await countActiveOrdersForEmployee(attendant._id);
    const onLeave = onLeaveEmpIdSet.has(attendant._id.toString());
    const atCap = activeCount >= MAX_ACTIVE_ORDERS_PER_EMPLOYEE;
    const eligible = !onLeave && !atCap;

    let reason = 'Available';
    if (onLeave) reason = 'On approved leave';
    else if (atCap) reason = `At capacity (${activeCount}/${MAX_ACTIVE_ORDERS_PER_EMPLOYEE} active orders)`;

    results.push({
      employee_id: attendant._id,
      user_id: attendant.user_id._id,
      name: attendant.user_id.name,
      email: attendant.user_id.email,
      job_title: attendant.job_title,
      active_orders_count: activeCount,
      max_orders: MAX_ACTIVE_ORDERS_PER_EMPLOYEE,
      on_leave: onLeave,
      at_cap: atCap,
      eligible,
      reason,
    });
  }

  // Sort eligible attendants first by lightest load
  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return a.active_orders_count - b.active_orders_count;
  });

  return results;
}
