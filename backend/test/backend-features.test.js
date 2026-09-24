import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Order from '../src/models/order.model.js';
import Notification from '../src/models/notification.model.js';
import Branch from '../src/models/branch.model.js';
import Product from '../src/models/product.model.js';
import Service from '../src/models/service.model.js';
import ServiceCategory from '../src/models/serviceCategory.model.js';
import SupplyRequest from '../src/models/supplyRequest.model.js';
import User from '../src/models/user.model.js';
import Employee from '../src/models/employee.model.js';
import StockMovement from '../src/models/stockMovement.model.js';
import ProcessingWorkflow from '../src/models/processingWorkflow.model.js';
import { transitionPickup, PICKUP_CONFIRMATION_DELAY_MS } from '../src/services/orderPickup.service.js';
import { paginationQuery, literalSearch } from '../src/utils/listQuery.js';

// Never connect these tests to configured database or Redis instances.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-unit-tests-only';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
const { default: redis } = await import('../src/config/redis.js');
redis?.disconnect();
const branches = await import('../src/controllers/branch.controller.js');
const categories = await import('../src/controllers/serviceCategory.controller.js');
const services = await import('../src/controllers/service.controller.js');
const products = await import('../src/controllers/product.controller.js');
const stock = await import('../src/controllers/stockMovement.controller.js');
const requests = await import('../src/controllers/supplyRequest.controller.js');
const { disburseApprovedSupplies } = await import('../src/services/inventoryConsumption.service.js');
const { confirmOverduePickups } = await import('../src/jobs/autoPickup.job.js');
const { default: authenticate } = await import('../src/middlewares/auth.middleware.js');
const { default: jwt } = await import('jsonwebtoken');

afterEach(() => mock.restoreAll());
const id = () => new mongoose.Types.ObjectId().toString();
const branchId = id(), otherBranchId = id(), customerId = id(), orderId = id();
const customer = { id: customerId, role: 'customer' };
const manager = { id: id(), role: 'branch_manager', branch_id: branchId };
const inventory = { id: id(), role: 'inventory_manager', branch_id: branchId };
const now = new Date('2026-09-24T12:00:00Z');
const readyOrder = () => ({ _id: orderId, customer_id: customerId, branch_id: branchId, status: 'ready', received_at: new Date('2026-09-22T12:00:00Z') });

function invoke(handler, req = {}) {
    return new Promise((resolve, reject) => {
        const res = { status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, ...body }); } };
        handler({ params: {}, body: {}, query: {}, ...req }, res, reject);
    });
}
const rejectsStatus = (promise, status) => assert.rejects(promise, error => error.statusCode === status);
function chain(value, capture = {}) {
    const query = { then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
    for (const method of ['select', 'sort', 'skip', 'limit', 'populate', 'lean', 'session']) query[method] = arg => { capture[method] = arg; return query; };
    return query;
}
function pickupMocks(order) {
    const session = { withTransaction: async fn => fn(), endSession: mock.fn(async () => {}) };
    mock.method(mongoose, 'startSession', async () => session);
    mock.method(Order, 'findById', () => chain(order));
    const update = mock.method(Order, 'findOneAndUpdate', async (filter, change) => ({ ...order, ...change.$set }));
    const notice = mock.method(Notification, 'create', async docs => docs);
    return { session, update, notice };
}

test('sending a ready order starts exactly 48 hours and saves the notice in the same transaction', async () => {
    const { update, notice, session } = pickupMocks(readyOrder());
    const result = await transitionPickup({ orderId, actor: manager, action: 'send', now });
    assert.equal(result.status, 'sent_out');
    assert.equal(result.auto_pickup_at - now, PICKUP_CONFIRMATION_DELAY_MS);
    assert.match(notice.mock.calls[0].arguments[0][0].message, /2 days/);
    assert.equal(update.mock.calls[0].arguments[2].session, session);
    assert.equal(notice.mock.calls[0].arguments[1].session, session);
});

test('customer can confirm own ready order and preserve payment fields', async () => {
    pickupMocks({ ...readyOrder(), payment_status: 'unpaid', amount_due: 100 });
    const result = await transitionPickup({ orderId, actor: customer, action: 'confirm', now });
    assert.equal(result.status, 'delivered');
    assert.equal(result.pickup_confirmation_source, 'customer');
    assert.equal(result.pickup_confirmed_by, customerId);
    assert.equal(result.payment_status, 'unpaid');
    assert.equal(result.amount_due, 100);
    assert.equal(result.actual_turnaround_hours, 48);
});

for (const [name, actor, action] of [
    ['another customer', { ...customer, id: id() }, 'confirm'],
    ['customer dispatch', customer, 'send'],
    ['another branch manager', { ...manager, branch_id: otherBranchId }, 'send'],
    ['inventory manager dispatch', inventory, 'send'],
]) test(`pickup rejects ${name}`, async () => {
    const { update } = pickupMocks(readyOrder());
    await rejectsStatus(transitionPickup({ orderId, actor, action, now }), 403);
    assert.equal(update.mock.callCount(), 0);
});

test('pickup rejects orders still processing', async () => {
    pickupMocks({ ...readyOrder(), status: 'processing' });
    await rejectsStatus(transitionPickup({ orderId, actor: customer, action: 'confirm', now }), 409);
});
test('automatic pickup never closes a ready order that has not been sent out', async () => {
    pickupMocks(readyOrder());
    await rejectsStatus(transitionPickup({ orderId, action: 'automatic', now }), 409);
});
test('automatic pickup is rejected one millisecond before its deadline', async () => {
    pickupMocks({ ...readyOrder(), status: 'sent_out', auto_pickup_at: new Date(now.getTime() + 1) });
    await rejectsStatus(transitionPickup({ orderId, action: 'automatic', now }), 409);
});
test('automatic pickup runs at the exact deadline and records its source', async () => {
    const { update } = pickupMocks({ ...readyOrder(), status: 'sent_out', auto_pickup_at: now });
    const result = await transitionPickup({ orderId, action: 'automatic', now });
    assert.equal(result.pickup_confirmation_source, 'automatic');
    assert.equal(result.pickup_confirmed_by, undefined);
    assert.deepEqual(update.mock.calls[0].arguments[0].auto_pickup_at, { $lte: now });
});
test('repeat confirmation is idempotent and sends no duplicate notice', async () => {
    const order = { ...readyOrder(), status: 'delivered', pickup_confirmation_source: 'customer' };
    const { update, notice } = pickupMocks(order);
    assert.equal(await transitionPickup({ orderId, actor: customer, action: 'confirm', now }), order);
    assert.equal(update.mock.callCount(), 0);
    assert.equal(notice.mock.callCount(), 0);
});
test('a concurrent transition cannot overwrite the winner or send a notice', async () => {
    const { notice } = pickupMocks(readyOrder());
    mock.method(Order, 'findOneAndUpdate', async () => null);
    await rejectsStatus(transitionPickup({ orderId, actor: customer, action: 'confirm', now }), 409);
    assert.equal(notice.mock.callCount(), 0);
});
test('notification failure fails the transaction and closes its session', async () => {
    const { session } = pickupMocks(readyOrder());
    mock.method(Notification, 'create', async () => { throw new Error('notification failed'); });
    await assert.rejects(transitionPickup({ orderId, actor: manager, action: 'send', now }), /notification failed/);
    assert.equal(session.endSession.mock.callCount(), 1);
});
test('scheduled job selects only sent-out orders whose deadline has passed', async () => {
    const find = mock.method(Order, 'find', () => chain([]));
    assert.equal(await confirmOverduePickups(now), 0);
    assert.deepEqual(find.mock.calls[0].arguments[0], { status: 'sent_out', auto_pickup_at: { $lte: now } });
});

test('branch search escapes regex and combines field filters with pagination', async () => {
    const capture = {};
    const find = mock.method(Branch, 'find', () => chain([{ name: 'A+B' }], capture));
    mock.method(Branch, 'countDocuments', async () => 21);
    const result = await invoke(branches.getAllBranches, { query: { q: 'A+B', address: 'Lagos', page: '2', limit: '10', sort_order: 'desc' } });
    assert.equal(find.mock.calls[0].arguments[0].$or[0].name.$regex, 'A\\+B');
    assert.deepEqual(find.mock.calls[0].arguments[0].address, literalSearch('Lagos'));
    assert.equal(capture.skip, 10);
    assert.deepEqual(capture.sort, { name: -1, _id: 1 });
    assert.equal(result.pagination.total, 21);
    assert.equal(result.pagination.pages, 3);
    assert.ok(Array.isArray(result.data));
});
test('unpaginated branch responses retain the existing array shape', async () => {
    mock.method(Branch, 'find', () => chain([]));
    const result = await invoke(branches.getAllBranches);
    assert.deepEqual(result.data, []);
    assert.equal(result.pagination, undefined);
});
for (const query of [{ page: '0' }, { limit: '101' }, { page: '1.2' }, { page: ['1'] }]) {
    test(`invalid pagination ${JSON.stringify(query)} is rejected`, () => assert.throws(() => paginationQuery(query), error => error.statusCode === 400));
}
test('branch query objects cannot inject Mongo operators', async () => {
    await rejectsStatus(invoke(branches.getAllBranches, { query: { q: { $ne: '' } } }), 400);
});

test('branch managers can create reusable categories for their branch', async () => {
    mock.method(Branch, 'exists', async () => true);
    mock.method(ServiceCategory, 'exists', async () => false);
    mock.method(ServiceCategory, 'create', async fields => fields);
    const result = await invoke(categories.createCategory, { user: manager, body: { name: ' Dry Cleaning ' } });
    assert.equal(result.code, 201);
    assert.equal(result.data.name_key, 'dry cleaning');
    assert.equal(result.data.branch_id, branchId);
});
test('category creation rejects duplicate names ignoring case', async () => {
    mock.method(Branch, 'exists', async () => true);
    mock.method(ServiceCategory, 'exists', async () => true);
    await rejectsStatus(invoke(categories.createCategory, { user: manager, body: { name: 'dry cleaning' } }), 409);
});
test('category management cannot cross branch boundaries', async () => {
    await rejectsStatus(invoke(categories.createCategory, { user: manager, body: { branch_id: otherBranchId, name: 'Laundry' } }), 403);
    mock.method(ServiceCategory, 'findById', async () => ({ branch_id: otherBranchId }));
    await rejectsStatus(invoke(categories.updateCategory, { user: manager, params: { id: id() }, body: { name: 'Changed' } }), 403);
});
test('service creation links an active category in its own branch', async () => {
    const categoryId = id();
    mock.method(Branch, 'findById', async () => ({}));
    mock.method(Service, 'findOne', async () => null);
    const lookup = mock.method(ServiceCategory, 'findOne', async () => ({ _id: categoryId, name: 'Laundry' }));
    mock.method(Service, 'create', async fields => fields);
    const result = await invoke(services.createService, { user: manager, body: { name: 'Shirt', price: 500, turnaround_hours: 24, category_id: categoryId } });
    assert.equal(result.code, 201);
    assert.equal(result.data.category_id, categoryId);
    assert.equal(lookup.mock.calls[0].arguments[0].branch_id, branchId);
    assert.equal(lookup.mock.calls[0].arguments[0].is_active, true);
});
test('inactive or foreign service categories are rejected', async () => {
    mock.method(Branch, 'findById', async () => ({}));
    mock.method(Service, 'findOne', async () => null);
    mock.method(ServiceCategory, 'findOne', async () => null);
    await rejectsStatus(invoke(services.createService, { user: manager, body: { name: 'Shirt', price: 500, turnaround_hours: 24, category_id: id() } }), 400);
});
test('legacy category names become reusable categories on service creation', async () => {
    mock.method(Branch, 'findById', async () => ({}));
    mock.method(Service, 'findOne', async () => null);
    const upsert = mock.method(ServiceCategory, 'findOneAndUpdate', async () => ({ _id: id(), name: 'Laundry', is_active: true }));
    mock.method(Service, 'create', async fields => fields);
    const result = await invoke(services.createService, { user: manager, body: { name: 'Shirt', price: 500, turnaround_hours: 24, category: 'Laundry' } });
    assert.equal(result.data.category, 'Laundry');
    assert.equal(upsert.mock.calls[0].arguments[0].name_key, 'laundry');
});

test('inventory_manager is a valid user role', () => {
    const user = new User({ name: 'Inventory', email: 'inventory@example.com', password_hash: 'hash', role: 'inventory_manager' });
    assert.equal(user.validateSync(), undefined);
});
test('authentication attaches the inventory manager branch', async () => {
    mock.method(User, 'findById', () => chain({ _id: inventory.id, role: inventory.role, is_active: true }));
    mock.method(Employee, 'findOne', async () => ({ branch_id: branchId, is_active: true }));
    const req = { headers: { authorization: `Bearer ${jwt.sign({ id: inventory.id }, process.env.JWT_SECRET)}` } };
    await new Promise((resolve, reject) => authenticate(req, {}, error => error ? reject(error) : resolve()));
    assert.equal(req.user.branch_id, branchId);
});
test('inventory manager product creation ignores a supplied foreign branch', async () => {
    mock.method(Branch, 'findById', async () => ({}));
    mock.method(Product, 'findOne', async () => null);
    mock.method(Product, 'create', async fields => fields);
    const result = await invoke(products.createProduct, { user: inventory, body: { name: 'Detergent', branch_id: otherBranchId } });
    assert.equal(result.data.branch_id, branchId);
    assert.equal(result.data.quantity, 0);
});
test('inventory manager cannot edit or deactivate another branch product', async () => {
    mock.method(Product, 'findById', async () => ({ branch_id: otherBranchId }));
    for (const handler of [products.updateProduct, products.deleteProduct]) {
        await rejectsStatus(invoke(handler, { user: inventory, params: { id: id() }, body: { name: 'Changed' } }), 403);
    }
});
test('ordinary staff cannot bypass inventory approval with direct movements', async () => {
    for (const role of ['employee', 'branch_manager', 'front_desk']) {
        await rejectsStatus(invoke(stock.createStock, { user: { role }, body: { type: 'usage' } }), 403);
    }
});
test('inventory manager request queue is scoped to own branch', async () => {
    const find = mock.method(SupplyRequest, 'find', () => chain([]));
    await invoke(requests.listRequests, { user: inventory, query: { branch_id: otherBranchId } });
    assert.equal(find.mock.calls[0].arguments[0].branch_id, branchId);
});
test('inventory manager cannot approve requests in another branch', async () => {
    mock.method(SupplyRequest, 'findById', async () => ({ status: 'pending', branch_id: otherBranchId }));
    await rejectsStatus(invoke(requests.approveRequest, { user: inventory, params: { id: id() } }), 403);
});
test('supply disbursement rejects products belonging to another branch', async () => {
    const session = { withTransaction: async fn => fn(), endSession: async () => {} };
    mock.method(mongoose, 'startSession', async () => session);
    mock.method(SupplyRequest, 'findOneAndUpdate', async () => ({}));
    mock.method(Order, 'findById', () => chain({ branch_id: branchId }));
    mock.method(Product, 'findById', () => chain({ is_active: true, branch_id: otherBranchId }));
    await rejectsStatus(disburseApprovedSupplies({ order: { _id: orderId }, supplyRequest: { _id: id(), branch_id: branchId, approved_items: [{ product_id: id(), quantity: 1 }] } }), 400);
});
test('a request that was already reviewed cannot deduct inventory again', async () => {
    const session = { withTransaction: async fn => fn(), endSession: async () => {} };
    mock.method(mongoose, 'startSession', async () => session);
    mock.method(SupplyRequest, 'findOneAndUpdate', async () => null);
    const product = mock.method(Product, 'findById', () => { throw new Error('must not read stock'); });
    await rejectsStatus(disburseApprovedSupplies({ order: { _id: orderId }, supplyRequest: { _id: id(), approved_items: [] } }), 409);
    assert.equal(product.mock.callCount(), 0);
});

test('successful inventory approval commits stock, ledger, usage, and request in one session', async () => {
    const session = { withTransaction: async fn => fn(), endSession: async () => {} };
    mock.method(mongoose, 'startSession', async () => session);
    const claim = mock.method(SupplyRequest, 'findOneAndUpdate', async () => ({}));
    const order = { _id: orderId, branch_id: branchId, supplies_used: [], save: mock.fn(async () => {}) };
    const product = { _id: id(), branch_id: branchId, is_active: true, name: 'Detergent', quantity: 10, unit: 'litres', reorder_point: 0, save: mock.fn(async () => {}) };
    mock.method(Order, 'findById', () => chain(order));
    mock.method(Product, 'findById', () => chain(product));
    const ledger = mock.method(StockMovement, 'create', async () => []);
    const requestUpdate = mock.method(SupplyRequest, 'updateOne', async () => ({}));
    const request = { _id: id(), branch_id: branchId, requested_by: id(), reviewed_by: id(), reviewed_at: now, approved_items: [{ product_id: product._id, quantity: 3, product_name: 'Untrusted name' }] };
    await disburseApprovedSupplies({ order, supplyRequest: request });
    assert.equal(product.quantity, 7);
    assert.equal(order.supplies_used[0].quantity_used, 3);
    assert.equal(request.approved_items[0].product_name, 'Detergent');
    assert.equal(request.approved_items[0].unit, 'litres');
    assert.equal(ledger.mock.calls[0].arguments[0][0].quantity, -3);
    assert.equal(ledger.mock.calls[0].arguments[1].session, session);
    assert.equal(claim.mock.calls[0].arguments[0].status, 'pending');
    assert.equal(claim.mock.calls[0].arguments[2].session, session);
    assert.equal(requestUpdate.mock.calls[0].arguments[2].session, session);
    assert.equal(order.save.mock.calls[0].arguments[0].session, session);
});

test('new supply requests notify active branch inventory managers as well as legacy officers', async () => {
    const employeeId = id(), stepId = id(), workflowId = id();
    mock.method(ProcessingWorkflow, 'findById', async () => ({
        _id: workflowId, branch_id: branchId, order_id: orderId,
        steps: { id: () => ({ name: 'washing', employee_id: employeeId, status: 'assigned' }) },
    }));
    mock.method(Employee, 'findOne', async () => ({ _id: employeeId, branch_id: branchId }));
    mock.method(SupplyRequest, 'findOne', async () => null);
    mock.method(Order, 'findById', async () => ({ _id: orderId, items: [] }));
    mock.method(SupplyRequest, 'create', async fields => ({ ...fields, populate: async () => {} }));
    const capture = {};
    const recipients = mock.method(Employee, 'find', () => chain([{ user_id: { _id: inventory.id } }], capture));
    const notice = mock.method(Notification, 'create', async fields => fields);
    const result = await invoke(requests.createRequest, { user: { id: id(), role: 'employee' }, body: { workflow_id: workflowId, step_id: stepId } });
    assert.equal(result.code, 201);
    assert.equal(recipients.mock.calls[0].arguments[0].branch_id, branchId);
    assert.ok(capture.populate.match.role.$in.includes('inventory_manager'));
    assert.equal(notice.mock.calls[0].arguments[0].user_id, inventory.id);
    assert.equal(notice.mock.calls[0].arguments[0].type, 'supply_requested');
});

test('inventory manager can reject a pending request and notify its requester', async () => {
    const requesterId = id();
    const request = { _id: id(), branch_id: branchId, order_id: orderId, requested_by: id(), status: 'pending', populate: async () => {} };
    mock.method(SupplyRequest, 'findById', async () => request);
    mock.method(Employee, 'findOne', async () => ({ _id: id() }));
    const update = mock.method(SupplyRequest, 'findOneAndUpdate', async () => request);
    mock.method(Employee, 'findById', () => chain({ user_id: { _id: requesterId } }));
    mock.method(Order, 'findById', async () => ({ _id: orderId }));
    const notice = mock.method(Notification, 'create', async fields => fields);
    const result = await invoke(requests.rejectRequest, { user: inventory, params: { id: request._id }, body: { reason: ' Please revise quantity ' } });
    assert.equal(result.code, 200);
    assert.equal(update.mock.calls[0].arguments[0].status, 'pending');
    assert.equal(update.mock.calls[0].arguments[1].$set.rejection_reason, 'Please revise quantity');
    assert.equal(notice.mock.calls[0].arguments[0].type, 'supply_rejected');
});

test('approval rejects duplicate products and malformed items before stock writes', async () => {
    mock.method(SupplyRequest, 'findById', async () => ({ status: 'pending', branch_id: branchId }));
    const productId = id();
    for (const items of [[null], [{ product_id: 'bad', quantity: 1 }], [{ product_id: productId, quantity: 1 }, { product_id: productId, quantity: 2 }]]) {
        await rejectsStatus(invoke(requests.approveRequest, { user: inventory, body: { items } }), 400);
    }
});

test('ready schema records ready time without starting an automatic confirmation deadline', async () => {
    const order = new Order({ customer_id: customerId, branch_id: branchId, status: 'ready', total_price: 100 });
    await order.validate();
    assert.ok(order.ready_at instanceof Date);
    assert.equal(order.auto_pickup_at, undefined);
});
