# Laundry & Dry-Cleaning ERP ? Backend

Express API with MongoDB/Mongoose, cookie-based authentication, role/branch authorization, inventory approvals, order processing, payments, and scheduled jobs.

Read the [full-stack README](../README.md) for local setup, the permission matrix, frontend integration, migration deployment, and verification results.

## Run and verify

```sh
npm install
npm run dev
npm test
```

`npm start` starts the server without nodemon. Configure `MONGODB_URI`, `JWT_SECRET`, `PORT`, frontend origins, and required integration credentials in `.env`. The default API address is `http://localhost:3573/api/v1`; `PORT` overrides it. Health is available at `/api/health` after startup completes.

## Backend changes

- `models/user.model.js`: one inventory role (`inventory_officer`), with `branch_manager` as the canonical branch-management role.
- `controllers/auth.controller.js` and `middlewares/auth.middleware.js`: unified inventory branch-context handling.
- `controllers/employee.controller.js`: unified assignable staff-role list.
- `controllers/branch.controller.js`: inventory staff counted under `inventoryOfficers`; removed the separate manager count.
- Product, stock-movement, and supply-request routes/controllers: unified permissions; inventory officers retain branch-limited product deactivation and request approval/rejection.
- `jobs/lowStockCheck.job.js` and `services/inventoryConsumption.service.js`: unified low-stock recipients. Supply-request notifications also target the unified role.
- `services/inventoryRoleMigration.service.js` and `server.js`: automatically convert stored `inventory_manager` accounts before listening. The migration preserves linked records, is repeatable, and must succeed for startup to complete.
- `controllers/leaveRequest.controller.js`: explicit listing allowlist prevents other roles from falling through to an unrestricted query.
- `controllers/payment.controller.js`: branch-scoped staff payment access and electronic payment operations; refund deadline at 48 hours after actual delivery.
- `controllers/processingWorkflow.controller.js`: branch restrictions for front desk/inventory officers and removal of a duplicated branch-manager check.
- `controllers/order.controller.js`: only customers/admins can create orders; staff cannot create an order under their own staff identity.

## Refund API

`POST /api/v1/payments/:id/refund` requires an admin or branch manager, a completed original payment, a positive `amount`, and a nonempty `reason`. Branch managers are limited to their branch. Existing balance and duplicate-refund checks remain.

Delivered orders return HTTP 409 at or after `delivered_at + 48 hours`. Missing/invalid delivery timestamps also return 409. Non-delivered orders remain subject to the other refund checks. The cutoff cannot be overridden by an admin.

## Tests

`test/backend-features.test.js` covers permissions, branch scoping, allowed operations, frontend/schema enum agreement, landing-page mapping, and refund boundary cases alongside existing order/inventory tests. `test/inventory-role-migration.test.js` covers supported/retired roles, migration updates, and error propagation. The latest implementation run passed 82 tests without connecting to the configured database.

## Contributor guides

- [Jasmine guide](guides/jasmine-guide.md)
- [Josh guide](guides/josh-guide.md)
- [Series guide](guides/series-guide.md)
- [Catalog, inventory, and pickup](guides/catalog-inventory-pickup.md)

Review the applicable guide before changing a module. The former scaffold-only setup notes no longer describe this implementation.
