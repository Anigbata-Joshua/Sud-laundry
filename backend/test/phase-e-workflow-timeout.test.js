// Owner: Josh
// Purpose: Phase E tests — Workflow timeouts, stalled order detections, deduplication, timer resets, and error resilience.

import { test, afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Order from '../src/models/order.model.js';
import ProcessingWorkflow from '../src/models/processingWorkflow.model.js';
import Employee from '../src/models/employee.model.js';
import User from '../src/models/user.model.js';
import Notification from '../src/models/notification.model.js';
import { runWorkflowTimeoutCheck } from '../src/jobs/workflowTimeout.job.js';
import {
  STALLED_ALERT_PREFIX,
  STALLED_REASONS,
} from '../src/constants/workflowTimeout.constants.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-unit-tests-only';
process.env.STALLED_ASSIGNMENT_MINUTES = '30';
process.env.STALLED_QC_MINUTES = '60';
process.env.STALLED_REALERT_HOURS = '4';

afterEach(() => mock.restoreAll());
beforeEach(() => {
  mock.method(Notification, 'findOne', () => chain(null));
  mock.method(Order, 'updateOne', async () => ({ modifiedCount: 1 }));
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));
});

const id = () => new mongoose.Types.ObjectId().toString();
const branchA = id();

function chain(result) {
  const p = Promise.resolve(result);
  p.populate = () => p;
  p.select = () => p;
  p.sort = () => p;
  p.limit = () => p;
  p.lean = () => Promise.resolve(result);
  p.distinct = () => Promise.resolve(Array.isArray(result) ? result : []);
  p.session = () => p;
  return p;
}

// 1. Detects stalled assignment when assigned_at exceeds threshold
test('1. Detects stalled assignment and alerts branch manager and front desk', async () => {
  const orderId = id();
  const stepId = id();
  const attendantEmpId = id();
  const managerUserId = id();
  const frontDeskUserId = id();

  const now = new Date('2026-11-07T12:00:00Z');
  // Assigned 40 minutes ago (threshold is 30m)
  const assignedAt = new Date('2026-11-07T11:20:00Z');

  const mockOrder = {
    _id: orderId,
    branch_id: branchA,
    status: 'received',
    createdAt: assignedAt,
    updatedAt: assignedAt,
    is_stalled: false,
  };

  const mockWorkflow = {
    _id: id(),
    order_id: mockOrder,
    branch_id: branchA,
    status: 'active',
    steps: [
      {
        _id: stepId,
        name: 'processing',
        employee_id: attendantEmpId,
        status: 'assigned',
        assigned_at: assignedAt,
      },
    ],
  };

  mock.method(ProcessingWorkflow, 'find', () => chain([mockWorkflow]));
  mock.method(Order, 'find', () => chain([]));

  let updatedOrderId = null;
  let updatedOrderFields = null;
  mock.method(Order, 'updateOne', async (filter, update) => {
    updatedOrderId = filter._id;
    updatedOrderFields = update.$set;
    return { modifiedCount: 1 };
  });
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  mock.method(Employee, 'find', () =>
    chain([
      { user_id: managerUserId, branch_id: branchA },
      { user_id: frontDeskUserId, branch_id: branchA },
    ]),
  );

  mock.method(User, 'find', () =>
    chain([
      { _id: managerUserId, role: 'branch_manager' },
      { _id: frontDeskUserId, role: 'front_desk' },
    ]),
  );

  const notifications = [];
  mock.method(Notification, 'create', async (doc) => {
    notifications.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.stalledAssignments, 1);
  assert.equal(summary.notificationsSent, 2);
  assert.equal(String(updatedOrderId), String(orderId));
  assert.equal(updatedOrderFields.is_stalled, true);
  assert.equal(updatedOrderFields.stalled_reason, STALLED_REASONS.ASSIGNMENT);

  // Both manager and front desk receive notification with order_id and prefix
  assert.equal(notifications.length, 2);
  assert.ok(notifications[0].message.startsWith(STALLED_ALERT_PREFIX));
  assert.equal(String(notifications[0].order_id), String(orderId));
  assert.ok(notifications.some((n) => String(n.user_id) === String(managerUserId)));
  assert.ok(notifications.some((n) => String(n.user_id) === String(frontDeskUserId)));
});

// 2. Detects stalled quality check using the workflow step completed_at
test('2. Detects stalled quality check using workflow step completed_at', async () => {
  const orderId = id();
  const managerUserId = id();

  const now = new Date('2026-11-07T12:00:00Z');
  // Step completed 75 minutes ago (threshold is 60m)
  const stepCompletedAt = new Date('2026-11-07T10:45:00Z');

  mock.method(ProcessingWorkflow, 'find', () => chain([]));

  // Order in quality_check
  mock.method(Order, 'find', (filter) => {
    if (filter?.status === 'quality_check') {
      return chain([
        {
          _id: orderId,
          branch_id: branchA,
          status: 'quality_check',
          createdAt: stepCompletedAt,
          updatedAt: stepCompletedAt,
          is_stalled: false,
        },
      ]);
    }
    return chain([]);
  });

  mock.method(ProcessingWorkflow, 'findOne', () =>
    chain({
      _id: id(),
      order_id: orderId,
      status: 'completed',
      steps: [
        {
          name: 'processing',
          status: 'completed',
          completed_at: stepCompletedAt,
        },
      ],
    }),
  );

  let updatedOrderFields = null;
  mock.method(Order, 'updateOne', async (filter, update) => {
    updatedOrderFields = update.$set;
    return { modifiedCount: 1 };
  });
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  mock.method(Employee, 'find', () => chain([{ user_id: managerUserId, branch_id: branchA }]));
  mock.method(User, 'find', () => chain([{ _id: managerUserId, role: 'branch_manager' }]));

  const notifications = [];
  mock.method(Notification, 'create', async (doc) => {
    notifications.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.stalledQc, 1);
  assert.equal(summary.notificationsSent, 1);
  assert.equal(updatedOrderFields.is_stalled, true);
  assert.equal(updatedOrderFields.stalled_reason, STALLED_REASONS.QUALITY_CHECK);
  assert.ok(notifications[0].message.includes('quality check'));
});

// 3. Detects unassigned received orders older than STALLED_ASSIGNMENT_MINUTES
test('3. Detects unassigned received orders and alerts the branch manager', async () => {
  const orderId = id();
  const managerUserId = id();
  const frontDeskUserId = id();

  const now = new Date('2026-11-07T12:00:00Z');
  // Order received 45 minutes ago with no attendant assigned
  const receivedAt = new Date('2026-11-07T11:15:00Z');

  mock.method(ProcessingWorkflow, 'find', () => chain([]));

  mock.method(Order, 'find', (filter) => {
    if (filter?.status === 'received') {
      return chain([
        {
          _id: orderId,
          branch_id: branchA,
          status: 'received',
          createdAt: receivedAt,
          is_stalled: false,
        },
      ]);
    }
    return chain([]);
  });

  // No active workflow exists
  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));

  let updatedOrderFields = null;
  mock.method(Order, 'updateOne', async (filter, update) => {
    updatedOrderFields = update.$set;
    return { modifiedCount: 1 };
  });
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  mock.method(Employee, 'find', () =>
    chain([
      { user_id: managerUserId, branch_id: branchA },
      { user_id: frontDeskUserId, branch_id: branchA },
    ]),
  );
  mock.method(User, 'find', () =>
    chain([
      { _id: managerUserId, role: 'branch_manager' },
      { _id: frontDeskUserId, role: 'front_desk' },
    ]),
  );

  const notifications = [];
  mock.method(Notification, 'create', async (doc) => {
    notifications.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.unassignedReceived, 1);
  assert.equal(updatedOrderFields.is_stalled, true);
  assert.equal(updatedOrderFields.stalled_reason, STALLED_REASONS.UNASSIGNED);

  // Unassigned received orders alert ONLY the branch manager
  assert.equal(notifications.length, 1);
  assert.equal(String(notifications[0].user_id), String(managerUserId));
  assert.ok(notifications[0].message.includes('without an assigned attendant'));
});

// 4. Ignores orders that are within thresholds
test('4. Ignores active orders that are within the timeout thresholds', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  // Assigned 10 minutes ago (threshold is 30m)
  const assignedAt = new Date('2026-11-07T11:50:00Z');

  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: {
          _id: id(),
          branch_id: branchA,
          status: 'received',
          createdAt: assignedAt,
        },
        branch_id: branchA,
        status: 'active',
        steps: [
          {
            _id: id(),
            name: 'processing',
            status: 'assigned',
            assigned_at: assignedAt,
          },
        ],
      },
    ]),
  );
  mock.method(Order, 'find', () => chain([]));
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  const notifications = [];
  mock.method(Notification, 'create', async (doc) => {
    notifications.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.stalledAssignments, 0);
  assert.equal(summary.stalledQc, 0);
  assert.equal(summary.unassignedReceived, 0);
  assert.equal(summary.notificationsSent, 0);
  assert.equal(notifications.length, 0);
});

// 5. Reassignment resets the assignment timer
test('5. Reassignment resets the timer based on step assigned_at', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  // Workflow originally created 2 hours ago
  const workflowCreatedAt = new Date('2026-11-07T10:00:00Z');
  // But reassigned to another attendant 10 minutes ago!
  const reassignedAt = new Date('2026-11-07T11:50:00Z');

  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: {
          _id: id(),
          branch_id: branchA,
          status: 'received',
          createdAt: workflowCreatedAt,
        },
        branch_id: branchA,
        status: 'active',
        createdAt: workflowCreatedAt,
        steps: [
          {
            _id: id(),
            name: 'processing',
            status: 'assigned',
            assigned_at: reassignedAt, // Timer measures from here!
          },
        ],
      },
    ]),
  );
  mock.method(Order, 'find', () => chain([]));
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.stalledAssignments, 0, 'Reassigned step must not be flagged stalled');
  assert.equal(summary.notificationsSent, 0);
});

// 6. No repeat alert after read (deduplicates by order_id and recipient within STALLED_REALERT_HOURS)
test('6. Deduplicates alerts: does not send repeat alert within STALLED_REALERT_HOURS even if read', async () => {
  const orderId = id();
  const managerUserId = id();
  const now = new Date('2026-11-07T12:00:00Z');
  const assignedAt = new Date('2026-11-07T11:00:00Z');

  const mockWorkflow = {
    _id: id(),
    order_id: { _id: orderId, branch_id: branchA, status: 'received' },
    branch_id: branchA,
    status: 'active',
    steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
  };

  mock.method(ProcessingWorkflow, 'find', () => chain([mockWorkflow]));
  mock.method(Order, 'find', () => chain([]));
  mock.method(Order, 'updateOne', async () => ({ modifiedCount: 1 }));
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  mock.method(Employee, 'find', () => chain([{ user_id: managerUserId, branch_id: branchA }]));
  mock.method(User, 'find', () => chain([{ _id: managerUserId, role: 'branch_manager' }]));

  // Simulate existing notification sent 1 hour ago that the manager already read
  mock.method(Notification, 'findOne', async () => ({
    _id: id(),
    user_id: managerUserId,
    order_id: orderId,
    type: 'other',
    message: `${STALLED_ALERT_PREFIX} Order ORD-123456 has been assigned...`,
    is_read: true, // Already read!
    createdAt: new Date('2026-11-07T11:00:00Z'),
  }));

  const createdNotifs = [];
  mock.method(Notification, 'create', async (doc) => {
    createdNotifs.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  // Stalled is still detected
  assert.equal(summary.stalledAssignments, 1);
  // But no new notification is created because 1h < 4h realert window
  assert.equal(summary.notificationsSent, 0);
  assert.equal(createdNotifs.length, 0);
});

// 7. Clears is_stalled flag when order is no longer stalled
test('7. Clears is_stalled flag when an order is no longer stalled', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const orderId = id();

  // No active stalled workflows or QC orders
  mock.method(ProcessingWorkflow, 'find', () => chain([]));
  mock.method(Order, 'find', () => chain([]));

  let clearedFilter = null;
  let clearedFields = null;
  mock.method(Order, 'updateMany', async (filter, update) => {
    clearedFilter = filter;
    clearedFields = update.$set;
    return { modifiedCount: 1 };
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.clearedCount, 1);
  assert.equal(clearedFields.is_stalled, false);
  assert.equal(clearedFields.stalled_reason, null);
  assert.ok(clearedFilter.$or);
});

// 8. Finished orders (cancelled, delivered, sent_out, ready) are ignored
test('8. Finished and terminal orders are ignored from stalled checks and cleared', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const oldTimestamp = new Date('2026-11-07T10:00:00Z');

  // Cancelled or ready order in a workflow
  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: { _id: id(), branch_id: branchA, status: 'ready', is_stalled: true },
        status: 'active',
        steps: [{ status: 'assigned', assigned_at: oldTimestamp }],
      },
    ]),
  );

  mock.method(Order, 'find', () => chain([]));
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 1 }));

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.stalledAssignments, 0, 'Ready orders must not be flagged stalled');
  assert.equal(summary.notificationsSent, 0);
});

// 9. Gracefully handles branch with no manager or front desk
test('9. Handles a branch with no assigned manager or front desk without crashing', async () => {
  const orderId = id();
  const now = new Date('2026-11-07T12:00:00Z');
  const assignedAt = new Date('2026-11-07T11:00:00Z');

  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: { _id: orderId, branch_id: branchA, status: 'received' },
        branch_id: branchA,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
    ]),
  );
  mock.method(Order, 'find', () => chain([]));
  mock.method(Order, 'updateOne', async () => ({ modifiedCount: 1 }));
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));

  // Branch has NO employees assigned
  mock.method(Employee, 'find', () => chain([]));
  mock.method(User, 'find', () => chain([]));

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });

  assert.equal(summary.stalledAssignments, 1);
  assert.equal(summary.notificationsSent, 0); // No recipients, but no crash!
});

// 10. Database error isolation: individual order failure does not crash or stop other orders
test('10. Database error on one order update is isolated and does not crash the check', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const assignedAt = new Date('2026-11-07T11:00:00Z');

  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: { _id: id(), branch_id: branchA, status: 'received' },
        branch_id: branchA,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
    ]),
  );
  mock.method(Order, 'find', () => chain([]));

  // Order.updateOne throws a database error
  mock.method(Order, 'updateOne', async () => {
    throw new Error('Transient MongoDB connection dropped');
  });
  mock.method(Order, 'updateMany', async () => ({ modifiedCount: 0 }));
  mock.method(Employee, 'find', () => chain([]));
  mock.method(User, 'find', () => chain([]));

  // Should not throw!
  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
  });
  assert.equal(summary.stalledAssignments, 1);
});

// 11. Orders older than STALLED_MAX_AGE_HOURS are ignored and have is_stalled cleared
test('11. Orders older than STALLED_MAX_AGE_HOURS are ignored and cleared', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  // Order created 80 hours ago (cutoff is 72h)
  const oldCreatedAt = new Date('2026-11-04T04:00:00Z');
  const oldOrderId = id();

  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: {
          _id: oldOrderId,
          branch_id: branchA,
          status: 'received',
          createdAt: oldCreatedAt,
          is_stalled: true,
        },
        branch_id: branchA,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: oldCreatedAt }],
      },
    ]),
  );

  mock.method(Order, 'find', () => chain([]));

  let clearedFilter = null;
  let clearedUpdate = null;
  mock.method(Order, 'updateMany', async (filter, update) => {
    clearedFilter = filter;
    clearedUpdate = update.$set;
    return { modifiedCount: 1 };
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
    maxAgeHours: 72,
  });

  // Old order was ignored from stalled assignments
  assert.equal(summary.stalledAssignments, 0);
  assert.equal(summary.notificationsSent, 0);
  assert.equal(summary.clearedCount, 1);
  assert.equal(clearedUpdate.is_stalled, false);
  assert.equal(clearedUpdate.stalled_reason, null);
  assert.ok(clearedFilter.$or);
});

// 12. Sends one summary notification per recipient when there are more than 3 new stalls
test('12. Sends one summary notification when there are > 3 new stalls for a recipient', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const managerUserId = id();
  const frontDeskUserId = id();
  const branchId = branchA;

  const order1 = id();
  const order2 = id();
  const order3 = id();
  const order4 = id();

  const assignedAt = new Date('2026-11-07T11:00:00Z');
  const recentCreatedAt = new Date('2026-11-07T10:00:00Z');

  // 2 assigned stalled orders
  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: { _id: order1, branch_id: branchId, status: 'received', createdAt: recentCreatedAt },
        branch_id: branchId,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
      {
        _id: id(),
        order_id: { _id: order2, branch_id: branchId, status: 'received', createdAt: recentCreatedAt },
        branch_id: branchId,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
    ]),
  );

  // 1 QC stalled order and 1 unassigned received stalled order
  mock.method(Order, 'find', (filter) => {
    if (filter?.status === 'quality_check') {
      return chain([
        {
          _id: order3,
          branch_id: branchId,
          status: 'quality_check',
          createdAt: recentCreatedAt,
          updatedAt: new Date('2026-11-07T10:30:00Z'),
        },
      ]);
    }
    if (filter?.status === 'received') {
      return chain([
        {
          _id: order4,
          branch_id: branchId,
          status: 'received',
          createdAt: new Date('2026-11-07T11:15:00Z'),
        },
      ]);
    }
    return chain([]);
  });

  // Workflow findOne for QC step completed_at or unassigned workflow
  mock.method(ProcessingWorkflow, 'findOne', (filter) => {
    if (filter?.order_id === order3) {
      return chain({
        steps: [{ status: 'completed', completed_at: new Date('2026-11-07T10:30:00Z') }],
      });
    }
    return chain(null);
  });

  mock.method(Employee, 'find', () =>
    chain([
      { user_id: managerUserId, branch_id: branchId },
      { user_id: frontDeskUserId, branch_id: branchId },
    ]),
  );
  mock.method(User, 'find', () =>
    chain([
      { _id: managerUserId, role: 'branch_manager' },
      { _id: frontDeskUserId, role: 'front_desk' },
    ]),
  );

  const notifications = [];
  mock.method(Notification, 'create', async (doc) => {
    notifications.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
    realertHours: 4,
    maxAgeHours: 72,
  });

  assert.equal(summary.stalledAssignments, 2);
  assert.equal(summary.stalledQc, 1);
  assert.equal(summary.unassignedReceived, 1);

  // Manager is targeted by all 4 stalls (> 3), so receives exactly ONE summary notification
  const managerNotifs = notifications.filter((n) => String(n.user_id) === String(managerUserId));
  assert.equal(managerNotifs.length, 1);
  assert.equal(
    managerNotifs[0].message,
    `${STALLED_ALERT_PREFIX} 4 orders need attention: 2 not accepted, 1 awaiting quality check, 1 unassigned`,
  );
  assert.equal(managerNotifs[0].order_id, undefined);

  // Front desk is targeted by 3 stalls (2 assigned + 1 QC <= 3), so receives 3 individual notifications
  const frontDeskNotifs = notifications.filter((n) => String(n.user_id) === String(frontDeskUserId));
  assert.equal(frontDeskNotifs.length, 3);
  assert.ok(frontDeskNotifs.every((n) => n.order_id !== undefined));
});

// 13. Summary notification is deduplicated across runs within STALLED_REALERT_HOURS
test('13. Summary notification is deduplicated and not resent within STALLED_REALERT_HOURS', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const managerUserId = id();
  const branchId = branchA;

  const order1 = id();
  const order2 = id();
  const order3 = id();
  const order4 = id();

  const assignedAt = new Date('2026-11-07T11:00:00Z');
  const recentCreatedAt = new Date('2026-11-07T10:00:00Z');

  mock.method(ProcessingWorkflow, 'find', () =>
    chain([
      {
        _id: id(),
        order_id: { _id: order1, branch_id: branchId, status: 'received', createdAt: recentCreatedAt },
        branch_id: branchId,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
      {
        _id: id(),
        order_id: { _id: order2, branch_id: branchId, status: 'received', createdAt: recentCreatedAt },
        branch_id: branchId,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
      {
        _id: id(),
        order_id: { _id: order3, branch_id: branchId, status: 'received', createdAt: recentCreatedAt },
        branch_id: branchId,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
      {
        _id: id(),
        order_id: { _id: order4, branch_id: branchId, status: 'received', createdAt: recentCreatedAt },
        branch_id: branchId,
        status: 'active',
        steps: [{ name: 'processing', status: 'assigned', assigned_at: assignedAt }],
      },
    ]),
  );

  mock.method(Order, 'find', () => chain([]));
  mock.method(Employee, 'find', () => chain([{ user_id: managerUserId, branch_id: branchId }]));
  mock.method(User, 'find', () => chain([{ _id: managerUserId, role: 'branch_manager' }]));

  // Simulate existing summary notification sent 30 minutes ago (within 4h realert window)
  const summarySentAt = new Date('2026-11-07T11:30:00Z');
  mock.method(Notification, 'findOne', (query) => {
    if (query?.message?.$regex?.test(`${STALLED_ALERT_PREFIX} 4 orders need attention:`)) {
      return chain({
        _id: id(),
        user_id: managerUserId,
        type: 'other',
        message: `${STALLED_ALERT_PREFIX} 4 orders need attention: 4 not accepted, 0 awaiting quality check, 0 unassigned`,
        createdAt: summarySentAt,
      });
    }
    return chain(null);
  });

  const notifications = [];
  mock.method(Notification, 'create', async (doc) => {
    notifications.push(doc);
    return doc;
  });

  const summary = await runWorkflowTimeoutCheck({
    now,
    assignmentThresholdMinutes: 30,
    qcThresholdMinutes: 60,
    realertHours: 4,
    maxAgeHours: 72,
  });

  assert.equal(summary.stalledAssignments, 4);
  // No new summary alert is sent because recent summary already covered these orders
  assert.equal(summary.notificationsSent, 0);
  assert.equal(notifications.length, 0);
});
