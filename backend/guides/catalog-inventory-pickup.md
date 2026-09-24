# Catalog, branch search, inventory management, and pickup APIs

All paths below start with `/api/v1`. Only backend files changed.

## Service categories

Admins manage services and categories in any branch. Branch managers manage
their assigned branch. Existing admin-only price editing remains in place.

- `GET /service-categories?branch_id=<id>&q=clean`: public active category list.
- `POST /service-categories`: `{ "branch_id": "...", "name": "Dry Cleaning", "description": "..." }`.
  Branch managers can omit `branch_id`; a different branch is rejected.
- `PATCH /service-categories/:id`: update `name`, `description`, or `is_active`.
- `DELETE /service-categories/:id`: deactivate; historical references remain.
- `POST /services`: accepts `category_id` alongside existing service fields.
- `PATCH /services/:id`: accepts `category_id` to change the category.
- `GET /services`: supports `branch_id`, `category_id`, legacy `category`,
  `type=service|add-on`, and literal name search `q`.

Category names are unique within each branch, ignoring case. Services can only
reference an active category from their own branch. `type` retains the existing
`service` / `add-on` distinction. Service reads populate `category_id` with the
current category name, description, and active state. The legacy `category`
string remains a compatibility label; historical order items remain snapshots.
Deactivating a category prevents new assignments without deactivating its services.

Legacy clients sending a category name continue to work: creation or reassignment
resolves that name to a reusable category (default `general`). For existing
database entries, run `npm run migrate:service-categories` from `backend` using
the intended database configuration. It is idempotent and links services without
rewriting orders; it also creates the category, service, and order indexes needed
in production, where automatic index creation is disabled. This migration has
not been run against a live database as part of the code changes.

## Finding branches

`GET /branches?q=ikeja&address=Lagos&page=1&limit=20&sort_by=name&sort_order=asc`

- `q` (alias `search`) searches name, address, and phone.
- `name`, `address`, and `phone` narrow those fields separately.
- Searches are literal, case-insensitive partial matches.
- `sort_by`: `name` (default) or `createdAt`; `sort_order`: `asc` or `desc`.
- `page` starts at 1; `limit` defaults to 20 and is capped at 100.

`data` stays an array. Supplying `page` or `limit` also returns top-level
`pagination: { page, limit, total, pages }`. Omitting pagination preserves the
existing complete-list behavior for current clients.

## Inventory manager

Admins can assign `inventory_manager` through employee creation or role updates.
The account needs an active employee record and branch assignment. Login includes
the branch context, and subsequent API requests enforce that branch.

Inventory managers can create, update, and deactivate branch inventory products,
record stock movements, view supply requests, and approve or reject them. They
receive new-request and low-stock notifications. Existing `inventory_officer`
accounts continue working. Admins retain access; branch managers retain inventory
catalog management and request oversight. Only admins and inventory staff can
record stock movements; ordinary employees request supplies through their assigned
workflow step instead of deducting stock directly.

Existing request endpoints remain:

- `POST /supply-requests`: assigned employee sends `{ workflow_id, step_id }`.
- `GET /supply-requests?status=pending`: branch inventory queue.
- `PATCH /supply-requests/:id/approve`: `{ items: [{ product_id, quantity }] }`.
- `PATCH /supply-requests/:id/reject`: `{ reason }`.

Approval validates active products in the request branch, uses canonical product
names and units, and commits the request decision, stock deduction, movement
ledger, and order usage together. A competing review cannot deduct stock twice.

## Sent out and pickup confirmation

1. Quality approval moves the order to `ready`. This does **not** start a timer.
2. Admin, branch manager, or front desk calls `PATCH /orders/:id/send-out`.
   The order becomes `sent_out`; `sent_out_at` and `auto_pickup_at` are persisted.
   The customer gets an in-app notification explaining that confirmation becomes
   automatic in 2 days and showing the exact deadline.
3. The owning customer calls `PATCH /orders/:id/pickup` after receiving it.
   Staff listed above may also confirm within their scope. A ready order collected
   directly at the branch can be confirmed without first being sent out.
4. A job runs every minute, including an immediate catch-up after server startup.
   Unconfirmed `sent_out` orders become picked up at or after 48 hours. The job
   handles up to 500 overdue orders per run, so a large backlog can take longer.

For compatibility, confirmed pickup uses existing terminal status `delivered`.
It records `picked_up_at`, `delivered_at`, `pickup_confirmed_at`, and
`pickup_confirmation_source` (`customer`, `staff`, or `automatic`), plus
`pickup_confirmed_by` for human confirmations. Payment fields are not modified.
Repeated confirmation returns the existing result without duplicate notifications.
Both dispatch and confirmation atomically persist the order and its in-app notice.

`PATCH /orders/:id` also accepts a status-only body of `{ "status": "sent_out" }`
or `{ "status": "delivered" }` under the same permissions. Other updates must be
sent separately. Clients should recognize the new `sent_out` status and use the
new fields/endpoints when adding their UI.

The backend process must be running for scheduled confirmation. MongoDB must
support transactions (replica set or sharded deployment), as already required by
the inventory stock-movement implementation.

## Verification

Run `npm test` from `backend`. Tests exercise permission boundaries, query
validation, categories, inventory approval guards, and pickup timing and
idempotency with mocked persistence. They do not use the configured database.
Real MongoDB transaction integration still requires a test replica set.
