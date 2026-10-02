import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Order from "../src/models/order.model.js";
import Notification from "../src/models/notification.model.js";
import Branch from "../src/models/branch.model.js";
import Product from "../src/models/product.model.js";
import Service from "../src/models/service.model.js";
import ServiceCategory from "../src/models/serviceCategory.model.js";
import SupplyRequest from "../src/models/supplyRequest.model.js";
import User from "../src/models/user.model.js";
import Employee from "../src/models/employee.model.js";
import StockMovement from "../src/models/stockMovement.model.js";
import ProcessingWorkflow from "../src/models/processingWorkflow.model.js";
import {
  transitionPickup,
  PICKUP_CONFIRMATION_DELAY_MS,
} from "../src/services/orderPickup.service.js";
import { paginationQuery, literalSearch } from "../src/utils/listQuery.js";

// Never connect these tests to configured database or Redis instances.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "local-unit-tests-only";
process.env.REDIS_URL = "redis://127.0.0.1:1";
const { default: redis } = await import("../src/config/redis.js");
redis?.disconnect();
const branches = await import("../src/controllers/branch.controller.js");
const categories =
  await import("../src/controllers/serviceCategory.controller.js");
const services = await import("../src/controllers/service.controller.js");
const products = await import("../src/controllers/product.controller.js");
const stock = await import("../src/controllers/stockMovement.controller.js");
const requests = await import("../src/controllers/supplyRequest.controller.js");
const inventoryService =
  await import("../src/services/inventoryConsumption.service.js");
const { disburseApprovedSupplies } =
  await import("../src/services/inventoryConsumption.service.js");
const { confirmOverduePickups } = await import("../src/jobs/autoPickup.job.js");
const { generateAdminDigests } = await import("../src/jobs/adminDigest.job.js");
const { default: authenticate } =
  await import("../src/middlewares/auth.middleware.js");
const { default: jwt } = await import("jsonwebtoken");

afterEach(() => mock.restoreAll());
const id = () => new mongoose.Types.ObjectId().toString();
const branchId = id(),
  otherBranchId = id(),
  customerId = id(),
  orderId = id();
const customer = { id: customerId, role: "customer" };
const manager = { id: id(), role: "branch_manager", branch_id: branchId };
const inventory = { id: id(), role: "inventory_officer", branch_id: branchId };
const now = new Date("2026-09-24T12:00:00Z");
const readyOrder = () => ({
  _id: orderId,
  customer_id: customerId,
  branch_id: branchId,
  status: "ready",
  received_at: new Date("2026-09-22T12:00:00Z"),
});

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
  for (const method of [
    "select",
    "sort",
    "skip",
    "limit",
    "populate",
    "lean",
    "session",
  ])
    query[method] = (arg) => {
      capture[method] = arg;
      return query;
    };
  return query;
}
function pickupMocks(order) {
  const session = {
    withTransaction: async (fn) => fn(),
    endSession: mock.fn(async () => {}),
  };
  mock.method(mongoose, "startSession", async () => session);
  mock.method(Order, "findById", () => chain(order));
  const update = mock.method(
    Order,
    "findOneAndUpdate",
    async (filter, change) => ({ ...order, ...change.$set }),
  );
  const notice = mock.method(Notification, "create", async (docs) => docs);
  return { session, update, notice };
}

test("sending a ready order starts exactly 48 hours and saves the notice in the same transaction", async () => {
  const { update, notice, session } = pickupMocks(readyOrder());
  const result = await transitionPickup({
    orderId,
    actor: manager,
    action: "send",
    now,
  });
  assert.equal(result.status, "sent_out");
  assert.equal(result.auto_pickup_at - now, PICKUP_CONFIRMATION_DELAY_MS);
  assert.match(notice.mock.calls[0].arguments[0][0].message, /2 days/);
  assert.equal(update.mock.calls[0].arguments[2].session, session);
  assert.equal(notice.mock.calls[0].arguments[1].session, session);
});

test("customer can confirm own ready order and preserve payment fields", async () => {
  pickupMocks({ ...readyOrder(), payment_status: "unpaid", amount_due: 100 });
  const result = await transitionPickup({
    orderId,
    actor: customer,
    action: "confirm",
    now,
  });
  assert.equal(result.status, "delivered");
  assert.equal(result.pickup_confirmation_source, "customer");
  assert.equal(result.pickup_confirmed_by, customerId);
  assert.equal(result.payment_status, "unpaid");
  assert.equal(result.amount_due, 100);
  assert.equal(result.actual_turnaround_hours, 48);
});

for (const [name, actor, action] of [
  ["another customer", { ...customer, id: id() }, "confirm"],
  ["customer dispatch", customer, "send"],
  ["another branch manager", { ...manager, branch_id: otherBranchId }, "send"],
  ["inventory officer dispatch", inventory, "send"],
])
  test(`pickup rejects ${name}`, async () => {
    const { update } = pickupMocks(readyOrder());
    await rejectsStatus(transitionPickup({ orderId, actor, action, now }), 403);
    assert.equal(update.mock.callCount(), 0);
  });

test("pickup rejects orders still processing", async () => {
  pickupMocks({ ...readyOrder(), status: "processing" });
  await rejectsStatus(
    transitionPickup({ orderId, actor: customer, action: "confirm", now }),
    409,
  );
});
test("automatic pickup never closes a ready order that has not been sent out", async () => {
  pickupMocks(readyOrder());
  await rejectsStatus(
    transitionPickup({ orderId, action: "automatic", now }),
    409,
  );
});
test("automatic pickup is rejected one millisecond before its deadline", async () => {
  pickupMocks({
    ...readyOrder(),
    status: "sent_out",
    auto_pickup_at: new Date(now.getTime() + 1),
  });
  await rejectsStatus(
    transitionPickup({ orderId, action: "automatic", now }),
    409,
  );
});
test("automatic pickup runs at the exact deadline and records its source", async () => {
  const { update } = pickupMocks({
    ...readyOrder(),
    status: "sent_out",
    auto_pickup_at: now,
  });
  const result = await transitionPickup({ orderId, action: "automatic", now });
  assert.equal(result.pickup_confirmation_source, "automatic");
  assert.equal(result.pickup_confirmed_by, undefined);
  assert.deepEqual(update.mock.calls[0].arguments[0].auto_pickup_at, {
    $lte: now,
  });
});
test("repeat confirmation is idempotent and sends no duplicate notice", async () => {
  const order = {
    ...readyOrder(),
    status: "delivered",
    pickup_confirmation_source: "customer",
  };
  const { update, notice } = pickupMocks(order);
  assert.equal(
    await transitionPickup({
      orderId,
      actor: customer,
      action: "confirm",
      now,
    }),
    order,
  );
  assert.equal(update.mock.callCount(), 0);
  assert.equal(notice.mock.callCount(), 0);
});
test("a concurrent transition cannot overwrite the winner or send a notice", async () => {
  const { notice } = pickupMocks(readyOrder());
  mock.method(Order, "findOneAndUpdate", async () => null);
  await rejectsStatus(
    transitionPickup({ orderId, actor: customer, action: "confirm", now }),
    409,
  );
  assert.equal(notice.mock.callCount(), 0);
});
test("notification failure fails the transaction and closes its session", async () => {
  const { session } = pickupMocks(readyOrder());
  mock.method(Notification, "create", async () => {
    throw new Error("notification failed");
  });
  await assert.rejects(
    transitionPickup({ orderId, actor: manager, action: "send", now }),
    /notification failed/,
  );
  assert.equal(session.endSession.mock.callCount(), 1);
});
test("scheduled job selects only sent-out orders whose deadline has passed", async () => {
  const find = mock.method(Order, "find", () => chain([]));
  assert.equal(await confirmOverduePickups(now), 0);
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    status: "sent_out",
    auto_pickup_at: { $lte: now },
  });
});

test("branch search escapes regex and combines field filters with pagination", async () => {
  const capture = {};
  const find = mock.method(Branch, "find", () =>
    chain([{ name: "A+B" }], capture),
  );
  mock.method(Branch, "countDocuments", async () => 21);
  const result = await invoke(branches.getAllBranches, {
    query: {
      q: "A+B",
      address: "Lagos",
      page: "2",
      limit: "10",
      sort_order: "desc",
    },
  });
  assert.equal(find.mock.calls[0].arguments[0].$or[0].name.$regex, "A\\+B");
  assert.deepEqual(
    find.mock.calls[0].arguments[0].address,
    literalSearch("Lagos"),
  );
  assert.equal(capture.skip, 10);
  assert.deepEqual(capture.sort, { name: -1, _id: 1 });
  assert.equal(result.pagination.total, 21);
  assert.equal(result.pagination.pages, 3);
  assert.ok(Array.isArray(result.data));
});
test("unpaginated branch responses retain the existing array shape", async () => {
  mock.method(Branch, "find", () => chain([]));
  const result = await invoke(branches.getAllBranches);
  assert.deepEqual(result.data, []);
  assert.equal(result.pagination, undefined);
});
for (const query of [
  { page: "0" },
  { limit: "101" },
  { page: "1.2" },
  { page: ["1"] },
]) {
  test(`invalid pagination ${JSON.stringify(query)} is rejected`, () =>
    assert.throws(
      () => paginationQuery(query),
      (error) => error.statusCode === 400,
    ));
}
test("branch query objects cannot inject Mongo operators", async () => {
  await rejectsStatus(
    invoke(branches.getAllBranches, { query: { q: { $ne: "" } } }),
    400,
  );
});

test("branch managers can create reusable categories for their branch", async () => {
  mock.method(Branch, "exists", async () => true);
  mock.method(ServiceCategory, "exists", async () => false);
  mock.method(ServiceCategory, "create", async (fields) => fields);
  const result = await invoke(categories.createCategory, {
    user: manager,
    body: { name: " Dry Cleaning " },
  });
  assert.equal(result.code, 201);
  assert.equal(result.data.name_key, "dry cleaning");
  assert.equal(result.data.branch_id, branchId);
});
test("category creation rejects duplicate names ignoring case", async () => {
  mock.method(Branch, "exists", async () => true);
  mock.method(ServiceCategory, "exists", async () => true);
  await rejectsStatus(
    invoke(categories.createCategory, {
      user: manager,
      body: { name: "dry cleaning" },
    }),
    409,
  );
});
test("category management cannot cross branch boundaries", async () => {
  await rejectsStatus(
    invoke(categories.createCategory, {
      user: manager,
      body: { branch_id: otherBranchId, name: "Laundry" },
    }),
    403,
  );
  mock.method(ServiceCategory, "findById", async () => ({
    branch_id: otherBranchId,
  }));
  await rejectsStatus(
    invoke(categories.updateCategory, {
      user: manager,
      params: { id: id() },
      body: { name: "Changed" },
    }),
    403,
  );
});
test("service creation links an active category in its own branch", async () => {
  const categoryId = id();
  mock.method(Branch, "findById", async () => ({}));
  mock.method(Service, "findOne", async () => null);
  const lookup = mock.method(ServiceCategory, "findOne", async () => ({
    _id: categoryId,
    name: "Laundry",
  }));
  mock.method(Service, "create", async (fields) => fields);
  const result = await invoke(services.createService, {
    user: manager,
    body: {
      name: "Shirt",
      price: 500,
      turnaround_hours: 24,
      category_id: categoryId,
    },
  });
  assert.equal(result.code, 201);
  assert.equal(result.data.category_id, categoryId);
  assert.equal(lookup.mock.calls[0].arguments[0].branch_id, branchId);
  assert.equal(lookup.mock.calls[0].arguments[0].is_active, true);
});
test("inactive or foreign service categories are rejected", async () => {
  mock.method(Branch, "findById", async () => ({}));
  mock.method(Service, "findOne", async () => null);
  mock.method(ServiceCategory, "findOne", async () => null);
  await rejectsStatus(
    invoke(services.createService, {
      user: manager,
      body: {
        name: "Shirt",
        price: 500,
        turnaround_hours: 24,
        category_id: id(),
      },
    }),
    400,
  );
});
test("legacy category names become reusable categories on service creation", async () => {
  mock.method(Branch, "findById", async () => ({}));
  mock.method(Service, "findOne", async () => null);
  const upsert = mock.method(ServiceCategory, "findOneAndUpdate", async () => ({
    _id: id(),
    name: "Laundry",
    is_active: true,
  }));
  mock.method(Service, "create", async (fields) => fields);
  const result = await invoke(services.createService, {
    user: manager,
    body: {
      name: "Shirt",
      price: 500,
      turnaround_hours: 24,
      category: "Laundry",
    },
  });
  assert.equal(result.data.category, "Laundry");
  assert.equal(upsert.mock.calls[0].arguments[0].name_key, "laundry");
});

test("inventory_officer is a valid user role", () => {
  const user = new User({
    name: "Inventory",
    email: "inventory@example.com",
    password_hash: "hash",
    role: "inventory_officer",
  });
  assert.equal(user.validateSync(), undefined);
});
test("authentication attaches the inventory officer branch", async () => {
  mock.method(User, "findById", () =>
    chain({ _id: inventory.id, role: inventory.role, is_active: true }),
  );
  mock.method(Employee, "findOne", async () => ({
    branch_id: branchId,
    is_active: true,
  }));
  const req = {
    headers: {
      authorization: `Bearer ${jwt.sign({ id: inventory.id }, process.env.JWT_SECRET)}`,
    },
  };
  await new Promise((resolve, reject) =>
    authenticate(req, {}, (error) => (error ? reject(error) : resolve())),
  );
  assert.equal(req.user.branch_id, branchId);
});
test("inventory officer product creation ignores a supplied foreign branch", async () => {
  mock.method(Branch, "findById", async () => ({}));
  mock.method(Product, "findOne", async () => null);
  mock.method(Product, "create", async (fields) => fields);
  const result = await invoke(products.createProduct, {
    user: inventory,
    body: { name: "Detergent", branch_id: otherBranchId },
  });
  assert.equal(result.data.branch_id, branchId);
  assert.equal(result.data.quantity, 0);
});
test("inventory officer cannot edit or deactivate another branch product", async () => {
  mock.method(Product, "findById", async () => ({ branch_id: otherBranchId }));
  for (const handler of [products.updateProduct, products.deleteProduct]) {
    await rejectsStatus(
      invoke(handler, {
        user: inventory,
        params: { id: id() },
        body: { name: "Changed" },
      }),
      403,
    );
  }
});
test("ordinary staff cannot bypass inventory approval with direct movements", async () => {
  for (const role of ["employee", "branch_manager", "front_desk"]) {
    await rejectsStatus(
      invoke(stock.createStock, { user: { role }, body: { type: "usage" } }),
      403,
    );
  }
});
test("inventory officer request queue is scoped to own branch", async () => {
  const find = mock.method(SupplyRequest, "find", () => chain([]));
  await invoke(requests.listRequests, {
    user: inventory,
    query: { branch_id: otherBranchId },
  });
  assert.equal(find.mock.calls[0].arguments[0].branch_id, branchId);
});
test("inventory officer cannot approve requests in another branch", async () => {
  mock.method(SupplyRequest, "findById", async () => ({
    status: "pending",
    branch_id: otherBranchId,
  }));
  await rejectsStatus(
    invoke(requests.approveRequest, { user: inventory, params: { id: id() } }),
    403,
  );
});
test("supply disbursement rejects products belonging to another branch", async () => {
  const session = {
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  };
  mock.method(mongoose, "startSession", async () => session);
  mock.method(SupplyRequest, "findOneAndUpdate", async () => ({}));
  mock.method(Order, "findById", () => chain({ branch_id: branchId }));
  mock.method(Product, "findById", () =>
    chain({ is_active: true, branch_id: otherBranchId }),
  );
  await rejectsStatus(
    disburseApprovedSupplies({
      order: { _id: orderId },
      supplyRequest: {
        _id: id(),
        branch_id: branchId,
        approved_items: [{ product_id: id(), quantity: 1 }],
      },
    }),
    400,
  );
});
test("a request that was already reviewed cannot deduct inventory again", async () => {
  const session = {
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  };
  mock.method(mongoose, "startSession", async () => session);
  mock.method(SupplyRequest, "findOneAndUpdate", async () => null);
  const product = mock.method(Product, "findById", () => {
    throw new Error("must not read stock");
  });
  await rejectsStatus(
    disburseApprovedSupplies({
      order: { _id: orderId },
      supplyRequest: { _id: id(), approved_items: [] },
    }),
    409,
  );
  assert.equal(product.mock.callCount(), 0);
});

test("successful inventory approval commits stock, ledger, usage, and request in one session", async () => {
  const session = {
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  };
  mock.method(mongoose, "startSession", async () => session);
  const claim = mock.method(
    SupplyRequest,
    "findOneAndUpdate",
    async () => ({}),
  );
  const order = {
    _id: orderId,
    branch_id: branchId,
    supplies_used: [],
    save: mock.fn(async () => {}),
  };
  const product = {
    _id: id(),
    branch_id: branchId,
    is_active: true,
    name: "Detergent",
    quantity: 10,
    unit: "litres",
    reorder_point: 0,
    save: mock.fn(async () => {}),
  };
  mock.method(Order, "findById", () => chain(order));
  mock.method(Product, "findById", () => chain(product));
  const ledger = mock.method(StockMovement, "create", async () => []);
  const requestUpdate = mock.method(
    SupplyRequest,
    "updateOne",
    async () => ({}),
  );
  const request = {
    _id: id(),
    branch_id: branchId,
    requested_by: id(),
    reviewed_by: id(),
    reviewed_at: now,
    approved_items: [
      { product_id: product._id, quantity: 3, product_name: "Untrusted name" },
    ],
  };
  await disburseApprovedSupplies({ order, supplyRequest: request });
  assert.equal(product.quantity, 7);
  assert.equal(order.supplies_used[0].quantity_used, 3);
  assert.equal(request.approved_items[0].product_name, "Detergent");
  assert.equal(request.approved_items[0].unit, "litres");
  assert.equal(ledger.mock.calls[0].arguments[0][0].quantity, -3);
  assert.equal(ledger.mock.calls[0].arguments[1].session, session);
  assert.equal(claim.mock.calls[0].arguments[0].status, "pending");
  assert.equal(claim.mock.calls[0].arguments[2].session, session);
  assert.equal(requestUpdate.mock.calls[0].arguments[2].session, session);
  assert.equal(order.save.mock.calls[0].arguments[0].session, session);
});

test("new supply requests notify active branch inventory officers", async () => {
  const employeeId = id(),
    stepId = id(),
    workflowId = id();
  mock.method(ProcessingWorkflow, "findById", async () => ({
    _id: workflowId,
    branch_id: branchId,
    order_id: orderId,
    steps: {
      id: () => ({
        name: "washing",
        employee_id: employeeId,
        status: "assigned",
      }),
    },
  }));
  mock.method(Employee, "findOne", async () => ({
    _id: employeeId,
    branch_id: branchId,
  }));
  mock.method(SupplyRequest, "findOne", async () => null);
  mock.method(Order, "findById", async () => ({ _id: orderId, items: [] }));
  mock.method(SupplyRequest, "create", async (fields) => ({
    ...fields,
    populate: async () => {},
  }));
  const capture = {};
  const recipients = mock.method(Employee, "find", () =>
    chain([{ user_id: { _id: inventory.id } }], capture),
  );
  const notice = mock.method(Notification, "create", async (fields) => fields);
  const result = await invoke(requests.createRequest, {
    user: { id: id(), role: "employee" },
    body: { workflow_id: workflowId, step_id: stepId },
  });
  assert.equal(result.code, 201);
  assert.equal(recipients.mock.calls[0].arguments[0].branch_id, branchId);
  assert.ok(capture.populate.match.role.$in.includes("inventory_officer"));
  assert.equal(notice.mock.calls[0].arguments[0].user_id, inventory.id);
  assert.equal(notice.mock.calls[0].arguments[0].type, "supply_requested");
});

test("inventory officer can reject a pending request and notify its requester", async () => {
  const requesterId = id();
  const request = {
    _id: id(),
    branch_id: branchId,
    order_id: orderId,
    requested_by: id(),
    status: "pending",
    populate: async () => {},
  };
  mock.method(SupplyRequest, "findById", async () => request);
  mock.method(Employee, "findOne", async () => ({ _id: id() }));
  const update = mock.method(
    SupplyRequest,
    "findOneAndUpdate",
    async () => request,
  );
  mock.method(Employee, "findById", () =>
    chain({ user_id: { _id: requesterId } }),
  );
  mock.method(Order, "findById", async () => ({ _id: orderId }));
  const notice = mock.method(Notification, "create", async (fields) => fields);
  const result = await invoke(requests.rejectRequest, {
    user: inventory,
    params: { id: request._id },
    body: { reason: " Please revise quantity " },
  });
  assert.equal(result.code, 200);
  assert.equal(update.mock.calls[0].arguments[0].status, "pending");
  assert.equal(
    update.mock.calls[0].arguments[1].$set.rejection_reason,
    "Please revise quantity",
  );
  assert.equal(notice.mock.calls[0].arguments[0].type, "supply_rejected");
});

test("approval rejects duplicate products and malformed items before stock writes", async () => {
  mock.method(SupplyRequest, "findById", async () => ({
    status: "pending",
    branch_id: branchId,
  }));
  const productId = id();
  for (const items of [
    [null],
    [{ product_id: "bad", quantity: 1 }],
    [
      { product_id: productId, quantity: 1 },
      { product_id: productId, quantity: 2 },
    ],
  ]) {
    await rejectsStatus(
      invoke(requests.approveRequest, { user: inventory, body: { items } }),
      400,
    );
  }
});

test("ready schema records ready time without starting an automatic confirmation deadline", async () => {
  const order = new Order({
    customer_id: customerId,
    branch_id: branchId,
    status: "ready",
    total_price: 100,
  });
  await order.validate();
  assert.ok(order.ready_at instanceof Date);
  assert.equal(order.auto_pickup_at, undefined);
});

const leave = await import("../src/controllers/leaveRequest.controller.js");
const payments = await import("../src/controllers/payment.controller.js");
const workflows =
  await import("../src/controllers/processingWorkflow.controller.js");
const orders = await import("../src/controllers/order.controller.js");
const { default: LeaveRequest } =
  await import("../src/models/leaveRequest.model.js");
const { default: Payment } = await import("../src/models/payment.model.js");

for (const role of ["customer", "front_desk", "inventory_officer"]) {
  test(`${role} cannot list leave requests`, async () => {
    const read = mock.method(LeaveRequest, "find", () => chain([]));
    await rejectsStatus(
      invoke(leave.getLeaveRequests, {
        user: { role, id: id(), branch_id: branchId },
      }),
      403,
    );
    assert.equal(read.mock.callCount(), 0);
  });
}
for (const role of [
  "employee",
  "branch_manager",
  "front_desk",
  "inventory_officer",
]) {
  test(`${role} payment lists cannot escape its branch using an order filter`, async () => {
    const branchOrders = mock.method(Order, "find", () =>
      chain([{ _id: orderId }]),
    );
    mock.method(Payment, "countDocuments", async () => 0);
    const read = mock.method(Payment, "find", () => chain([]));
    await invoke(payments.listPayments, {
      user: { role, branch_id: branchId },
      query: { orderId: id() },
    });
    assert.deepEqual(branchOrders.mock.calls[0].arguments[0], {
      branch_id: branchId,
    });
    assert.deepEqual(read.mock.calls[0].arguments[0].orderId, {
      $in: [orderId],
    });
  });
  test(`${role} cannot read payments for another branch`, async () => {
    mock.method(Order, "findById", async () => ({ branch_id: otherBranchId }));
    await rejectsStatus(
      invoke(payments.getPaymentByOrder, {
        user: { role, branch_id: branchId },
        params: { orderId },
      }),
      403,
    );
  });
  test(`${role} cannot create orders under its own staff identity`, async () => {
    await rejectsStatus(
      invoke(orders.createOrder, { user: { role, id: id() } }),
      403,
    );
  });
}
for (const role of ["branch_manager", "front_desk", "inventory_officer"]) {
  test(`${role} workflow list ignores a foreign branch filter`, async () => {
    const read = mock.method(ProcessingWorkflow, "find", () => chain([]));
    await invoke(workflows.getWorkflows, {
      user: { role, branch_id: branchId },
      query: { branch_id: otherBranchId },
    });
    assert.deepEqual(read.mock.calls[0].arguments[0], { branch_id: branchId });
  });
  test(`${role} cannot read another branch order workflows`, async () => {
    mock.method(Order, "findById", async () => ({ branch_id: otherBranchId }));
    await rejectsStatus(
      invoke(workflows.getOrderWorkflows, {
        user: { role, branch_id: branchId },
        params: { orderId },
      }),
      403,
    );
  });
}
for (const role of ["front_desk", "inventory_officer"]) {
  test(`${role} cannot initialize or record electronic payments outside its branch`, async () => {
    mock.method(Order, "findById", async () => ({ branch_id: otherBranchId }));
    for (const handler of [payments.initializePayment, payments.makePayment]) {
      await rejectsStatus(
        invoke(handler, {
          user: { role, branch_id: branchId },
          body: { orderId, email: "test@example.com", paymentMethod: "card" },
        }),
        403,
      );
    }
  });
}
test("frontend role and order enums match the database schemas", async () => {
  const { ROLES } = await import("../../frontend/src/constants/roles.js");
  const { ORDER_STATUSES } =
    await import("../../frontend/src/constants/orderStatuses.js");
  assert.deepEqual(
    Object.values(ROLES).sort(),
    [...User.schema.path("role").enumValues].sort(),
  );
  assert.deepEqual(
    Object.values(ORDER_STATUSES).sort(),
    [...Order.schema.path("status").enumValues].sort(),
  );
});
test("role landing pages avoid reports for operational staff", async () => {
  const { getRoleHome } = await import("../../frontend/src/constants/roles.js");
  assert.equal(getRoleHome("front_desk"), "/orders");
  assert.equal(getRoleHome("inventory_officer"), "/inventory");
  assert.equal(getRoleHome("employee"), "/processing");
  assert.equal(getRoleHome("branch_manager"), "/");
});

for (const role of ["employee", "branch_manager", "admin"]) {
  test(`${role} retains its intended leave visibility`, async () => {
    const employeeId = id();
    mock.method(Employee, "findOne", async () => ({ _id: employeeId }));
    mock.method(Employee, "find", async () => [{ _id: employeeId }]);
    const read = mock.method(LeaveRequest, "find", () => chain([]));
    await invoke(leave.getLeaveRequests, {
      user: { role, id: id(), branch_id: branchId },
    });
    const expected =
      role === "admin"
        ? {}
        : {
            employee_id:
              role === "employee" ? employeeId : { $in: [employeeId] },
          };
    assert.deepEqual(read.mock.calls[0].arguments[0], expected);
  });
}
for (const role of ["front_desk", "inventory_officer"]) {
  test(`${role} can still view workflows in its own branch`, async () => {
    mock.method(Order, "findById", async () => ({
      _id: orderId,
      branch_id: branchId,
    }));
    mock.method(ProcessingWorkflow, "find", () => chain([]));
    assert.equal(
      (
        await invoke(workflows.getOrderWorkflows, {
          user: { role, branch_id: branchId },
          params: { orderId },
        })
      ).code,
      200,
    );
  });
}

for (const role of ["admin", "branch_manager"]) {
  for (const elapsed of [48 * 3600000, 48 * 3600000 + 1]) {
    test(`${role} cannot refund at or after the delivery deadline (${elapsed})`, async () => {
      mock.method(Date, "now", () => now.getTime());
      mock.method(Payment, "findById", async () => ({
        _id: id(),
        orderId,
        status: "completed",
        amount: 500,
      }));
      mock.method(Order, "findById", async () => ({
        status: "delivered",
        delivered_at: new Date(now.getTime() - elapsed),
        branch_id: branchId,
      }));
      const write = mock.method(Payment, "create", async () => ({}));
      await rejectsStatus(
        invoke(payments.refundPayment, {
          user: { role, branch_id: branchId },
          params: { id: id() },
          body: { amount: 100, reason: "Return" },
        }),
        409,
      );
      assert.equal(write.mock.callCount(), 0);
    });
  }
}
for (const status of ["delivered", "ready"]) {
  test(`refund remains available for ${status} order within the deadline`, async () => {
    mock.method(Date, "now", () => now.getTime());
    mock.method(Payment, "findById", async () => ({
      _id: id(),
      orderId,
      status: "completed",
      amount: 500,
    }));
    mock.method(Order, "findById", async () => ({
      _id: orderId,
      status,
      delivered_at: new Date(now.getTime() - 48 * 3600000 + 1),
      branch_id: branchId,
      amount_due: 500,
      save: async () => {},
    }));
    mock.method(Payment, "aggregate", async () => []);
    const write = mock.method(Payment, "create", async (fields) => fields);
    const result = await invoke(payments.refundPayment, {
      user: { role: "admin", id: id() },
      params: { id: id() },
      body: { amount: 100, reason: "Return" },
    });
    assert.equal(result.code, 201);
    assert.equal(write.mock.callCount(), 1);
  });
}
test("delivered orders without a timestamp cannot bypass the refund deadline", async () => {
  mock.method(Payment, "findById", async () => ({
    orderId,
    status: "completed",
  }));
  mock.method(Order, "findById", async () => ({ status: "delivered" }));
  await rejectsStatus(
    invoke(payments.refundPayment, {
      user: { role: "admin" },
      body: { amount: 100, reason: "Return" },
    }),
    409,
  );
});
test("frontend refund eligibility follows the delivery deadline", async () => {
  const { isWithinRefundWindow } =
    await import("../../frontend/src/utils/refundEligibility.js");
  const order = { status: "delivered", delivered_at: now.toISOString() };
  assert.equal(
    isWithinRefundWindow(order, now.getTime() + 48 * 3600000 - 1),
    true,
  );
  assert.equal(
    isWithinRefundWindow(order, now.getTime() + 48 * 3600000),
    false,
  );
  assert.equal(isWithinRefundWindow({ status: "delivered" }), false);
  assert.equal(isWithinRefundWindow({ status: "ready" }), true);
});

test("leave request submission rejects overlapping pending or approved leave", async () => {
  const employeeId = id();
  mock.method(Employee, "findOne", async () => ({ _id: employeeId }));
  mock.method(LeaveRequest, "findOne", async () => ({
    _id: id(),
    status: "pending",
  }));
  await rejectsStatus(
    invoke(leave.submitLeaveRequest, {
      user: { role: "employee", id: id() },
      body: {
        start_date: "2026-10-05",
        end_date: "2026-10-10",
        reason: "Vacation",
      },
    }),
    400,
  );
});

test("leave request submission rejects invalid date ranges", async () => {
  const employeeId = id();
  mock.method(Employee, "findOne", async () => ({ _id: employeeId }));
  await rejectsStatus(
    invoke(leave.submitLeaveRequest, {
      user: { role: "employee", id: id() },
      body: {
        start_date: "2026-10-15",
        end_date: "2026-10-10",
        reason: "Vacation",
      },
    }),
    400,
  );
});

test("approving an already decided leave request is rejected", async () => {
  mock.method(LeaveRequest, "findById", async () => ({ status: "approved" }));
  await rejectsStatus(
    invoke(leave.approveLeaveRequest, {
      user: { role: "admin", id: id() },
      params: { id: id() },
    }),
    400,
  );
});

test("rejecting an already decided leave request is rejected", async () => {
  mock.method(LeaveRequest, "findById", async () => ({ status: "rejected" }));
  await rejectsStatus(
    invoke(leave.rejectLeaveRequest, {
      user: { role: "admin", id: id() },
      params: { id: id() },
      body: { rejection_reason: "Already handled" },
    }),
    400,
  );
});

test("rejecting a leave request without reason is rejected", async () => {
  mock.method(LeaveRequest, "findById", async () => ({ status: "pending" }));
  await rejectsStatus(
    invoke(leave.rejectLeaveRequest, {
      user: { role: "admin", id: id() },
      params: { id: id() },
      body: { rejection_reason: "   " },
    }),
    400,
  );
});

test("approving leave is blocked when employee has active workflow tasks", async () => {
  const employeeId = id();
  mock.method(LeaveRequest, "findById", async () => ({
    _id: id(),
    employee_id: employeeId,
    status: "pending",
  }));
  mock.method(Employee, "findById", async () => ({
    _id: employeeId,
    branch_id: branchId,
  }));
  mock.method(ProcessingWorkflow, "findOne", async () => ({
    _id: id(),
    status: "active",
  }));
  await rejectsStatus(
    invoke(leave.approveLeaveRequest, {
      user: { role: "branch_manager", id: id(), branch_id: branchId },
      params: { id: id() },
    }),
    400,
  );
});

test("approving leave succeeds and sends notification when valid", async () => {
  const employeeId = id(),
    userId = id();
  const reqDoc = {
    _id: id(),
    employee_id: employeeId,
    status: "pending",
    start_date: new Date("2026-10-05"),
    end_date: new Date("2026-10-10"),
    save: mock.fn(async () => {}),
    populate: mock.fn(async () => reqDoc),
  };
  mock.method(LeaveRequest, "findById", async () => reqDoc);
  mock.method(Employee, "findById", async () => ({
    _id: employeeId,
    user_id: userId,
    branch_id: branchId,
  }));
  mock.method(ProcessingWorkflow, "findOne", async () => null);
  const notif = mock.method(Notification, "create", async () => ({}));

  const res = await invoke(leave.approveLeaveRequest, {
    user: { role: "branch_manager", id: id(), branch_id: branchId },
    params: { id: id() },
  });
  assert.equal(res.code, 200);
  assert.equal(reqDoc.status, "approved");
  assert.equal(notif.mock.callCount(), 1);
  assert.equal(notif.mock.calls[0].arguments[0].user_id, userId);
});

test("createWorkflow rejects attendants with overlapping approved leave", async () => {
  const attendantId = id();
  mock.method(Order, "findById", async () => ({
    _id: orderId,
    branch_id: branchId,
    status: "received",
    items: [{ category: "regular" }],
    fulfillment: { turnaround_hours: 24 },
  }));
  mock.method(ProcessingWorkflow, "exists", async () => false);
  mock.method(Employee, "find", () =>
    chain([
      {
        _id: attendantId,
        branch_id: branchId,
        is_active: true,
        user_id: { name: "Attendant One" },
      },
    ]),
  );
  mock.method(ProcessingWorkflow, "find", () => chain([]));
  mock.method(Order, "countDocuments", async () => 0);
  mock.method(LeaveRequest, "findOne", async () => ({
    _id: id(),
    employee_id: attendantId,
    status: "approved",
  }));

  await rejectsStatus(
    invoke(workflows.createWorkflow, {
      user: { role: "branch_manager", id: id(), branch_id: branchId },
      body: {
        order_id: orderId,
        steps: [{ name: "washing", employee_id: attendantId }],
      },
    }),
    400,
  );
});

test("calculateSuppliesForOrder computes whole-order supply needs across all stages", () => {
  const order = {
    items: [
      { name: "Washing", category: "Laundry", type: "service", quantity: 3 },
      {
        name: "Dry Cleaning",
        category: "Dry Cleaning",
        type: "service",
        quantity: 2,
      },
    ],
  };
  const { totalSupplies, stageSupplies } =
    inventoryService.calculateSuppliesForOrder(order);
  assert(Array.isArray(totalSupplies));
  assert(stageSupplies.washing.length > 0);
  assert(stageSupplies.processing.length > 0);
  assert(stageSupplies.packaging.length > 0);

  const detergent = totalSupplies.find(
    (s) => s.productName === "Laundry Detergent",
  );
  const solvent = totalSupplies.find(
    (s) => s.productName === "Dry Cleaning Solvent",
  );
  const packaging = totalSupplies.find(
    (s) => s.productName === "Packaging Nylon",
  );

  assert.equal(detergent?.quantity, 1);
  assert.equal(solvent?.quantity, 1);
  assert.equal(packaging?.quantity, 5); // 3 + 2 garments
});

test("createOrder rejects with 409 and sends shortage notices when stock is insufficient", async () => {
  const serviceId = id(),
    customerUserId = id(),
    branchManagerId = id(),
    officerId = id();
  mock.method(Order, "findOne", () => chain(null));
  mock.method(Service, "findById", async () => ({
    _id: serviceId,
    name: "Washing",
    price: 1500,
    is_active: true,
    branch_id: branchId,
    type: "service",
    turnaround_hours: 24,
  }));
  mock.method(Product, "findOne", async () => ({
    _id: id(),
    name: "Laundry Detergent",
    quantity: 2,
    reserved_quantity: 2, // 0 available!
    is_active: true,
    unit: "scoop",
  }));
  mock.method(Employee, "find", () =>
    chain([{ user_id: branchManagerId }, { user_id: officerId }]),
  );
  mock.method(User, "find", () =>
    chain([
      { _id: branchManagerId, role: "branch_manager" },
      { _id: officerId, role: "inventory_officer" },
    ]),
  );
  const notif = mock.method(Notification, "create", async () => ({}));

  await rejectsStatus(
    invoke(orders.createOrder, {
      user: { role: "customer", id: customerUserId },
      body: {
        branch_id: branchId,
        items: [{ service_id: serviceId, quantity: 2 }],
        pickup_time: new Date(Date.now() + 86400000).toISOString(),
      },
    }),
    409,
  );

  // Customer and officer were notified
  assert(notif.mock.callCount() >= 2);
});

test("createOrder atomically reserves stock when supplies are available", async () => {
  const serviceId = id(),
    customerUserId = id(),
    prodId = id();
  mock.method(Order, "findOne", () => chain(null));
  mock.method(Service, "findById", async () => ({
    _id: serviceId,
    name: "Washing",
    price: 1500,
    is_active: true,
    branch_id: branchId,
    type: "service",
    turnaround_hours: 24,
  }));
  mock.method(Product, "findOne", async () => ({
    _id: prodId,
    name: "Laundry Detergent",
    quantity: 100,
    reserved_quantity: 0,
    is_active: true,
    unit: "scoop",
  }));
  const findOneAndUpdate = mock.method(
    Product,
    "findOneAndUpdate",
    async () => ({
      _id: prodId,
      name: "Laundry Detergent",
      quantity: 100,
      reserved_quantity: 1,
      unit: "scoop",
    }),
  );
  mock.method(Order, "create", async (doc) => ({ _id: orderId, ...doc }));
  mock.method(Notification, "create", async () => ({}));
  mock.method(User, "find", () => chain([]));
  mock.method(Employee, "find", () => chain([]));
  mock.method(Branch, "findById", () => chain({ name: "Central Branch" }));

  const res = await invoke(orders.createOrder, {
    user: { role: "customer", id: customerUserId },
    body: {
      branch_id: branchId,
      items: [{ service_id: serviceId, quantity: 2 }],
      pickup_time: new Date(Date.now() + 86400000).toISOString(),
    },
  });

  assert.equal(res.code, 201);
  assert(findOneAndUpdate.mock.callCount() > 0);
  assert(res.data.supplies_reserved.length > 0);
});

test("concurrent order creation for last stock unit allows only one to succeed and rolls back loser", async () => {
  const detergentId = id(),
    customer1 = id();
  let currentReserved = 0;
  const stockQty = 1;

  const nameMatch = (queryName, expected) => {
    if (!queryName) return false;
    const regex = queryName instanceof RegExp ? queryName : queryName.$regex;
    if (regex && typeof regex.test === "function") return regex.test(expected);
    return String(queryName).toLowerCase() === expected.toLowerCase();
  };

  mock.method(Product, "findOne", async (query) => {
    if (nameMatch(query.name, "Laundry Detergent")) {
      return {
        _id: detergentId,
        name: "Laundry Detergent",
        quantity: stockQty,
        reserved_quantity: currentReserved,
        is_active: true,
        unit: "scoop",
      };
    }
    return {
      _id: id(),
      name: "Generic Supply",
      quantity: 100,
      reserved_quantity: 0,
      is_active: true,
      unit: "pieces",
    };
  });

  mock.method(Product, "findOneAndUpdate", async (filter, update) => {
    if (filter._id === detergentId) {
      const needed = update.$inc.reserved_quantity;
      if (stockQty - currentReserved >= needed) {
        currentReserved += needed;
        return {
          _id: detergentId,
          name: "Laundry Detergent",
          quantity: stockQty,
          reserved_quantity: currentReserved,
          unit: "scoop",
        };
      }
      return null; // Atomic condition failed: insufficient stock!
    }
    return {
      _id: filter._id,
      name: "Generic Supply",
      quantity: 100,
      reserved_quantity: 0,
      unit: "pieces",
    };
  });
  mock.method(Product, "updateOne", async (filter, update) => {
    if (filter._id === detergentId) {
      currentReserved += update.$inc.reserved_quantity;
    }
  });
  mock.method(Notification, "create", async () => ({}));
  mock.method(Employee, "find", () => chain([]));
  mock.method(User, "find", () => chain([]));

  // Order 1 succeeds
  const reserved1 = await inventoryService.checkAndReserveSuppliesForOrder({
    branch_id: branchId,
    items: [
      { name: "Washing", category: "Laundry", type: "service", quantity: 2 },
    ],
    customer_id: customer1,
  });
  assert(reserved1.length > 0);
  assert.equal(currentReserved, 1);

  // Order 2 fails and attempts rollback
  await assert.rejects(
    inventoryService.checkAndReserveSuppliesForOrder({
      branch_id: branchId,
      items: [
        { name: "Washing", category: "Laundry", type: "service", quantity: 2 },
      ],
      customer_id: id(),
    }),
    (err) => err.statusCode === 409,
  );
});

test("attendant step acceptance consumes reserved supplies and creates usage stock movement", async () => {
  const attendantUserId = id(),
    attendantId = id(),
    prodId = id(),
    stepId = id();
  const orderDoc = {
    _id: orderId,
    branch_id: branchId,
    customer_id: customerId,
    supplies_reserved: [
      {
        product_id: prodId,
        name: "Laundry Detergent",
        quantity: 2,
        unit: "scoop",
        stage: "washing",
        consumed: false,
      },
    ],
    supplies_used: [],
    save: mock.fn(async () => {}),
  };
  const productDoc = {
    _id: prodId,
    name: "Laundry Detergent",
    quantity: 10,
    reserved_quantity: 2,
    reorder_point: 5,
    save: mock.fn(async () => {}),
  };
  const stepDoc = {
    _id: stepId,
    name: "washing",
    sequence: 1,
    status: "assigned",
    employee_id: attendantId,
  };
  const workflowDoc = {
    _id: id(),
    order_id: orderId,
    status: "active",
    steps: Object.assign([stepDoc], { id: () => stepDoc }),
    save: mock.fn(async () => {}),
    populate: mock.fn(async () => workflowDoc),
  };

  mock.method(ProcessingWorkflow, "findById", async () => workflowDoc);
  mock.method(Employee, "findOne", async () => ({
    _id: attendantId,
    user_id: attendantUserId,
  }));
  mock.method(Order, "findById", async () => orderDoc);
  mock.method(Product, "findById", async () => productDoc);
  const stockMove = mock.method(StockMovement, "create", async () => ({}));
  mock.method(Notification, "create", async () => ({}));

  const res = await invoke(workflows.updateStep, {
    user: { role: "employee", id: attendantUserId },
    params: { id: workflowDoc._id, stepId },
    body: { action: "accept" },
  });

  assert.equal(res.code, 200);
  assert.equal(stepDoc.status, "accepted");
  assert.equal(productDoc.quantity, 8);
  assert.equal(productDoc.reserved_quantity, 0);
  assert.equal(orderDoc.supplies_reserved[0].consumed, true);
  assert.equal(orderDoc.supplies_used.length, 1);
  assert.equal(stockMove.mock.callCount(), 1);
  assert.equal(stockMove.mock.calls[0].arguments[0][0].type, "usage");
});

test("customer order cancellation releases unconsumed reserved supplies", async () => {
  const prodId = id(),
    customerUserId = id();
  const orderDoc = {
    _id: orderId,
    customer_id: customerUserId,
    status: "placed",
    createdAt: new Date(),
    supplies_reserved: [
      {
        product_id: prodId,
        name: "Laundry Detergent",
        quantity: 3,
        consumed: false,
      },
    ],
    save: mock.fn(async () => {}),
  };
  mock.method(Order, "findById", async () => orderDoc);
  const updateProduct = mock.method(Product, "updateOne", async () => ({}));
  mock.method(Notification, "create", async () => ({}));

  const res = await invoke(orders.updateOrder, {
    user: { role: "customer", id: customerUserId },
    params: { id: orderId },
    body: { status: "cancelled" },
  });

  assert.equal(res.code, 200);
  assert.equal(orderDoc.status, "cancelled");
  assert.equal(updateProduct.mock.callCount(), 1);
  assert.deepEqual(updateProduct.mock.calls[0].arguments[1], {
    $inc: { reserved_quantity: -3 },
  });
});

test("forceCancelOrder releases unconsumed reserved supplies", async () => {
  const prodId = id();
  const orderDoc = {
    _id: orderId,
    customer_id: customerId,
    branch_id: branchId,
    status: "placed",
    total_price: 5000,
    payment_status: "unpaid",
    supplies_reserved: [
      {
        product_id: prodId,
        name: "Packaging Nylon",
        quantity: 4,
        consumed: false,
      },
    ],
    save: mock.fn(async () => {}),
  };
  mock.method(Order, "findById", async () => orderDoc);
  const updateProduct = mock.method(Product, "updateOne", async () => ({}));
  mock.method(Notification, "create", async () => ({}));

  const res = await invoke(orders.forceCancelOrder, {
    user: { role: "branch_manager", id: id(), branch_id: branchId },
    params: { id: orderId },
    body: { reason: "Customer requested" },
  });

  assert.equal(res.code, 200);
  assert.equal(orderDoc.status, "cancelled");
  assert.equal(updateProduct.mock.callCount(), 1);
  assert.deepEqual(updateProduct.mock.calls[0].arguments[1], {
    $inc: { reserved_quantity: -4 },
  });
});

test("adjustReservedSuppliesForIntake modifies reservations when item counts change", async () => {
  const detergentId = id(),
    softenerId = id(),
    nylonId = id(),
    hangerId = id();
  const orderDoc = {
    _id: orderId,
    branch_id: branchId,
    supplies_reserved: [
      {
        product_id: detergentId,
        name: "Laundry Detergent",
        quantity: 1,
        unit: "scoop",
        stage: "washing",
        consumed: false,
      },
      {
        product_id: softenerId,
        name: "Fabric Softener",
        quantity: 1,
        unit: "cap",
        stage: "washing",
        consumed: false,
      },
      {
        product_id: nylonId,
        name: "Packaging Nylon",
        quantity: 2,
        unit: "pieces",
        stage: "packaging",
        consumed: false,
      },
      {
        product_id: hangerId,
        name: "Hanger",
        quantity: 2,
        unit: "pieces",
        stage: "packaging",
        consumed: false,
      },
    ],
  };

  const nameMatch = (queryName, expected) => {
    if (!queryName) return false;
    const regex = queryName instanceof RegExp ? queryName : queryName.$regex;
    if (regex && typeof regex.test === "function") return regex.test(expected);
    return String(queryName).toLowerCase() === expected.toLowerCase();
  };

  mock.method(Product, "findOne", async (query) => {
    if (nameMatch(query.name, "Laundry Detergent"))
      return {
        _id: detergentId,
        name: "Laundry Detergent",
        quantity: 10,
        reserved_quantity: 1,
        is_active: true,
        unit: "scoop",
      };
    if (nameMatch(query.name, "Fabric Softener"))
      return {
        _id: softenerId,
        name: "Fabric Softener",
        quantity: 10,
        reserved_quantity: 1,
        is_active: true,
        unit: "cap",
      };
    if (nameMatch(query.name, "Packaging Nylon"))
      return {
        _id: nylonId,
        name: "Packaging Nylon",
        quantity: 50,
        reserved_quantity: 2,
        is_active: true,
        unit: "pieces",
      };
    if (nameMatch(query.name, "Hanger"))
      return {
        _id: hangerId,
        name: "Hanger",
        quantity: 50,
        reserved_quantity: 2,
        is_active: true,
        unit: "pieces",
      };
    return null;
  });
  const findOneAndUpdate = mock.method(
    Product,
    "findOneAndUpdate",
    async (filter, update) => ({
      _id: filter._id,
      quantity: 10,
      reserved_quantity: 2,
    }),
  );
  mock.method(Product, "updateOne", async () => ({}));

  // Intake increases Washing quantity from small (2 items -> 1 scoop) to medium (8 items -> 2 scoops, 8 nylons, 8 hangers)
  await inventoryService.adjustReservedSuppliesForIntake({
    order: orderDoc,
    intakeItems: [
      { name: "Washing", category: "Laundry", type: "service", quantity: 8 },
    ],
    branch_id: branchId,
  });

  const detergentCall = findOneAndUpdate.mock.calls.find(
    (c) => c.arguments[0]._id === detergentId,
  );
  assert(detergentCall);
  assert.deepEqual(detergentCall.arguments[1], {
    $inc: { reserved_quantity: 1 },
  });
});

test("generateAdminDigests aggregates orders per branch and sends branch_digest notifications to active admins", async () => {
  const admin1Id = id(),
    admin2Id = id(),
    branch1Id = id(),
    branch2Id = id();

  mock.method(User, "find", () =>
    chain([
      { _id: admin1Id, role: "admin", is_active: true },
      { _id: admin2Id, role: "admin", is_active: true },
    ]),
  );
  mock.method(Branch, "find", () =>
    chain([
      { _id: branch1Id, name: "Ikeja Main", is_active: true },
      { _id: branch2Id, name: "VI Branch", is_active: true },
    ]),
  );
  mock.method(Order, "aggregate", async () => [
    { _id: branch1Id, orderCount: 5, totalRevenue: 25000 },
  ]);

  const createdNotifs = [];
  mock.method(Notification, "create", async (payload) => {
    createdNotifs.push(payload);
    return payload;
  });

  const result = await generateAdminDigests({
    now: new Date("2026-10-01T08:00:00Z"),
  });

  assert.equal(result.adminCount, 2);
  assert.equal(result.branchCount, 2);
  assert.equal(result.notificationsSent, 4); // 2 admins * 2 branches
  assert.equal(createdNotifs.length, 4);

  const ikejaForAdmin1 = createdNotifs.find(
    (n) => n.user_id === admin1Id && n.message.includes("Ikeja Main"),
  );
  assert(ikejaForAdmin1);
  assert.equal(ikejaForAdmin1.type, "branch_digest");
  assert(ikejaForAdmin1.message.includes("5 orders"));
  assert(ikejaForAdmin1.message.includes("25,000"));

  const viForAdmin1 = createdNotifs.find(
    (n) => n.user_id === admin1Id && n.message.includes("VI Branch"),
  );
  assert(viForAdmin1);
  assert.equal(viForAdmin1.type, "branch_digest");
  assert(viForAdmin1.message.includes("0 orders"));
});

test("generateAdminDigests skips processing when no active admins or branches exist", async () => {
  mock.method(User, "find", () => chain([]));
  mock.method(Branch, "find", () => chain([]));
  const createdNotifs = [];
  mock.method(Notification, "create", async (payload) => {
    createdNotifs.push(payload);
    return payload;
  });

  const result = await generateAdminDigests();
  assert.equal(result.adminCount, 0);
  assert.equal(result.branchCount, 0);
  assert.equal(result.notificationsSent, 0);
  assert.equal(createdNotifs.length, 0);
});

test("createOrder notifies only branch_manager and front_desk staff alongside the customer", async () => {
  const serviceId = id(),
    customerUserId = id(),
    managerUserId = id(),
    frontDeskUserId = id(),
    attendantUserId = id(),
    orderBranchId = id();

  mock.method(Order, "findOne", () => chain(null));
  mock.method(Service, "findById", async () => ({
    _id: serviceId,
    name: "Ironing",
    price: 1000,
    is_active: true,
    branch_id: orderBranchId,
    type: "service",
    turnaround_hours: 12,
  }));
  mock.method(Product, "findOne", async () => ({
    _id: id(),
    name: "Packaging Nylon",
    quantity: 100,
    reserved_quantity: 0,
    is_active: true,
    unit: "pieces",
  }));
  mock.method(Product, "findOneAndUpdate", async () => ({
    _id: id(),
    quantity: 100,
    reserved_quantity: 1,
  }));
  const createdOrderDoc = {
    _id: id(),
    customer_id: customerUserId,
    branch_id: orderBranchId,
    items: [
      { service_id: serviceId, quantity: 1, unit_price: 1000, subtotal: 1000 },
    ],
    total_price: 1000,
  };
  mock.method(Order, "create", async () => createdOrderDoc);
  mock.method(Branch, "findById", () =>
    chain({ _id: orderBranchId, name: "Lekki Branch" }),
  );

  mock.method(Employee, "find", () => ({
    populate: async ({ match }) => {
      const allowedRoles = match?.role?.$in || [];
      const employees = [
        {
          _id: id(),
          branch_id: orderBranchId,
          user_id: allowedRoles.includes("branch_manager")
            ? { _id: managerUserId, role: "branch_manager" }
            : null,
        },
        {
          _id: id(),
          branch_id: orderBranchId,
          user_id: allowedRoles.includes("front_desk")
            ? { _id: frontDeskUserId, role: "front_desk" }
            : null,
        },
        {
          _id: id(),
          branch_id: orderBranchId,
          user_id: null,
        },
      ];
      return employees;
    },
  }));

  const sentNotifications = [];
  mock.method(Notification, "create", async (payload) => {
    sentNotifications.push(payload);
    return payload;
  });

  const res = await invoke(orders.createOrder, {
    user: { role: "customer", id: customerUserId },
    body: {
      branch_id: orderBranchId,
      items: [{ service_id: serviceId, quantity: 1 }],
      pickup_time: new Date(Date.now() + 86400000).toISOString(),
    },
  });

  assert.equal(res.code, 201);
  assert.equal(sentNotifications.length, 3);
  const recipientIds = sentNotifications.map((n) => n.user_id.toString());
  assert(recipientIds.includes(customerUserId.toString()));
  assert(recipientIds.includes(managerUserId.toString()));
  assert(recipientIds.includes(frontDeskUserId.toString()));
  assert(!recipientIds.includes(attendantUserId.toString()));
});
