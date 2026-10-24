// Owner: Josh
// Purpose: Unit tests for catalog item CRUD, copy-from-branch, and supply tier piece sizing.

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import CatalogItem from '../src/models/catalogItem.model.js';
import Service from '../src/models/service.model.js';
import Branch from '../src/models/branch.model.js';
import Order from '../src/models/order.model.js';
import Product from '../src/models/product.model.js';
import Notification from '../src/models/notification.model.js';
import Employee from '../src/models/employee.model.js';
import User from '../src/models/user.model.js';
import LeaveRequest from '../src/models/leaveRequest.model.js';
import ProcessingWorkflow from '../src/models/processingWorkflow.model.js';
import * as catalogController from '../src/controllers/catalogItem.controller.js';
import * as orderController from '../src/controllers/order.controller.js';
import { calculateExpressSurcharge } from '../src/controllers/order.controller.js';
import { getTier, calculateEffectivePieces } from '../src/config/serviceSupplies.config.js';
import { calculateSuppliesForStep } from '../src/services/inventoryConsumption.service.js';
import { env } from '../src/config/env.js';
import { getTopServices } from '../src/services/report.service.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-unit-tests-only';
process.env.REDIS_URL = 'redis://127.0.0.1:1';

afterEach(() => mock.restoreAll());

const id = () => new mongoose.Types.ObjectId().toString();
const branchA = id();
const branchB = id();

const adminUser = { id: id(), role: 'admin' };
const managerBranchA = { id: id(), role: 'branch_manager', branch_id: branchA };
const managerBranchB = { id: id(), role: 'branch_manager', branch_id: branchB };
const customerUser = { id: id(), role: 'customer' };

function invoke(handler, req = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        resolve({ code: this.code, ...body });
      },
    };
    handler({ params: {}, body: {}, query: {}, ...req }, res, reject);
  });
}

const rejectsStatus = (promise, status) =>
  assert.rejects(promise, (error) => error.statusCode === status);

function chain(value, capture = {}) {
  const query = {
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  for (const method of ['select', 'sort', 'skip', 'limit', 'populate', 'lean', 'session']) {
    query[method] = (arg) => {
      capture[method] = arg;
      return query;
    };
  }
  return query;
}

test('GET /catalog-items requires branch_id query parameter', async () => {
  await rejectsStatus(
    invoke(catalogController.getCatalogItems, { query: {} }),
    400,
  );
});

test('GET /catalog-items returns active items and excludes operational/internal fields', async () => {
  const mockItems = [
    {
      _id: id(),
      branch_id: branchA,
      name: 'T-Shirt',
      category: 'Casuals',
      description: 'Cotton shirt',
      piece_count: 1,
      is_active: true,
      services: [
        { service_id: id(), service_name: 'Washing & Folding', price: 800, is_available: true },
      ],
    },
  ];

  const capture = {};
  mock.method(CatalogItem, 'find', (filter) => {
    assert.equal(filter.branch_id, branchA);
    assert.equal(filter.is_active, true);
    return chain(mockItems, capture);
  });

  const res = await invoke(catalogController.getCatalogItems, {
    query: { branch_id: branchA },
  });

  assert.equal(res.code, 200);
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].name, 'T-Shirt');
  assert.equal(capture.select, 'branch_id name category description piece_count is_active services');
});

test('POST /catalog-items creates a catalog item for branch manager in own branch', async () => {
  const serviceId1 = id();
  mock.method(CatalogItem, 'findOne', async () => null);
  mock.method(Service, 'find', () =>
    chain([
      { _id: new mongoose.Types.ObjectId(serviceId1), name: 'Washing & Folding', is_active: true },
    ]),
  );

  const createdDoc = {
    _id: id(),
    branch_id: branchA,
    name: 'Jeans',
    category: 'Casuals',
    piece_count: 1,
    services: [
      { service_id: serviceId1, service_name: 'Washing & Folding', price: 1500, is_available: true },
    ],
    is_active: true,
  };
  mock.method(CatalogItem, 'create', async (data) => ({ ...data, _id: id() }));

  const res = await invoke(catalogController.createCatalogItem, {
    user: managerBranchA,
    body: {
      branch_id: branchA,
      name: 'Jeans',
      category: 'Casuals',
      piece_count: 1,
      services: [
        { service_name: 'Washing & Folding', price: 1500 },
      ],
    },
  });

  assert.equal(res.code, 201);
  assert.equal(res.data.name, 'Jeans');
  assert.equal(res.data.piece_count, 1);
});

test('POST /catalog-items forbids branch manager from creating items in foreign branch', async () => {
  await rejectsStatus(
    invoke(catalogController.createCatalogItem, {
      user: managerBranchA,
      body: {
        branch_id: branchB,
        name: 'Jeans',
        category: 'Casuals',
        services: [{ service_name: 'Washing & Folding', price: 1000 }],
      },
    }),
    403,
  );
});

test('POST /catalog-items rejects duplicate name in same branch', async () => {
  mock.method(CatalogItem, 'findOne', async () => ({ _id: id(), name: 'T-Shirt' }));

  await rejectsStatus(
    invoke(catalogController.createCatalogItem, {
      user: adminUser,
      body: {
        branch_id: branchA,
        name: 'T-Shirt',
        category: 'Casuals',
        services: [{ service_name: 'Washing & Folding', price: 1000 }],
      },
    }),
    409,
  );
});

test('DELETE /catalog-items is a soft delete (is_active: false)', async () => {
  const itemId = id();
  let savedActive = true;
  mock.method(CatalogItem, 'findById', async () => ({
    _id: itemId,
    branch_id: branchA,
    is_active: true,
    save: async function () {
      savedActive = this.is_active;
    },
  }));

  const res = await invoke(catalogController.deleteCatalogItem, {
    user: managerBranchA,
    params: { id: itemId },
  });

  assert.equal(res.code, 200);
  assert.equal(savedActive, false);
  assert.equal(res.data.is_active, false);
});

test('POST /catalog-items/copy-from-branch is admin only', async () => {
  await rejectsStatus(
    invoke(catalogController.copyFromBranch, {
      user: managerBranchA,
      body: { source_branch_id: branchA, target_branch_id: branchB },
    }),
    403,
  );
});

test('POST /catalog-items/copy-from-branch requires target branch to have all 5 core services', async () => {
  mock.method(Branch, 'findById', async (branchId) => ({ _id: branchId, name: 'Branch Name' }));
  // Missing 'Dry Cleaning & Pressing'
  mock.method(Service, 'find', () =>
    chain([
      { name: 'Washing & Folding', is_active: true },
      { name: 'Washing & Ironing', is_active: true },
      { name: 'Ironing', is_active: true },
      { name: 'Dry Cleaning', is_active: true },
    ]),
  );

  await assert.rejects(
    invoke(catalogController.copyFromBranch, {
      user: adminUser,
      body: { source_branch_id: branchA, target_branch_id: branchB },
    }),
    (err) => err.statusCode === 400 && err.message.includes('Dry Cleaning & Pressing'),
  );
});

test('POST /catalog-items/copy-from-branch remaps service_id by name and skips duplicate names', async () => {
  mock.method(Branch, 'findById', async (branchId) => ({ _id: branchId, name: `Branch ${branchId}` }));

  const targetServices = [
    { _id: new mongoose.Types.ObjectId(), name: 'Washing & Folding', is_active: true },
    { _id: new mongoose.Types.ObjectId(), name: 'Washing & Ironing', is_active: true },
    { _id: new mongoose.Types.ObjectId(), name: 'Ironing', is_active: true },
    { _id: new mongoose.Types.ObjectId(), name: 'Dry Cleaning', is_active: true },
    { _id: new mongoose.Types.ObjectId(), name: 'Dry Cleaning & Pressing', is_active: true },
  ];
  mock.method(Service, 'find', () => chain(targetServices));

  // Source items: T-Shirt (exists in target) and Formal Shirt (new to target)
  const sourceItems = [
    {
      name: 'T-Shirt',
      category: 'Casuals',
      piece_count: 1,
      services: [{ service_name: 'Washing & Folding', price: 800, is_available: true }],
    },
    {
      name: 'Formal Shirt',
      category: 'Corporate Wear',
      piece_count: 1,
      services: [{ service_name: 'Washing & Folding', price: 1200, is_available: true }],
    },
  ];

  let findCallCount = 0;
  mock.method(CatalogItem, 'find', (query) => {
    findCallCount++;
    if (query.branch_id === branchA) {
      return chain(sourceItems);
    }
    // Existing items in target branch
    return chain([{ name: 'T-Shirt' }]);
  });

  let insertedDocs = [];
  mock.method(CatalogItem, 'insertMany', async (docs) => {
    insertedDocs = docs;
    return docs;
  });

  const res = await invoke(catalogController.copyFromBranch, {
    user: adminUser,
    body: { source_branch_id: branchA, target_branch_id: branchB },
  });

  assert.equal(res.code, 200);
  assert.equal(res.data.copied_count, 1);
  assert.equal(res.data.skipped_count, 1);
  assert.deepEqual(res.data.skipped, ['T-Shirt']);
  assert.deepEqual(res.data.copied, ['Formal Shirt']);
  assert.equal(insertedDocs.length, 1);
  assert.equal(insertedDocs[0].name, 'Formal Shirt');
  assert.equal(String(insertedDocs[0].services[0].service_id), String(targetServices[0]._id));
});

test('getTier supply scaling with piece_count multiplier', () => {
  // getTier: small <= 5, medium <= 10, large > 10
  // Standard item with piece_count = 1:
  assert.equal(getTier(calculateEffectivePieces(1, 1)), 'small');
  assert.equal(getTier(calculateEffectivePieces(5, 1)), 'small');
  assert.equal(getTier(calculateEffectivePieces(6, 1)), 'medium');
  assert.equal(getTier(calculateEffectivePieces(10, 1)), 'medium');
  assert.equal(getTier(calculateEffectivePieces(11, 1)), 'large');

  // King Duvet with piece_count = 3:
  // 1 King Duvet = 3 effective pieces -> small tier
  assert.equal(getTier(calculateEffectivePieces(1, 3)), 'small');

  // 2 King Duvets = 6 effective pieces -> medium tier
  assert.equal(getTier(calculateEffectivePieces(2, 3)), 'medium');

  // 3 King Duvets = 9 effective pieces -> medium tier
  assert.equal(getTier(calculateEffectivePieces(3, 3)), 'medium');

  // 4 King Duvets = 12 effective pieces -> large tier
  assert.equal(getTier(calculateEffectivePieces(4, 3)), 'large');
});

test('GET /orders/pricing-config returns express surcharge percent from env', async () => {
  const res = await invoke(orderController.getPricingConfig);
  assert.equal(res.code, 200);
  assert.equal(res.data.express_surcharge_percent, env.expressSurchargePercent);
});

test('calculateExpressSurcharge returns configured percentage for express, 0 for standard', () => {
  assert.equal(calculateExpressSurcharge(10000, 'standard'), 0);
  assert.equal(calculateExpressSurcharge(10000, 'express'), 3000);
  assert.equal(calculateExpressSurcharge(1550, 'express'), 465);
});

test('createOrder returns 400 when catalog_item_id is missing', async () => {
  mock.method(Order, 'findOne', () => chain(null));
  await rejectsStatus(
    invoke(orderController.createOrder, {
      user: customerUser,
      body: {
        branch_id: branchA,
        items: [{ service_id: id(), quantity: 1 }],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    400,
  );
});

test('createOrder rejects duplicate item and service line with 400', async () => {
  const catalogItemId = id();
  const serviceId = id();
  mock.method(Order, 'findOne', () => chain(null));
  mock.method(CatalogItem, 'findOne', async () => ({
    _id: catalogItemId,
    name: 'Shirt',
    category: 'Tops',
    piece_count: 1,
    services: [{ service_id: serviceId, price: 1000, is_available: true }],
  }));
  mock.method(Service, 'findById', async () => ({
    _id: serviceId,
    name: 'Ironing',
    is_active: true,
    branch_id: branchA,
    turnaround_hours: 12,
  }));
  await rejectsStatus(
    invoke(orderController.createOrder, {
      user: customerUser,
      body: {
        branch_id: branchA,
        items: [
          { catalog_item_id: catalogItemId, service_id: serviceId, quantity: 1 },
          { catalog_item_id: catalogItemId, service_id: serviceId, quantity: 2 },
        ],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    400,
  );
});

test('createOrder rejects service unavailable for garment with 400', async () => {
  const catalogItemId = id();
  const serviceId = id();
  mock.method(Order, 'findOne', () => chain(null));
  mock.method(CatalogItem, 'findOne', async () => ({
    _id: catalogItemId,
    name: 'Silk Blouse',
    category: 'Tops',
    services: [
      { service_id: serviceId, price: 1200, is_available: false },
    ],
  }));

  await rejectsStatus(
    invoke(orderController.createOrder, {
      user: customerUser,
      body: {
        branch_id: branchA,
        items: [{ catalog_item_id: catalogItemId, service_id: serviceId, quantity: 1 }],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    400,
  );
});

test('createOrder ignores client-tampered price and uses CatalogItem verified price', async () => {
  const catalogItemId = id();
  const serviceId = id();
  mock.method(Order, 'findOne', () => chain(null));
  mock.method(CatalogItem, 'findOne', async () => ({
    _id: catalogItemId,
    name: 'Suit Jacket',
    category: 'Formal',
    piece_count: 2,
    services: [
      { service_id: serviceId, price: 3500, is_available: true },
    ],
  }));
  mock.method(Service, 'findById', async () => ({
    _id: serviceId,
    name: 'Dry Cleaning',
    category: 'Dry Cleaning',
    price: 99999,
    is_active: true,
    branch_id: branchA,
    type: 'service',
    turnaround_hours: 48,
  }));
  mock.method(Product, 'findOne', async () => ({
    _id: id(),
    name: 'Dry Cleaning Solvent',
    quantity: 100,
    reserved_quantity: 0,
    is_active: true,
    unit: 'ml',
  }));
  mock.method(Product, 'findOneAndUpdate', async () => ({
    _id: id(),
    quantity: 100,
    reserved_quantity: 1,
  }));
  let createdOrderDoc = null;
  mock.method(Order, 'create', async (doc) => {
    createdOrderDoc = { _id: id(), ...doc };
    return createdOrderDoc;
  });
  mock.method(Branch, 'findById', () => chain({ name: 'Branch A' }));
  mock.method(Notification, 'create', async () => ({}));
  mock.method(User, 'find', () => chain([]));
  mock.method(Employee, 'find', () => chain([]));

  // Client attempts to send unit_price: 10, subtotal: 20
  const res = await invoke(orderController.createOrder, {
    user: customerUser,
    body: {
      branch_id: branchA,
      items: [
        {
          catalog_item_id: catalogItemId,
          service_id: serviceId,
          quantity: 2,
          unit_price: 10,
          subtotal: 20,
        },
      ],
      pickup_time: new Date(Date.now() + 86400000).toISOString(),
    },
  });

  assert.equal(res.code, 201);
  assert.equal(createdOrderDoc.total_price, 7000); // 3500 * 2
  assert.equal(createdOrderDoc.amount_due, 7000);
  assert.equal(createdOrderDoc.items[0].unit_price, 3500);
  assert.equal(createdOrderDoc.items[0].subtotal, 7000);
  assert.equal(createdOrderDoc.items[0].name, 'Dry Cleaning'); // Service name
  assert.equal(createdOrderDoc.items[0].item_name, 'Suit Jacket'); // Garment name
  assert.equal(createdOrderDoc.items[0].piece_count, 2);
});

test('createOrder respects turnaround logic: longest regular service for standard, 24h for express', async () => {
  const catalogItemId = id();
  const service1Id = id();
  const service2Id = id();

  const pickupTime = new Date(Date.now() + 24 * 3600 * 1000);

  mock.method(Order, 'findOne', () => chain(null));
  mock.method(CatalogItem, 'findOne', async () => ({
    _id: catalogItemId,
    name: 'Dress',
    category: 'Casuals',
    piece_count: 1,
    services: [
      { service_id: service1Id, price: 1000, is_available: true },
      { service_id: service2Id, price: 2000, is_available: true },
    ],
  }));
  mock.method(Service, 'findById', async (serviceId) => {
    if (String(serviceId) === String(service1Id)) {
      return {
        _id: service1Id,
        name: 'Ironing',
        category: 'Ironing',
        is_active: true,
        branch_id: branchA,
        type: 'service',
        turnaround_hours: 12,
      };
    }
    return {
      _id: service2Id,
      name: 'Washing & Folding',
      category: 'Laundry',
      is_active: true,
      branch_id: branchA,
      type: 'service',
      turnaround_hours: 36, // Longest
    };
  });
  mock.method(Product, 'findOne', async () => ({
    _id: id(),
    name: 'Laundry Detergent',
    quantity: 100,
    reserved_quantity: 0,
    is_active: true,
    unit: 'scoop',
  }));
  mock.method(Product, 'findOneAndUpdate', async () => ({
    _id: id(),
    quantity: 100,
    reserved_quantity: 1,
  }));
  let createdDocs = [];
  mock.method(Order, 'create', async (doc) => {
    createdDocs.push(doc);
    return { _id: id(), ...doc };
  });
  mock.method(Branch, 'findById', () => chain({ name: 'Branch A' }));
  mock.method(Notification, 'create', async () => ({}));
  mock.method(User, 'find', () => chain([]));
  mock.method(Employee, 'find', () => chain([]));

  // 1. Normal priority: should use longest turnaround (36 hours)
  const resStd = await invoke(orderController.createOrder, {
    user: customerUser,
    body: {
      branch_id: branchA,
      priority: 'normal',
      items: [
        { catalog_item_id: catalogItemId, service_id: service1Id, quantity: 1 },
        { catalog_item_id: catalogItemId, service_id: service2Id, quantity: 1 },
      ],
      pickup_time: pickupTime.toISOString(),
    },
  });
  assert.equal(resStd.code, 201);
  const stdDoc = createdDocs[0];
  const expectedStdDelivery = new Date(pickupTime.getTime() + 36 * 3600 * 1000);
  assert.equal(stdDoc.delivery_time.getTime(), expectedStdDelivery.getTime());
  assert.equal(stdDoc.express_surcharge, 0);

  // 2. Express priority: should use fixed 24 hours turnaround and apply 30% surcharge
  const resExp = await invoke(orderController.createOrder, {
    user: customerUser,
    body: {
      branch_id: branchA,
      priority: 'express',
      items: [
        { catalog_item_id: catalogItemId, service_id: service1Id, quantity: 1 },
        { catalog_item_id: catalogItemId, service_id: service2Id, quantity: 1 },
      ],
      pickup_time: pickupTime.toISOString(),
    },
  });
  assert.equal(resExp.code, 201);
  const expDoc = createdDocs[1];
  const expectedExpDelivery = new Date(pickupTime.getTime() + 24 * 3600 * 1000);
  assert.equal(expDoc.delivery_time.getTime(), expectedExpDelivery.getTime());
  assert.equal(expDoc.total_price, 3000);
  assert.equal(expDoc.express_surcharge, 900); // 30% of 3000
  assert.equal(expDoc.amount_due, 3900);
});

test('calculateSuppliesForStep scales supplies with piece_count for both tiered and perUnit recipes', () => {
  // 1. Tiered recipe: Washing & Folding (category: Laundry, step: washing)
  // small (<=5): 1 scoop detergent
  // medium (6-10): 2 scoops detergent
  // Single King Duvet with piece_count: 3 and quantity: 2 -> effectivePieces = 6 -> medium tier
  const tieredOrder = {
    items: [
      {
        name: 'Washing & Folding',
        category: 'Laundry',
        type: 'service',
        quantity: 2,
        piece_count: 3,
      },
    ],
  };
  const washingSupplies = calculateSuppliesForStep({
    order: tieredOrder,
    stepName: 'washing',
  });
  const detergent = washingSupplies.find((s) => s.productName === 'Laundry Detergent');
  assert.equal(detergent?.quantity, 2);

  // 2. Tiered recipe: Dry Cleaning (category: Dry Cleaning, step: processing)
  // 3-piece suit (piece_count: 3) with quantity: 2 -> 6 effective pieces -> medium tier (2 units)
  const dcOrder = {
    items: [
      {
        name: 'Dry Cleaning',
        category: 'Dry Cleaning',
        type: 'service',
        quantity: 2,
        piece_count: 3,
      },
    ],
  };
  const dcSupplies = calculateSuppliesForStep({
    order: dcOrder,
    stepName: 'processing',
  });
  const solvent = dcSupplies.find((s) => s.productName === 'Dry Cleaning Solvent');
  assert.equal(solvent?.quantity, 2);

  // 3. Packaging step: DEFAULT_PACKAGING_PER_UNIT = 1 per effective piece
  // 2 items * 3 piece_count = 6 effective pieces -> 6 packaging nylon and 6 hangers
  const pkgSupplies = calculateSuppliesForStep({
    order: dcOrder,
    stepName: 'packaging',
  });
  const nylon = pkgSupplies.find((s) => s.productName === 'Packaging Nylon');
  const hanger = pkgSupplies.find((s) => s.productName === 'Hanger');
  assert.equal(nylon?.quantity, 6);
  assert.equal(hanger?.quantity, 6);
});

test('updateOrder intake correction adjusts quantities, recalculates totals & express surcharge, and notifies customer', async () => {
  const orderId = id();
  const customerId = id();
  const staffUserId = id();
  const employeeId = id();

  let savedOrder = null;
  const mockOrder = {
    _id: orderId,
    customer_id: customerId,
    branch_id: branchA,
    status: 'placed',
    priority: 'express',
    total_price: 3000,
    express_surcharge: 900,
    amount_due: 3900,
    supplies_reserved: [{ product_id: id(), quantity: 1, unit: 'scoop' }],
    items: [
      {
        toObject: () => ({
          service_id: id(),
          name: 'Washing & Folding',
          category: 'Laundry',
          catalog_item_id: id(),
          item_name: 'Shirt',
          piece_count: 1,
          quantity: 2,
          unit_price: 1500,
          subtotal: 3000,
        }),
        unit_price: 1500,
        quantity: 2,
        subtotal: 3000,
      },
    ],
    save: async function () {
      savedOrder = this;
    },
    populate: async function (paths) {
      if (Array.isArray(paths)) {
        for (const p of paths) {
          if (p.path === 'customer_id') {
            this.customer_id = {
              _id: customerId,
              name: 'Amina Bello',
              email: 'amina@example.com',
              phone: '08012345678',
              address: 'Jabi, Abuja',
            };
          }
          if (p.path === 'branch_id') {
            this.branch_id = {
              _id: branchA,
              name: 'Jabi Branch',
              address: 'Jabi District',
              phone: '08098765432',
            };
          }
        }
      }
      return this;
    },
  };

  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: employeeId, user_id: staffUserId }));
  mock.method(Product, 'findOne', async () => ({
    _id: id(),
    name: 'Laundry Detergent',
    quantity: 100,
    reserved_quantity: 1,
    is_active: true,
  }));
  mock.method(Product, 'findOneAndUpdate', async () => ({
    _id: id(),
    quantity: 100,
    reserved_quantity: 2,
  }));
  mock.method(Product, 'updateOne', async () => ({}));
  mock.method(Employee, 'find', () => chain([]));
  mock.method(LeaveRequest, 'find', () => chain([]));
  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));
  mock.method(ProcessingWorkflow, 'create', async () => ({ steps: [] }));
  const notifCreated = [];
  mock.method(Notification, 'create', async (doc) => {
    notifCreated.push(doc);
    return doc;
  });

  const staffUser = { id: staffUserId, role: 'front_desk', branch_id: branchA };
  const res = await invoke(orderController.updateOrder, {
    user: staffUser,
    params: { id: orderId },
    body: {
      status: 'received',
      intake_notes: 'Count adjusted at counter',
      intake_items: [{ quantity: 3 }],
    },
  });

  assert.equal(res.code, 200);
  assert.equal(savedOrder.status, 'received');
  assert.equal(savedOrder.total_price, 4500); // 3 * 1500
  assert.equal(savedOrder.express_surcharge, 1350); // 30% of 4500
  assert.equal(savedOrder.amount_due, 5850);
  assert.equal(savedOrder.items[0].quantity, 3);
  assert.equal(savedOrder.intake.original_items.length, 1);
  assert.equal(savedOrder.intake.notes, 'Count adjusted at counter');
  assert.equal(notifCreated.length, 1);
  assert.equal(String(notifCreated[0].user_id), customerId);
  assert(notifCreated[0].message.includes('5,850'));
  assert.equal(res.data.customer_id.name, 'Amina Bello');
  assert.equal(res.data.customer_id.phone, '08012345678');
  assert.equal(res.data.branch_id.name, 'Jabi Branch');
  assert.equal(res.data.branch_id.address, 'Jabi District');
});

test('updateOrder intake correction rejects with 409 when increasing quantity exceeds available stock', async () => {
  const orderId = id();
  const staffUserId = id();

  const mockOrder = {
    _id: orderId,
    customer_id: id(),
    branch_id: branchA,
    status: 'placed',
    priority: 'standard',
    total_price: 1500,
    express_surcharge: 0,
    amount_due: 1500,
    supplies_reserved: [{ product_id: id(), quantity: 1, unit: 'scoop' }],
    items: [
      {
        toObject: () => ({
          service_id: id(),
          name: 'Washing & Folding',
          category: 'Laundry',
          catalog_item_id: id(),
          item_name: 'Shirt',
          piece_count: 1,
          quantity: 1,
          unit_price: 1500,
          subtotal: 1500,
        }),
        unit_price: 1500,
        quantity: 1,
        subtotal: 1500,
      },
    ],
  };

  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: id(), user_id: staffUserId }));
  // Stock is depleted: quantity 1, reserved 1 -> 0 available
  mock.method(Product, 'findOne', async () => ({
    _id: id(),
    name: 'Laundry Detergent',
    quantity: 1,
    reserved_quantity: 1,
    is_active: true,
    unit: 'scoop',
  }));
  mock.method(Product, 'findOneAndUpdate', async () => null);
  mock.method(Product, 'updateOne', async () => ({}));
  mock.method(Notification, 'create', async () => ({}));
  mock.method(User, 'find', () => chain([]));
  mock.method(Employee, 'find', () => chain([]));

  const staffUser = { id: staffUserId, role: 'front_desk', branch_id: branchA };
  await rejectsStatus(
    invoke(orderController.updateOrder, {
      user: staffUser,
      params: { id: orderId },
      body: {
        status: 'received',
        intake_items: [{ quantity: 5 }],
      },
    }),
    409,
  );
});

test('report.service getTopServices regression: aggregates by items.service_id with items.name as service name', async () => {
  const serviceId1 = id();
  const expectedReport = [
    {
      _id: serviceId1,
      name: 'Washing & Folding',
      count: 15,
      revenue: 22500,
    },
  ];

  mock.method(Order, 'aggregate', async (pipeline) => {
    const groupStage = pipeline.find((s) => s.$group);
    assert.equal(groupStage.$group._id, '$items.service_id');
    assert.equal(groupStage.$group.name.$first, '$items.name');
    return expectedReport;
  });

  const res = await getTopServices({ branch_id: branchA });
  assert.equal(res.length, 1);
  assert.equal(res[0].name, 'Washing & Folding');
  assert.equal(res[0].count, 15);
  assert.equal(res[0].revenue, 22500);
});

test('intake verification: atomically rolls back stock reservation and leaves order unchanged when notification fails', async () => {
  const orderId = id();
  const staffUserId = id();
  const productId = id();

  const originalItems = [
    {
      toObject: () => ({
        service_id: id(),
        name: 'Washing & Folding',
        category: 'Laundry',
        catalog_item_id: id(),
        item_name: 'Shirt',
        piece_count: 1,
        quantity: 1,
        unit_price: 1500,
        subtotal: 1500,
      }),
      unit_price: 1500,
      quantity: 1,
      subtotal: 1500,
    },
  ];

  const detergentId = id();
  const originalSupplies = [
    {
      product_id: detergentId,
      name: 'Laundry Detergent',
      quantity: 1,
      unit: 'scoop',
      stage: 'washing',
      consumed: false,
      toObject: () => ({
        product_id: detergentId,
        name: 'Laundry Detergent',
        quantity: 1,
        unit: 'scoop',
        stage: 'washing',
        consumed: false,
      }),
    },
  ];

  let orderSaved = false;
  const mockOrder = {
    _id: orderId,
    customer_id: id(),
    branch_id: branchA,
    status: 'placed',
    priority: 'standard',
    total_price: 1500,
    express_surcharge: 0,
    amount_due: 1500,
    supplies_reserved: [...originalSupplies],
    items: [...originalItems],
    save: async () => {
      orderSaved = true;
      return mockOrder;
    },
  };

  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: id(), user_id: staffUserId }));

  mock.method(Product, 'findOne', async (query) => {
    const raw = query?.name?.$regex || query?.name || '';
    const nameStr = raw instanceof RegExp ? raw.source : String(raw);
    if (/laundry detergent/i.test(nameStr)) {
      return {
        _id: detergentId,
        name: 'Laundry Detergent',
        quantity: 10,
        reserved_quantity: 1,
        is_active: true,
        unit: 'scoop',
      };
    }
    return null;
  });

  const findOneAndUpdateCalls = [];
  mock.method(Product, 'findOneAndUpdate', async (query, update) => {
    findOneAndUpdateCalls.push({ query, update });
    return {
      _id: detergentId,
      name: 'Laundry Detergent',
      quantity: 10,
      reserved_quantity: 2,
      unit: 'scoop',
    };
  });

  const updateOneCalls = [];
  mock.method(Product, 'updateOne', async (query, update) => {
    updateOneCalls.push({ query, update });
    return { modifiedCount: 1 };
  });

  // Simulate notification failure
  mock.method(Notification, 'create', async () => {
    throw new Error('Notification creation failed unexpectedly');
  });

  const staffUser = { id: staffUserId, role: 'front_desk', branch_id: branchA };

  await assert.rejects(
    invoke(orderController.updateOrder, {
      user: staffUser,
      params: { id: orderId },
      body: {
        status: 'received',
        intake_items: [{ quantity: 8 }],
      },
    }),
    /Notification creation failed unexpectedly/,
  );

  // Check that findOneAndUpdate initially reserved delta (+1)
  assert.equal(findOneAndUpdateCalls.length, 1);
  assert.equal(findOneAndUpdateCalls[0].update.$inc.reserved_quantity, 1);

  // Check that rollback occurred via updateOne to decrement reserved_quantity by delta (-1)
  assert.equal(updateOneCalls.length, 1);
  assert.equal(updateOneCalls[0].update.$inc.reserved_quantity, -1);

  // Order in-memory and in db was NOT saved
  assert.equal(orderSaved, false);
  assert.equal(mockOrder.status, 'placed');
  assert.equal(mockOrder.items[0].quantity, 1);
  assert.equal(mockOrder.total_price, 1500);
  assert.equal(mockOrder.amount_due, 1500);
  assert.equal(mockOrder.intake, undefined);
});

test('notification schema: every notification type used in codebase is valid against the real Notification schema', () => {
  const typesUsedInCode = [
    'order_received',
    'order_confirmed',
    'order_cancelled',
    'inspecting',
    'processing',
    'payment_failed',
    'payment_successful',
    'payment_overpaid',
    'payment_refunded',
    'order_ready',
    'order_sent_out',
    'order_delivered',
    'task_assigned',
    'welcome',
    'supply_requested',
    'supply_approved',
    'supply_rejected',
    'branch_digest',
    'other',
  ];

  for (const type of typesUsedInCode) {
    const doc = new Notification({
      user_id: new mongoose.Types.ObjectId(),
      type,
      message: `Test notification for ${type}`,
    });
    const err = doc.validateSync();
    assert.equal(err, undefined, `Notification type "${type}" should be valid in Notification schema`);
  }

  // Ensure invalid type like 'order_status' is indeed rejected by the real schema
  const invalidDoc = new Notification({
    user_id: new mongoose.Types.ObjectId(),
    type: 'order_status',
    message: 'Invalid notification test',
  });
  const invalidErr = invalidDoc.validateSync();
  assert.ok(invalidErr, 'order_status must fail schema validation');
  assert.ok(invalidErr.errors.type, 'order_status must fail on type field');
});

test('customer notifications never contain product names during shortage in order creation or intake', async () => {
  const customerUserId = id();
  const branchManagerId = id();
  const officerId = id();
  const serviceId = id();
  const catalogItemId = id();
  const sensitiveProductName = 'Packaging Nylon';

  mock.method(Order, 'findOne', () => chain(null));
  mock.method(CatalogItem, 'findOne', async () => ({
    _id: catalogItemId,
    name: 'T-Shirt',
    category: 'Tops',
    piece_count: 1,
    is_active: true,
    services: [{ service_id: serviceId, price: 1000, is_available: true }],
  }));
  mock.method(Service, 'findById', async () => ({
    _id: serviceId,
    name: 'Washing & Folding',
    price: 1000,
    is_active: true,
    branch_id: branchA,
    type: 'service',
    turnaround_hours: 24,
  }));
  mock.method(Product, 'findOne', async () => ({
    _id: id(),
    name: sensitiveProductName,
    quantity: 0,
    reserved_quantity: 0,
    is_active: true,
    unit: 'roll',
  }));
  mock.method(Employee, 'find', () =>
    chain([{ user_id: branchManagerId }, { user_id: officerId }]),
  );
  mock.method(User, 'find', () =>
    chain([
      { _id: branchManagerId, role: 'branch_manager' },
      { _id: officerId, role: 'inventory_officer' },
    ]),
  );

  const notificationsCreated = [];
  mock.method(Notification, 'create', async (doc) => {
    notificationsCreated.push(doc);
    return doc;
  });

  // Attempt creating an order when Packaging Nylon is out of stock
  await rejectsStatus(
    invoke(orderController.createOrder, {
      user: { role: 'customer', id: customerUserId },
      body: {
        branch_id: branchA,
        items: [{ catalog_item_id: catalogItemId, service_id: serviceId, quantity: 1 }],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    409,
  );

  const customerNotifs = notificationsCreated.filter(
    (n) => String(n.user_id) === String(customerUserId),
  );
  const staffNotifs = notificationsCreated.filter(
    (n) => String(n.user_id) !== String(customerUserId),
  );

  assert(customerNotifs.length > 0, 'Customer should receive shortage notification');
  for (const cn of customerNotifs) {
    // MUST FAIL if customer notification message contains the product name
    assert.ok(
      !cn.message.includes(sensitiveProductName),
      `Customer notification message must never contain product name "${sensitiveProductName}": "${cn.message}"`,
    );
    assert.ok(
      !cn.message.includes('Laundry Detergent') && !cn.message.includes('Solvent'),
      `Customer notification message must not contain any product names: "${cn.message}"`,
    );
    assert.ok(
      cn.message.includes('required supplies are temporarily out of stock'),
      `Customer notification message should be generic: "${cn.message}"`,
    );
  }

  assert(staffNotifs.length > 0, 'Staff should receive detailed alert');
  for (const sn of staffNotifs) {
    assert.ok(
      sn.message.includes(sensitiveProductName),
      `Staff notification message must contain product detail: "${sn.message}"`,
    );
  }
});

test('updateOrder returns populated customer_id and branch_id matching getOrderById', async () => {
  const orderId = id();
  const customerId = id();
  const staffUserId = id();
  const employeeId = id();

  let populatedPaths = null;
  const mockOrder = {
    _id: orderId,
    customer_id: customerId,
    branch_id: branchA,
    status: 'placed',
    priority: 'standard',
    total_price: 2000,
    express_surcharge: 0,
    amount_due: 2000,
    supplies_reserved: [],
    items: [
      {
        toObject: () => ({
          service_id: id(),
          name: 'Ironing',
          catalog_item_id: id(),
          item_name: 'Polo Shirt',
          piece_count: 1,
          quantity: 2,
          unit_price: 1000,
          subtotal: 2000,
        }),
        unit_price: 1000,
        quantity: 2,
        subtotal: 2000,
      },
    ],
    save: async function () {
      return this;
    },
    populate: async function (paths) {
      populatedPaths = paths;
      this.customer_id = {
        _id: customerId,
        name: 'Musa YarAdua',
        email: 'musa@example.com',
        phone: '08031234567',
        address: '15 Adetokunbo Ademola Crescent',
      };
      this.branch_id = {
        _id: branchA,
        name: 'Wuse Branch',
        address: 'Wuse II, Abuja',
        phone: '08091112233',
      };
      return this;
    },
  };

  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: employeeId, user_id: staffUserId }));
  mock.method(Product, 'findOne', async () => ({
    _id: id(),
    name: 'Packaging Nylon',
    quantity: 100,
    reserved_quantity: 1,
    is_active: true,
  }));
  mock.method(Product, 'findOneAndUpdate', async () => ({
    _id: id(),
    quantity: 100,
    reserved_quantity: 2,
  }));
  mock.method(Product, 'updateOne', async () => ({}));
  mock.method(Employee, 'find', () => chain([]));
  mock.method(LeaveRequest, 'find', () => chain([]));
  mock.method(ProcessingWorkflow, 'findOne', () => chain(null));
  mock.method(ProcessingWorkflow, 'create', async () => ({ steps: [] }));
  mock.method(Notification, 'create', async () => ({}));

  const staffUser = { id: staffUserId, role: 'front_desk', branch_id: branchA };
  const res = await invoke(orderController.updateOrder, {
    user: staffUser,
    params: { id: orderId },
    body: {
      status: 'received',
      intake_items: [{ quantity: 2 }],
      intake_notes: 'Confirmed count',
    },
  });

  assert.equal(res.code, 200);
  assert.ok(populatedPaths, 'order.populate must be invoked');
  const pathNames = populatedPaths.map((p) => p.path);
  assert.ok(pathNames.includes('customer_id'), 'must populate customer_id');
  assert.ok(pathNames.includes('branch_id'), 'must populate branch_id');

  // Verify response fields are populated objects, not raw IDs
  assert.equal(typeof res.data.customer_id, 'object');
  assert.equal(res.data.customer_id.name, 'Musa YarAdua');
  assert.equal(res.data.customer_id.email, 'musa@example.com');
  assert.equal(res.data.customer_id.phone, '08031234567');
  assert.equal(res.data.customer_id.address, '15 Adetokunbo Ademola Crescent');

  assert.equal(typeof res.data.branch_id, 'object');
  assert.equal(res.data.branch_id.name, 'Wuse Branch');
  assert.equal(res.data.branch_id.address, 'Wuse II, Abuja');
  assert.equal(res.data.branch_id.phone, '08091112233');
});

test('intake correction that fails on the 3rd product leaves every product reserved_quantity and order.supplies_reserved unchanged', async () => {
  const orderId = id();
  const staffUserId = id();
  const prod1Id = id();
  const prod2Id = id();
  const prod3Id = id();
  const prod4Id = id();

  const originalSupplies = [
    { product_id: prod1Id, name: 'Laundry Detergent', quantity: 1, unit: 'scoop', stage: 'washing', consumed: false },
    { product_id: prod2Id, name: 'Fabric Softener', quantity: 1, unit: 'cap', stage: 'washing', consumed: false },
    { product_id: prod3Id, name: 'Packaging Nylon', quantity: 1, unit: 'pieces', stage: 'packaging', consumed: false },
    { product_id: prod4Id, name: 'Hanger', quantity: 1, unit: 'pieces', stage: 'packaging', consumed: false },
  ];

  const mockOrder = {
    _id: orderId,
    customer_id: id(),
    branch_id: branchA,
    status: 'placed',
    priority: 'standard',
    total_price: 1500,
    express_surcharge: 0,
    amount_due: 1500,
    supplies_reserved: JSON.parse(JSON.stringify(originalSupplies)),
    items: [
      {
        toObject: () => ({
          service_id: id(),
          type: 'service',
          name: 'Washing & Folding',
          category: 'Laundry',
          catalog_item_id: id(),
          item_name: 'Shirt',
          piece_count: 1,
          quantity: 1,
          unit_price: 1500,
          subtotal: 1500,
        }),
        type: 'service',
        name: 'Washing & Folding',
        category: 'Laundry',
        unit_price: 1500,
        quantity: 1,
        subtotal: 1500,
      },
    ],
    save: async function () {
      return this;
    },
    populate: async function () {
      return this;
    },
  };

  mock.method(Order, 'findById', async () => mockOrder);
  mock.method(Employee, 'findOne', async () => ({ _id: id(), user_id: staffUserId }));
  mock.method(Notification, 'create', async () => ({}));
  mock.method(User, 'find', () => chain([]));
  mock.method(Employee, 'find', () => chain([]));

  // Product 1, 2, 4 have ample stock; Product 3 (Packaging Nylon) is short (only 1 available, but need 500)
  mock.method(Product, 'findOne', async (query) => {
    const raw = query?.name?.$regex || query?.name || '';
    const nameStr = raw instanceof RegExp ? raw.source : String(raw);
    if (/laundry detergent/i.test(nameStr)) {
      return { _id: prod1Id, name: 'Laundry Detergent', quantity: 100, reserved_quantity: 10, is_active: true, unit: 'scoop' };
    }
    if (/fabric softener/i.test(nameStr)) {
      return { _id: prod2Id, name: 'Fabric Softener', quantity: 100, reserved_quantity: 10, is_active: true, unit: 'cap' };
    }
    if (/packaging nylon/i.test(nameStr)) {
      return { _id: prod3Id, name: 'Packaging Nylon', quantity: 15, reserved_quantity: 15, is_active: true, unit: 'pieces' }; // 0 available!
    }
    if (/hanger/i.test(nameStr)) {
      return { _id: prod4Id, name: 'Hanger', quantity: 100, reserved_quantity: 10, is_active: true, unit: 'pieces' };
    }
    return null;
  });

  const findOneAndUpdateCalls = [];
  mock.method(Product, 'findOneAndUpdate', async (query, update) => {
    findOneAndUpdateCalls.push({ query, update });
    return { _id: query._id };
  });

  const updateOneCalls = [];
  mock.method(Product, 'updateOne', async (query, update) => {
    updateOneCalls.push({ query, update });
    return { modifiedCount: 1 };
  });

  const staffUser = { id: staffUserId, role: 'front_desk', branch_id: branchA };
  await rejectsStatus(
    invoke(orderController.updateOrder, {
      user: staffUser,
      params: { id: orderId },
      body: {
        status: 'received',
        intake_items: [{ quantity: 500 }],
      },
    }),
    409,
  );

  // Assert no product reservations were modified because pre-check caught the 3rd product
  assert.equal(findOneAndUpdateCalls.length, 0, 'No product reservations should be applied if 3rd product is short');
  assert.equal(mockOrder.supplies_reserved.length, 4);
  assert.equal(mockOrder.supplies_reserved[0].quantity, 1);
  assert.equal(mockOrder.supplies_reserved[1].quantity, 1);
  assert.equal(mockOrder.supplies_reserved[2].quantity, 1);
  assert.equal(mockOrder.supplies_reserved[3].quantity, 1);

  // Also test case where findOneAndUpdate fails on 3rd product during race condition
  mock.method(Product, 'findOne', async (query) => {
    const raw = query?.name?.$regex || query?.name || '';
    const nameStr = raw instanceof RegExp ? raw.source : String(raw);
    if (/laundry detergent/i.test(nameStr)) {
      return { _id: prod1Id, name: 'Laundry Detergent', quantity: 1000, reserved_quantity: 10, is_active: true, unit: 'scoop' };
    }
    if (/fabric softener/i.test(nameStr)) {
      return { _id: prod2Id, name: 'Fabric Softener', quantity: 1000, reserved_quantity: 10, is_active: true, unit: 'cap' };
    }
    if (/packaging nylon/i.test(nameStr)) {
      return { _id: prod3Id, name: 'Packaging Nylon', quantity: 1000, reserved_quantity: 10, is_active: true, unit: 'pieces' };
    }
    if (/hanger/i.test(nameStr)) {
      return { _id: prod4Id, name: 'Hanger', quantity: 1000, reserved_quantity: 10, is_active: true, unit: 'pieces' };
    }
    return null;
  });

  findOneAndUpdateCalls.length = 0;
  updateOneCalls.length = 0;
  mock.method(Product, 'findOneAndUpdate', async (query, update) => {
    findOneAndUpdateCalls.push({ query, update });
    if (String(query._id) === String(prod3Id)) {
      return null; // 3rd product fails due to concurrent race collision!
    }
    return { _id: query._id };
  });

  await rejectsStatus(
    invoke(orderController.updateOrder, {
      user: staffUser,
      params: { id: orderId },
      body: {
        status: 'received',
        intake_items: [{ quantity: 500 }],
      },
    }),
    409,
  );

  // findOneAndUpdate was called on prod1 and prod2, then prod3 failed
  assert(findOneAndUpdateCalls.length >= 3);
  // updateOne rollback must have been called on prod1 and prod2 to undo their reservations
  assert(updateOneCalls.length >= 2, 'Must rollback earlier products when 3rd product fails');
  const rolledBackIds = updateOneCalls.map((c) => String(c.query._id));
  assert(rolledBackIds.includes(String(prod1Id)));
  assert(rolledBackIds.includes(String(prod2Id)));
  for (const c of updateOneCalls) {
    assert(c.update.$inc.reserved_quantity < 0, 'Rollback must decrement reserved_quantity');
  }
  // order.supplies_reserved must be unchanged
  assert.equal(mockOrder.supplies_reserved[0].quantity, 1);
  assert.equal(mockOrder.supplies_reserved[1].quantity, 1);
  assert.equal(mockOrder.supplies_reserved[2].quantity, 1);
  assert.equal(mockOrder.supplies_reserved[3].quantity, 1);
});

test('createOrder when one of several products is short leaves all product reservations unchanged', async () => {
  const customerUserId = id();
  const prod1Id = id();
  const prod2Id = id();
  const prod3Id = id();
  const prod4Id = id();
  const serviceId = id();
  const catalogItemId = id();

  mock.method(Order, 'findOne', () => chain(null));
  mock.method(CatalogItem, 'findOne', async () => ({
    _id: catalogItemId,
    name: 'Shirt',
    category: 'Tops',
    piece_count: 1,
    is_active: true,
    services: [{ service_id: serviceId, price: 1500, is_available: true }],
  }));
  mock.method(Service, 'findById', async () => ({
    _id: serviceId,
    name: 'Washing & Folding',
    category: 'Laundry',
    price: 1500,
    is_active: true,
    branch_id: branchA,
    type: 'service',
    turnaround_hours: 24,
  }));

  // Laundry Detergent, Fabric Softener, Hanger have ample stock; Packaging Nylon is short
  mock.method(Product, 'findOne', async (query) => {
    const raw = query?.name?.$regex || query?.name || '';
    const nameStr = raw instanceof RegExp ? raw.source : String(raw);
    if (/laundry detergent/i.test(nameStr)) {
      return { _id: prod1Id, name: 'Laundry Detergent', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'scoop' };
    }
    if (/fabric softener/i.test(nameStr)) {
      return { _id: prod2Id, name: 'Fabric Softener', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'cap' };
    }
    if (/packaging nylon/i.test(nameStr)) {
      return { _id: prod3Id, name: 'Packaging Nylon', quantity: 1, reserved_quantity: 1, is_active: true, unit: 'pieces' }; // 0 available!
    }
    if (/hanger/i.test(nameStr)) {
      return { _id: prod4Id, name: 'Hanger', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'pieces' };
    }
    return null;
  });

  const findOneAndUpdateCalls = [];
  mock.method(Product, 'findOneAndUpdate', async (query, update) => {
    findOneAndUpdateCalls.push({ query, update });
    return { _id: query._id, name: 'Test' };
  });
  const updateOneCalls = [];
  mock.method(Product, 'updateOne', async (query, update) => {
    updateOneCalls.push({ query, update });
    return { modifiedCount: 1 };
  });
  mock.method(Notification, 'create', async () => ({}));
  mock.method(Employee, 'find', () => chain([]));
  mock.method(User, 'find', () => chain([]));

  await rejectsStatus(
    invoke(orderController.createOrder, {
      user: { role: 'customer', id: customerUserId },
      body: {
        branch_id: branchA,
        items: [{ catalog_item_id: catalogItemId, service_id: serviceId, quantity: 2 }],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    409,
  );

  // Pre-check rejected because Packaging Nylon had 0 available stock
  assert.equal(findOneAndUpdateCalls.length, 0, 'No product reservations should be made when one product is short');

  // Also verify race-condition rollback in createOrder:
  // Pre-check passes, but findOneAndUpdate on 3rd product returns null
  mock.method(Product, 'findOne', async (query) => {
    const raw = query?.name?.$regex || query?.name || '';
    const nameStr = raw instanceof RegExp ? raw.source : String(raw);
    if (/laundry detergent/i.test(nameStr)) {
      return { _id: prod1Id, name: 'Laundry Detergent', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'scoop' };
    }
    if (/fabric softener/i.test(nameStr)) {
      return { _id: prod2Id, name: 'Fabric Softener', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'cap' };
    }
    if (/packaging nylon/i.test(nameStr)) {
      return { _id: prod3Id, name: 'Packaging Nylon', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'pieces' };
    }
    if (/hanger/i.test(nameStr)) {
      return { _id: prod4Id, name: 'Hanger', quantity: 100, reserved_quantity: 0, is_active: true, unit: 'pieces' };
    }
    return null;
  });

  findOneAndUpdateCalls.length = 0;
  updateOneCalls.length = 0;
  mock.method(Product, 'findOneAndUpdate', async (query, update) => {
    findOneAndUpdateCalls.push({ query, update });
    if (String(query._id) === String(prod3Id)) {
      return null; // Concurrent demand grabs product 3
    }
    return { _id: query._id, name: 'Test' };
  });

  await rejectsStatus(
    invoke(orderController.createOrder, {
      user: { role: 'customer', id: customerUserId },
      body: {
        branch_id: branchA,
        items: [{ catalog_item_id: catalogItemId, service_id: serviceId, quantity: 2 }],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    409,
  );

  // prod1 and prod2 were reserved, then prod3 failed -> prod1 and prod2 were rolled back via updateOne
  assert(findOneAndUpdateCalls.length >= 3);
  assert(updateOneCalls.length >= 2, 'Must rollback earlier reserved products on failure');
  for (const c of updateOneCalls) {
    assert(c.update.$inc.reserved_quantity < 0, 'Must decrement reserved_quantity in rollback');
  }
});


