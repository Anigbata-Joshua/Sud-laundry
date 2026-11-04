// Owner: Josh
// Purpose: Phase D tests — Needs-attention endpoint, role actions, notification grouping, seed idempotency, and concurrency/atomicity.

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Product from '../src/models/product.model.js';
import StockMovement from '../src/models/stockMovement.model.js';
import Notification from '../src/models/notification.model.js';
import SupplyRequest from '../src/models/supplyRequest.model.js';
import Employee from '../src/models/employee.model.js';
import User from '../src/models/user.model.js';
import Branch from '../src/models/branch.model.js';
import Order from '../src/models/order.model.js';
import ProcessingWorkflow from '../src/models/processingWorkflow.model.js';

import * as productController from '../src/controllers/product.controller.js';
import * as supplyRequestController from '../src/controllers/supplyRequest.controller.js';
import * as workflowController from '../src/controllers/processingWorkflow.controller.js';
import {
  seedSupplyProducts,
  CORE_RECIPE_PRODUCTS,
} from '../scripts/seedSupplyProducts.js';
import {
  notifyOfficersOfStockShortage,
  checkAndReserveSuppliesForOrder,
} from '../src/services/inventoryConsumption.service.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-unit-tests-only';

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
    Promise.resolve(
      handler(req, res, (err) => (err ? reject(err) : resolve({ code: res.statusCode }))),
    ).catch(reject);
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

// 1. GET /products/needs-attention
test('1. GET /products/needs-attention returns low stock products and missing core recipe items', async () => {
  mock.method(Branch, 'findById', () => Promise.resolve({ _id: branchA, name: 'Test Branch' }));

  const existingProducts = [
    {
      _id: id(),
      name: 'Laundry Detergent',
      branch_id: branchA,
      quantity: 15,
      reserved_quantity: 0,
      reorder_point: 20, // Low stock: 15 <= 20
      unit: 'scoop',
      is_active: true,
      toObject() { return this; },
    },
    {
      _id: id(),
      name: 'Fabric Softener',
      branch_id: branchA,
      quantity: 50,
      reserved_quantity: 0,
      reorder_point: 10, // Healthy stock
      unit: 'cap',
      is_active: true,
      toObject() { return this; },
    },
  ];

  mock.method(Product, 'find', () => chain(existingProducts));

  const req = {
    user: { id: id(), role: 'inventory_officer', branch_id: branchA },
    query: {},
  };

  const res = await invoke(productController.getProductsNeedingAttention, req);

  assert.equal(res.code, 200);
  assert.ok(Array.isArray(res.data.items));

  // Should include Laundry Detergent (quantity <= reorder_point)
  const lowItem = res.data.items.find((p) => p.name === 'Laundry Detergent');
  assert.ok(lowItem);
  assert.equal(lowItem.reason, 'low_stock');

  // Should not include Fabric Softener (healthy stock)
  assert.ok(!res.data.items.some((p) => p.name === 'Fabric Softener'));

  // Should include missing core recipe items (e.g. Ironing Starch, Dry Cleaning Solvent, Packaging Nylon, Hanger)
  const missingStarch = res.data.items.find((p) => p.name === 'Ironing Starch');
  assert.ok(missingStarch);
  assert.equal(missingStarch.is_missing, true);
  assert.equal(missingStarch.reason, 'missing_recipe_supply');
});

// 2. Initial stock field on product creation creates initial stock movement
test('2. Initial stock on product creation creates product with stock and records purchase movement', async () => {
  const officerUserId = id();
  const prodId = id();

  mock.method(Branch, 'findById', () => Promise.resolve({ _id: branchA, name: 'Test Branch' }));
  mock.method(Employee, 'findOne', () => Promise.resolve({ _id: id(), user_id: officerUserId }));
  mock.method(Product, 'findOne', () => Promise.resolve(null));
  mock.method(Product, 'create', async (doc) => ({
    _id: prodId,
    ...doc,
    toObject() { return { _id: prodId, ...doc }; },
  }));

  const movementCreateMock = mock.method(StockMovement, 'create', async () => [{}]);

  const req = {
    user: { id: officerUserId, role: 'inventory_officer', branch_id: branchA },
    body: {
      name: 'Special Hanger',
      unit: 'pieces',
      reorder_point: 10,
      initial_stock: 45,
    },
  };

  const res = await invoke(productController.createProduct, req);

  assert.equal(res.code, 201);
  assert.equal(res.data.quantity, 45);

  assert.equal(movementCreateMock.mock.callCount(), 1);
  const movArgs = movementCreateMock.mock.calls[0].arguments[0];
  assert.equal(movArgs.product_id, prodId);
  assert.equal(movArgs.type, 'purchase');
  assert.equal(movArgs.quantity, 45);
});

// 3. Branch manager cannot create products directly with initial stock
test('3. Branch manager cannot set initial stock directly', async () => {
  mock.method(Branch, 'findById', () => Promise.resolve({ _id: branchA, name: 'Test Branch' }));

  const req = {
    user: { id: id(), role: 'branch_manager', branch_id: branchA },
    body: {
      name: 'Direct Product',
      unit: 'unit',
      reorder_point: 5,
      initial_stock: 10,
    },
  };

  await assert.rejects(
    invoke(productController.createProduct, req),
    (err) => err.statusCode === 403,
  );
});

// 4. Branch manager can create restock requests and inventory officer can approve them
test('4. Branch manager creates restock request; inventory officer approves and updates stock with purchase movement', async () => {
  const managerUserId = id();
  const officerUserId = id();
  const productId = id();
  const requestId = id();

  mock.method(Branch, 'findById', () => Promise.resolve({ _id: branchA, name: 'Test Branch' }));
  const reqEmployee = { _id: id(), user_id: managerUserId, branch_id: branchA };
  mock.method(Employee, 'findOne', () => Promise.resolve(reqEmployee));
  mock.method(Employee, 'findById', () => chain({ user_id: { _id: managerUserId } }));
  mock.method(Employee, 'find', () => chain([]));
  mock.method(Notification, 'create', async () => ({}));

  const prodDoc = {
    _id: productId,
    name: 'Laundry Detergent',
    unit: 'scoop',
    quantity: 10,
    branch_id: branchA,
    is_active: true,
    save: mock.fn(async function () { return this; }),
  };
  mock.method(Product, 'findById', (pId) =>
    String(pId) === String(productId) ? Promise.resolve(prodDoc) : Promise.resolve(null),
  );

  let createdSupplyRequest = null;
  mock.method(SupplyRequest, 'create', async (doc) => {
    createdSupplyRequest = {
      _id: requestId,
      ...doc,
      toObject() { return { _id: requestId, ...doc }; },
      populate: () => chain(createdSupplyRequest),
    };
    return createdSupplyRequest;
  });

  // Step 4a: Manager submits restock request
  const submitReq = {
    user: { id: managerUserId, role: 'branch_manager', branch_id: branchA },
    body: {
      request_type: 'restock',
      reason: 'Critically low on detergent for weekend rush',
      items: [{ product_id: productId, product_name: 'Laundry Detergent', quantity: 40, unit: 'scoop' }],
    },
  };

  const createRes = await invoke(supplyRequestController.createRequest, submitReq);
  assert.equal(createRes.code, 201);
  assert.equal(createdSupplyRequest.request_type, 'restock');
  assert.equal(createdSupplyRequest.reason, 'Critically low on detergent for weekend rush');

  // Step 4b: Officer approves restock request
  const officerEmployee = { _id: id(), user_id: officerUserId, branch_id: branchA };
  mock.method(Employee, 'findOne', () => Promise.resolve(officerEmployee));

  const existingRequestDoc = {
    ...createdSupplyRequest,
    status: 'pending',
    branch_id: branchA,
    save: mock.fn(async function () { return this; }),
    populate: () => chain(existingRequestDoc),
  };
  mock.method(SupplyRequest, 'findById', () => chain(existingRequestDoc));

  const movementCreateMock = mock.method(StockMovement, 'create', async () => [{}]);

  const approveReq = {
    user: { id: officerUserId, role: 'inventory_officer', branch_id: branchA },
    params: { id: requestId },
    body: {
      items: [{ product_id: productId, quantity: 40 }],
    },
  };

  const approveRes = await invoke(supplyRequestController.approveRequest, approveReq);
  assert.equal(approveRes.code, 200);

  // Stock increased by 40 (10 -> 50)
  assert.equal(prodDoc.quantity, 50);
  assert.equal(movementCreateMock.mock.callCount(), 1);
  const mov = movementCreateMock.mock.calls[0].arguments[0];
  assert.equal(mov.type, 'purchase');
  assert.equal(mov.quantity, 40);
});

// 5. Stock shortage alerts within 30 minutes are grouped into one notification
test('5. Stock shortage alerts within 30 minutes update the existing notification rather than creating duplicate', async () => {
  const officerUserId = id();
  mock.method(Employee, 'find', () => chain([{ user_id: officerUserId }]));
  mock.method(User, 'find', () => chain([{ _id: officerUserId, role: 'inventory_officer' }]));

  let savedNotification = null;
  const existingNotification = {
    _id: id(),
    user_id: officerUserId,
    type: 'other',
    message: 'Previous alert for Laundry Detergent',
    createdAt: new Date(),
    sent_at: new Date(),
    is_read: true,
    save: mock.fn(async function () {
      savedNotification = this;
      return this;
    }),
  };

  const findOneMock = mock.method(Notification, 'findOne', () => Promise.resolve(existingNotification));
  const createMock = mock.method(Notification, 'create', async () => ({}));

  await notifyOfficersOfStockShortage({
    branchId: branchA,
    productName: 'Laundry Detergent',
    required: 10,
    available: 2,
    unit: 'scoop',
    missing: false,
  });

  assert.equal(findOneMock.mock.callCount(), 1);
  // Reused existing notification instead of creating new one
  assert.equal(createMock.mock.callCount(), 0);
  assert.equal(existingNotification.is_read, false);
  assert.ok(existingNotification.message.includes('Laundry Detergent'));
});

// 6. CORE_RECIPE_PRODUCTS contains only 6 active supplies and excludes deleted ones
test('6. Seed configuration contains exactly the 6 core supplies without deleted products', () => {
  const expectedSupplies = [
    'Laundry Detergent',
    'Fabric Softener',
    'Ironing Starch',
    'Dry Cleaning Solvent',
    'Packaging Nylon',
    'Hanger',
  ];

  const actualNames = CORE_RECIPE_PRODUCTS.map((p) => p.name);
  assert.deepEqual(actualNames.sort(), expectedSupplies.sort());

  const deletedProducts = ['Perfume', 'Shoe Cleaner', 'Stain Remover', 'Premium Packaging Material'];
  for (const del of deletedProducts) {
    assert.ok(!actualNames.includes(del), `Deleted product ${del} must not be in CORE_RECIPE_PRODUCTS`);
  }
});

// 7. seedSupplyProducts is idempotent
test('7. seedSupplyProducts skips existing products and only creates missing ones', async () => {
  mock.method(Branch, 'findById', () => Promise.resolve({ _id: branchA, name: 'Test Branch' }));

  // Simulate Laundry Detergent already exists, others are missing
  mock.method(Product, 'findOne', async (query) => {
    const rx = query?.name?.$regex || query?.name;
    if (rx && rx.test && rx.test('Laundry Detergent')) {
      return { _id: id(), name: 'Laundry Detergent', quantity: 100, unit: 'scoop' };
    }
    return null;
  });

  const createdDocs = [];
  mock.method(Product, 'create', async (doc) => {
    createdDocs.push(doc);
    return { _id: id(), ...doc };
  });

  const result = await seedSupplyProducts(branchA);

  assert.equal(result.skippedCount, 1);
  assert.equal(result.createdCount, 5);
  assert.equal(createdDocs.length, 5);
  assert.ok(!createdDocs.some((d) => d.name === 'Laundry Detergent'));
});

// 8. Concurrency for last stock unit: atomic reservation allows 1 and rejects concurrent loser
test('8. Concurrent reservation for last stock unit allows winner and rolls back loser cleanly', async () => {
  const detergentId = id();
  const softenerId = id();
  const nylonId = id();
  const hangerId = id();

  let attempts = 0;

  mock.method(Product, 'findOne', ({ name }) => {
    const rx = name?.$regex || name;
    const n = rx?.source || String(rx);
    if (/detergent/i.test(n)) {
      return Promise.resolve({
        _id: detergentId,
        branch_id: branchA,
        name: 'Laundry Detergent',
        quantity: 10,
        reserved_quantity: 0,
        is_active: true,
      });
    }
    if (/softener/i.test(n)) {
      return Promise.resolve({
        _id: softenerId,
        branch_id: branchA,
        name: 'Fabric Softener',
        quantity: 100,
        reserved_quantity: 0,
        is_active: true,
      });
    }
    if (/nylon/i.test(n)) {
      return Promise.resolve({
        _id: nylonId,
        branch_id: branchA,
        name: 'Packaging Nylon',
        quantity: 100,
        reserved_quantity: 0,
        is_active: true,
      });
    }
    return Promise.resolve({
      _id: hangerId,
      branch_id: branchA,
      name: 'Hanger',
      quantity: 100,
      reserved_quantity: 0,
      is_active: true,
    });
  });

  mock.method(Product, 'findOneAndUpdate', async (filter) => {
    if (String(filter._id) === String(detergentId)) {
      attempts++;
      if (attempts === 1) {
        return { _id: detergentId, name: 'Laundry Detergent', unit: 'scoop', quantity: 10, reserved_quantity: 2 };
      }
      // Simultaneous attempt loses race
      return null;
    }
    return { _id: filter._id, name: 'Other Supply', unit: 'unit', quantity: 100, reserved_quantity: 1 };
  });

  const rollbackMock = mock.method(Product, 'updateOne', async () => ({ modifiedCount: 1 }));
  mock.method(Employee, 'find', () => chain([]));
  mock.method(Notification, 'create', async () => ({}));

  const items = [
    {
      service_id: id(),
      service_name: 'Washing & Folding',
      name: 'Washing & Folding',
      category: 'Laundry',
      type: 'service',
      quantity: 1,
      piece_count: 1,
    },
  ];

  // Request 1: succeeds and reserves supplies
  const reservation1 = await checkAndReserveSuppliesForOrder({
    branch_id: branchA,
    items,
    customer_id: id(),
  });
  assert.ok(reservation1.length > 0);

  // Request 2: concurrent attempt when findOneAndUpdate returns null -> fails with 409
  await assert.rejects(
    checkAndReserveSuppliesForOrder({
      branch_id: branchA,
      items,
      customer_id: id(),
    }),
    (err) => err.statusCode === 409,
  );
});

// 9. Atomic step accept: if workflow save fails, consumed stock and movements are restored
test('9. Attendant step accept rolls back consumed supplies and stock movements if workflow save fails', async () => {
  const employeeUserId = id();
  const employeeId = id();
  const orderId = id();
  const prodId = id();
  const stepId = id();

  const employee = { _id: employeeId, user_id: employeeUserId, branch_id: branchA };
  mock.method(Employee, 'findOne', () => Promise.resolve(employee));

  const prodDoc = {
    _id: prodId,
    name: 'Laundry Detergent',
    unit: 'scoop',
    quantity: 10,
    reserved_quantity: 2,
    save: mock.fn(async function () { return this; }),
  };
  mock.method(Product, 'findById', () => Promise.resolve(prodDoc));

  const updateProductMock = mock.method(Product, 'updateOne', async () => ({ modifiedCount: 1 }));
  const deleteMovementMock = mock.method(StockMovement, 'deleteMany', async () => ({ deletedCount: 1 }));
  mock.method(StockMovement, 'create', async () => [{ _id: id() }]);

  const orderDoc = {
    _id: orderId,
    branch_id: branchA,
    customer_id: id(),
    status: 'received',
    supplies_reserved: [
      { product_id: prodId, name: 'Laundry Detergent', quantity: 2, unit: 'scoop', stage: 'processing', consumed: false },
    ],
    supplies_used: [],
    save: mock.fn(async function () { return this; }),
  };
  mock.method(Order, 'findById', () => Promise.resolve(orderDoc));

  const step = {
    _id: stepId,
    name: 'processing',
    status: 'assigned',
    employee_id: employeeId,
    sequence: 1,
  };

  const workflowDoc = {
    order_id: orderId,
    branch_id: branchA,
    status: 'active',
    steps: Object.assign([step], {
      id: (sId) => (String(sId) === String(stepId) ? step : null),
      some: Array.prototype.some,
      every: Array.prototype.every,
    }),
    save: mock.fn(async () => {
      throw new Error('Database write failure during workflow update');
    }),
    populate: () => Promise.resolve(workflowDoc),
  };
  mock.method(ProcessingWorkflow, 'findById', () => Promise.resolve(workflowDoc));

  const req = {
    user: { id: employeeUserId, role: 'employee', branch_id: branchA },
    params: { id: id(), stepId },
    body: { action: 'accept' },
  };

  await assert.rejects(
    invoke(workflowController.updateStep, req),
    /Database write failure during workflow update/,
  );

  // Verifying rollback happened
  assert.equal(updateProductMock.mock.callCount(), 1);
  assert.equal(deleteMovementMock.mock.callCount(), 1);
  assert.equal(orderDoc.supplies_reserved[0].consumed, false);
  assert.equal(orderDoc.status, 'received');
  assert.equal(step.status, 'assigned');
});
