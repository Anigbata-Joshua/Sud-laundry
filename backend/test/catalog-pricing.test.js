// Owner: Josh
// Purpose: Unit tests for catalog item CRUD, copy-from-branch, and supply tier piece sizing.

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import CatalogItem from '../src/models/catalogItem.model.js';
import Service from '../src/models/service.model.js';
import Branch from '../src/models/branch.model.js';
import * as catalogController from '../src/controllers/catalogItem.controller.js';
import { getTier, calculateEffectivePieces } from '../src/config/serviceSupplies.config.js';

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
