// Owner: Josh
// Purpose: Phase C tests — auto-assignment, single processing step, QC pass/fail, reassignment, and rollback.

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Order from '../src/models/order.model.js';
import Employee from '../src/models/employee.model.js';
import User from '../src/models/user.model.js';
import LeaveRequest from '../src/models/leaveRequest.model.js';
import ProcessingWorkflow from '../src/models/processingWorkflow.model.js';
import Product from '../src/models/product.model.js';
import StockMovement from '../src/models/stockMovement.model.js';
import Notification from '../src/models/notification.model.js';
import * as orderController from '../src/controllers/order.controller.js';
import * as workflowController from '../src/controllers/processingWorkflow.controller.js';
import {
  findBestAttendantForOrder,
  autoAssignProcessingWorkflow,
} from '../src/services/workflowAssignment.service.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-unit-tests-only';
process.env.REDIS_URL = 'redis://127.0.0.1:1';

afterEach(() => mock.restoreAll());

const id = () => new mongoose.Types.ObjectId().toString();
const branchA = id();

function invoke(handler, req = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ code: this.statusCode, data: payload.data, body: payload });
      },
    };
    Promise.resolve(handler(req, res, (err) => (err ? reject(err) : resolve({ code: res.statusCode })))).catch(reject);
  });
}

function chain(result) {
  const p = Promise.resolve(result);
  p.populate = () => p;
  p.select = () => p;
  p.sort = () => p;
  p.limit = () => p;
  p.distinct = () => Promise.resolve(Array.isArray(result) ? result : []);
  return p;
}

test('1. auto-assignment picks the lightest-loaded attendant (and breaks ties by oldest last assignment)', async () => {
  const emp1Id = id();
  const emp2Id = id();
  const user1Id = id();
  const user2Id = id();

  const mockEmployees = [
    {
      _id: emp1Id,
      branch_id: branchA,
      is_active: true,
      job_title: 'Attendant',
      user_id: { _id: user1Id, name: 'Attendant One', role: 'employee', is_active: true },
    },
    {
      _id: emp2Id,
      branch_id: branchA,
      is_active: true,
      job_title: 'Attendant',
      user_id: { _id: user2Id, name: 'Attendant Two', role: 'employee', is_active: true },
    },
  ];

  mock.method(Employee, 'find', () => chain(mockEmployees));
  mock.method(LeaveRequest, 'find', () => chain([]));

  // Scenario A: emp1 has 2 active orders, emp2 has 1 active order -> picks emp2
  mock.method(ProcessingWorkflow, 'find', (query) => {
    const empId = query?.['steps.employee_id'];
    if (String(empId) === String(emp1Id)) {
      return chain([id(), id()]);
    }
    if (String(empId) === String(emp2Id)) {
      return chain([id()]);
    }
    return chain([]);
  });

  mock.method(Order, 'countDocuments', async (query) => {
    const orderIds = query?._id?.$in || [];
    return orderIds.length;
  });

  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));

  const mockOrder = {
    _id: id(),
    branch_id: branchA,
    received_at: new Date(),
    delivery_time: new Date(Date.now() + 86400000),
  };

  const best = await findBestAttendantForOrder({ order: mockOrder });
  assert.equal(String(best._id), String(emp2Id), 'Must pick attendant with fewer active orders');

  // Scenario B: Tie in active orders (both have 1) -> picks attendant with oldest last assignment
  mock.method(ProcessingWorkflow, 'find', () => chain([id()])); // both have 1 active order
  mock.method(Order, 'countDocuments', async () => 1);

  // emp1 last assigned 2 hours ago; emp2 last assigned 10 minutes ago
  const tTwoHoursAgo = new Date(Date.now() - 7200000);
  const tTenMinutesAgo = new Date(Date.now() - 600000);

  mock.method(ProcessingWorkflow, 'findOne', (query) => {
    const empId = query?.['steps.employee_id'];
    if (String(empId) === String(emp1Id)) {
      return chain({
        createdAt: tTwoHoursAgo,
        steps: [{ employee_id: emp1Id, createdAt: tTwoHoursAgo }],
      });
    }
    if (String(empId) === String(emp2Id)) {
      return chain({
        createdAt: tTenMinutesAgo,
        steps: [{ employee_id: emp2Id, createdAt: tTenMinutesAgo }],
      });
    }
    return chain(null);
  });

  const bestTie = await findBestAttendantForOrder({ order: mockOrder });
  assert.equal(String(bestTie._id), String(emp1Id), 'Must pick attendant with oldest last assignment on tie');
});

test('2. auto-assignment skips attendants on approved leave overlapping processing window', async () => {
  const emp1Id = id();
  const emp2Id = id();

  const mockEmployees = [
    {
      _id: emp1Id,
      branch_id: branchA,
      is_active: true,
      user_id: { _id: id(), name: 'On Leave Attendant', role: 'employee', is_active: true },
    },
    {
      _id: emp2Id,
      branch_id: branchA,
      is_active: true,
      user_id: { _id: id(), name: 'Available Attendant', role: 'employee', is_active: true },
    },
  ];

  mock.method(Employee, 'find', () => chain(mockEmployees));
  // emp1 is on approved leave
  mock.method(LeaveRequest, 'find', () => chain([{ employee_id: emp1Id }]));
  mock.method(ProcessingWorkflow, 'find', () => chain([]));
  mock.method(Order, 'countDocuments', async () => 0);
  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));

  const mockOrder = {
    _id: id(),
    branch_id: branchA,
    received_at: new Date(),
    delivery_time: new Date(Date.now() + 86400000),
  };

  const best = await findBestAttendantForOrder({ order: mockOrder });
  assert.equal(String(best._id), String(emp2Id), 'Must skip attendant on approved leave');
});

test('3. auto-assignment skips attendants with >= 5 active orders (cap)', async () => {
  const emp1Id = id();
  const emp2Id = id();

  const mockEmployees = [
    {
      _id: emp1Id,
      branch_id: branchA,
      is_active: true,
      user_id: { _id: id(), name: 'Busy Attendant', role: 'employee', is_active: true },
    },
    {
      _id: emp2Id,
      branch_id: branchA,
      is_active: true,
      user_id: { _id: id(), name: 'Free Attendant', role: 'employee', is_active: true },
    },
  ];

  mock.method(Employee, 'find', () => chain(mockEmployees));
  mock.method(LeaveRequest, 'find', () => chain([]));

  mock.method(ProcessingWorkflow, 'find', (query) => {
    const empId = query?.['steps.employee_id'];
    if (String(empId) === String(emp1Id)) {
      return chain([id(), id(), id(), id(), id()]); // 5 orders
    }
    return chain([id()]); // 1 order
  });

  mock.method(Order, 'countDocuments', async (query) => (query?._id?.$in?.length || 0));
  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));

  const mockOrder = {
    _id: id(),
    branch_id: branchA,
    received_at: new Date(),
    delivery_time: new Date(Date.now() + 86400000),
  };

  const best = await findBestAttendantForOrder({ order: mockOrder });
  assert.equal(String(best._id), String(emp2Id), 'Must skip attendant who has reached cap of 5 active orders');
});

test('4. auto-assignment leaves order in received and notifies manager when no attendant is available', async () => {
  const managerUserId = id();
  const orderId = id();

  mock.method(Employee, 'find', (query) => {
    if (query?.branch_id && query?.is_active) {
      // No attendants found
      return chain([{ user_id: { _id: managerUserId, role: 'branch_manager', is_active: true } }]);
    }
    return chain([]);
  });

  mock.method(LeaveRequest, 'find', () => chain([]));
  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));

  const notifs = [];
  mock.method(Notification, 'create', async (doc) => {
    notifs.push(doc);
    return doc;
  });

  const mockOrder = {
    _id: orderId,
    branch_id: branchA,
    status: 'received',
    received_at: new Date(),
  };

  const result = await autoAssignProcessingWorkflow({ order: mockOrder, createdByUserId: id() });
  assert.equal(result.assigned, false);
  assert.equal(result.workflow, null);

  assert.equal(notifs.length, 1);
  assert.equal(String(notifs[0].user_id), String(managerUserId));
  assert.equal(notifs[0].type, 'other');
  assert.ok(notifs[0].message.includes('No attendants are currently available'));
});

test('5. reassign respects availability rules (rejects attendant at cap or on leave)', async () => {
  const workflowId = id();
  const managerUserId = id();
  const busyEmpId = id();
  const stepId = id();

  const mockWorkflow = {
    _id: workflowId,
    branch_id: branchA,
    status: 'active',
    order_id: id(),
    steps: [
      {
        _id: stepId,
        name: 'processing',
        sequence: 1,
        employee_id: id(),
        status: 'assigned',
      },
    ],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  mock.method(ProcessingWorkflow, 'findById', async () => mockWorkflow);
  mock.method(Order, 'findById', async () => ({
    _id: mockWorkflow.order_id,
    branch_id: branchA,
    status: 'received',
  }));

  mock.method(Employee, 'findById', () =>
    chain({
      _id: busyEmpId,
      branch_id: branchA,
      is_active: true,
      user_id: { _id: id(), name: 'Busy Attendant', role: 'employee', is_active: true },
    }),
  );

  // Busy attendant has 5 active orders
  mock.method(ProcessingWorkflow, 'find', () => chain([id(), id(), id(), id(), id()]));
  mock.method(Order, 'countDocuments', async () => 5);
  mock.method(LeaveRequest, 'findOne', async () => null);

  const managerUser = { id: managerUserId, role: 'branch_manager', branch_id: branchA };

  await assert.rejects(
    invoke(workflowController.reassignWorkflow, {
      user: managerUser,
      params: { id: workflowId },
      body: { employee_id: busyEmpId },
    }),
    /already has 5 active orders/,
  );
});

test('6. attendant Accept sets order to processing and consumes stock exactly once', async () => {
  const workflowId = id();
  const stepId = id();
  const employeeId = id();
  const userId = id();
  const orderId = id();
  const prod1Id = id();

  const mockOrder = {
    _id: orderId,
    branch_id: branchA,
    status: 'received',
    customer_id: id(),
    supplies_reserved: [
      { product_id: prod1Id, name: 'Detergent', quantity: 2, stage: 'washing', consumed: false },
      { product_id: prod1Id, name: 'Nylon', quantity: 1, stage: 'packaging', consumed: false },
    ],
    supplies_used: [],
    save: async function () {
      return this;
    },
  };

  const mockWorkflow = {
    _id: workflowId,
    branch_id: branchA,
    order_id: orderId,
    status: 'active',
    steps: [
      {
        _id: stepId,
        name: 'processing',
        sequence: 1,
        employee_id: employeeId,
        status: 'assigned',
      },
    ],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };
  mockWorkflow.steps.id = () => mockWorkflow.steps[0];

  mock.method(ProcessingWorkflow, 'findById', async () => mockWorkflow);
  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: employeeId, user_id: userId }));
  mock.method(Product, 'findById', async () => ({
    _id: prod1Id,
    name: 'Detergent',
    quantity: 50,
    reserved_quantity: 5,
    save: async () => {},
  }));
  mock.method(StockMovement, 'create', async () => [{ _id: id() }]);
  mock.method(Notification, 'create', async () => ({}));

  const res = await invoke(workflowController.updateStep, {
    user: { id: userId, role: 'employee' },
    params: { id: workflowId, stepId },
    body: { action: 'accept' },
  });

  assert.equal(res.code, 200);
  assert.equal(mockOrder.status, 'processing');
  assert.equal(mockWorkflow.steps[0].status, 'accepted');
  // All reserved supplies consumed upon single processing step accept
  assert.equal(mockOrder.supplies_reserved[0].consumed, true);
  assert.equal(mockOrder.supplies_reserved[1].consumed, true);
});

test('7. attendant Done sets order to quality_check and notifies branch manager', async () => {
  const workflowId = id();
  const stepId = id();
  const employeeId = id();
  const userId = id();
  const orderId = id();
  const managerUserId = id();

  let orderSaved = false;
  const mockOrder = {
    _id: orderId,
    branch_id: branchA,
    status: 'processing',
    save: async function () {
      orderSaved = true;
      return this;
    },
  };

  const mockWorkflow = {
    _id: workflowId,
    branch_id: branchA,
    order_id: orderId,
    status: 'active',
    steps: [
      {
        _id: stepId,
        name: 'processing',
        sequence: 1,
        employee_id: employeeId,
        status: 'accepted',
      },
    ],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };
  mockWorkflow.steps.id = () => mockWorkflow.steps[0];

  mock.method(ProcessingWorkflow, 'findById', async () => mockWorkflow);
  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: employeeId, user_id: userId }));
  mock.method(Employee, 'find', () =>
    chain([{ user_id: { _id: managerUserId, role: 'branch_manager', is_active: true } }]),
  );

  const notifs = [];
  mock.method(Notification, 'create', async (doc) => {
    notifs.push(doc);
    return doc;
  });

  const res = await invoke(workflowController.updateStep, {
    user: { id: userId, role: 'employee' },
    params: { id: workflowId, stepId },
    body: { action: 'complete' },
  });

  assert.equal(res.code, 200);
  assert.equal(mockOrder.status, 'quality_check');
  assert.equal(mockWorkflow.status, 'completed');
  assert.equal(mockWorkflow.steps[0].status, 'completed');
  assert.equal(orderSaved, true);

  assert.equal(notifs.length, 1);
  assert.equal(String(notifs[0].user_id), String(managerUserId));
  assert.equal(notifs[0].type, 'inspecting');
});

test('8. quality check pass sets order to ready and completes workflow', async () => {
  const workflowId = id();
  const orderId = id();
  const customerId = id();
  const managerUserId = id();

  const mockOrder = {
    _id: orderId,
    branch_id: branchA,
    status: 'quality_check',
    customer_id: customerId,
    save: async function () {
      return this;
    },
  };

  const mockWorkflow = {
    _id: workflowId,
    branch_id: branchA,
    order_id: orderId,
    status: 'completed',
    steps: [{ employee_id: id() }],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  mock.method(ProcessingWorkflow, 'findById', async () => mockWorkflow);
  mock.method(Order, 'findById', async () => mockOrder);
  const notifs = [];
  mock.method(Notification, 'create', async (doc) => {
    notifs.push(doc);
    return doc;
  });

  const res = await invoke(workflowController.reviewQuality, {
    user: { id: managerUserId, role: 'branch_manager', branch_id: branchA },
    params: { id: workflowId },
    body: { result: 'pass' },
  });

  assert.equal(res.code, 200);
  assert.equal(mockOrder.status, 'ready');
  assert.ok(mockOrder.ready_at instanceof Date);
  assert.equal(notifs.length, 1);
  assert.equal(String(notifs[0].user_id), String(customerId));
  assert.equal(notifs[0].type, 'order_ready');
});

test('9. quality check fail routes back to processing with the same attendant and records notes', async () => {
  const workflowId = id();
  const orderId = id();
  const attendantId = id();
  const attendantUserId = id();
  const frontDeskUserId = id();

  const mockOrder = {
    _id: orderId,
    branch_id: branchA,
    status: 'quality_check',
    save: async function () {
      return this;
    },
  };

  const mockWorkflow = {
    _id: workflowId,
    branch_id: branchA,
    order_id: orderId,
    cycle: 1,
    status: 'completed',
    steps: [{ employee_id: attendantId, name: 'processing' }],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  mock.method(ProcessingWorkflow, 'findById', async () => mockWorkflow);
  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(ProcessingWorkflow, 'findOne', () => chain(mockWorkflow));

  let createdNextWorkflow = null;
  mock.method(ProcessingWorkflow, 'create', async (doc) => {
    createdNextWorkflow = {
      ...doc,
      populate: async function () {
        return this;
      },
    };
    return createdNextWorkflow;
  });

  mock.method(Employee, 'findById', () =>
    chain({
      _id: attendantId,
      user_id: { _id: attendantUserId, name: 'Attendant John' },
    }),
  );

  const notifs = [];
  mock.method(Notification, 'create', async (doc) => {
    notifs.push(doc);
    return doc;
  });

  // Front desk reviews quality and fails it
  const res = await invoke(workflowController.reviewQuality, {
    user: { id: frontDeskUserId, role: 'front_desk', branch_id: branchA },
    params: { id: workflowId },
    body: { result: 'fail', notes: 'Collar still stained, rewash required' },
  });

  assert.equal(res.code, 200);
  assert.equal(mockOrder.status, 'processing');
  assert.equal(mockWorkflow.status, 'qc_failed');
  assert.equal(mockWorkflow.qc_notes, 'Collar still stained, rewash required');

  assert.ok(createdNextWorkflow);
  assert.equal(createdNextWorkflow.cycle, 2);
  assert.equal(String(createdNextWorkflow.steps[0].employee_id), String(attendantId));
  assert.equal(createdNextWorkflow.steps[0].status, 'assigned');

  assert.equal(notifs.length, 1);
  assert.equal(String(notifs[0].user_id), String(attendantUserId));
  assert.equal(notifs[0].type, 'task_assigned');
  assert.ok(notifs[0].message.includes('Collar still stained'));
});

test('10. legacy multi-step workflows still load without errors', async () => {
  const legacyWorkflow = {
    _id: id(),
    order_id: { _id: id(), customer_id: { name: 'Customer' }, branch_id: { name: 'Branch' } },
    branch_id: { _id: branchA, name: 'Branch A' },
    cycle: 1,
    status: 'completed',
    steps: [
      { name: 'washing', sequence: 1, employee_id: { user_id: { name: 'Wash Attendant' } }, status: 'completed' },
      { name: 'processing', sequence: 2, employee_id: { user_id: { name: 'Dry Clean Attendant' } }, status: 'completed' },
      { name: 'packaging', sequence: 3, employee_id: { user_id: { name: 'Pack Attendant' } }, status: 'completed' },
    ],
  };

  mock.method(ProcessingWorkflow, 'find', () => chain([legacyWorkflow]));

  const res = await invoke(workflowController.getWorkflows, {
    user: { id: id(), role: 'admin' },
    query: { branch_id: branchA },
  });

  assert.equal(res.code, 200);
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].steps.length, 3);
  assert.equal(res.data[0].steps[0].name, 'washing');
  assert.equal(res.data[0].steps[2].name, 'packaging');
});

test('11. failure during auto-assignment leaves order state unchanged (atomic rollback)', async () => {
  const orderId = id();
  const staffUserId = id();
  const customerId = id();

  let orderSaved = false;
  const mockOrder = {
    _id: orderId,
    customer_id: customerId,
    branch_id: branchA,
    status: 'placed',
    total_price: 1500,
    amount_due: 1500,
    items: [
      {
        toObject: () => ({ quantity: 1, unit_price: 1500, subtotal: 1500 }),
        unit_price: 1500,
        quantity: 1,
        subtotal: 1500,
      },
    ],
    save: async function () {
      orderSaved = true;
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: id(), user_id: staffUserId }));
  mock.method(Product, 'findOne', async () => ({ _id: id(), name: 'Detergent', quantity: 10, reserved_quantity: 1 }));
  mock.method(Product, 'findOneAndUpdate', async () => ({ _id: id() }));

  // Simulate auto-assignment crash (e.g. database failure during workflow creation)
  mock.method(Employee, 'find', () => {
    throw new Error('Database connection dropped during auto-assignment');
  });

  await assert.rejects(
    invoke(orderController.updateOrder, {
      user: { id: staffUserId, role: 'front_desk', branch_id: branchA },
      params: { id: orderId },
      body: {
        status: 'received',
        intake_items: [{ quantity: 1 }],
      },
    }),
    /Database connection dropped during auto-assignment/,
  );

  // Order status was rolled back to placed and intake cleared
  assert.equal(mockOrder.status, 'placed');
  assert.equal(mockOrder.intake, undefined);
});
