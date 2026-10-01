# Laundry & Dry-Cleaning ERP

Full-stack laundry management application with a React/Vite frontend and an Express/Mongoose backend. This README documents the current role consolidation, access-control fixes, order UI updates, and delivery-based refund deadline.

## Project layout

| Directory | Responsibility |
| --- | --- |
| `backend/` | API, authentication, MongoDB models, inventory, orders, payments, background jobs, and tests |
| `frontend/` | Customer and staff interfaces, API client, navigation, forms, and role-aware controls |

See the [backend README](backend/README.md), [frontend README](frontend/README.md), and [catalog/inventory/pickup guide](backend/guides/catalog-inventory-pickup.md) for implementation details.

## Local setup

Install dependencies in each application directory with `npm install`. Configure each application's `.env` from its example without committing credentials.

A consistent local configuration is:

```dotenv
# backend/.env
NODE_ENV=development
PORT=3573
MONGODB_URI=<your MongoDB connection string>
JWT_SECRET=<your private secret>
FRONTEND_URI=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

```dotenv
# frontend/.env
VITE_API_URL=http://localhost:3573/api/v1
```

Configure Redis and email/payment integrations as needed for the features in use. The backend reads `MONGODB_URI`; do not rely on the older `DATABASE_URL` example entry. A blank `NODE_ENV` falls back to `development`. Production requires a JWT secret.

Run these commands in separate terminals:

```sh
cd backend
npm run dev
```

```sh
cd frontend
npm run dev
```

On PowerShell installations that block `npm.ps1`, use `npm.cmd` instead of `npm`.

The backend defaults to port `3573` when `PORT` is unset. A configured `PORT=5000` overrides that default, so the frontend URL must then use port `5000`. Restart the relevant process after changing environment files. Check `http://localhost:<PORT>/api/health` before testing login. `ERR_CONNECTION_REFUSED` means the browser cannot reach a listening API at that address; it is not an incorrect-password response. The backend connects to MongoDB and runs the inventory-role migration before listening for requests.

## Canonical roles and landing pages

| Role value | Default signed-in page |
| --- | --- |
| `admin` | Dashboard (`/`) |
| `branch_manager` | Dashboard (`/`) |
| `employee` | Processing (`/processing`) |
| `front_desk` | Orders (`/orders`) |
| `inventory_officer` | Inventory (`/inventory`) |
| `customer` | Customer orders (`/`) |

Use `branch_manager`, never `manager`, as a role value. The frontend exports `ROLES.BRANCH_MANAGER`. The backend user enum, frontend role constants, and login allowlist use the same six roles. Employee creation/editing dropdowns now expose all five staff roles, including front desk and inventory officer. Only admins can assign/change employee roles.

## Inventory role consolidation

`inventory_officer` is the single inventory role. The former `inventory_manager` role has been removed from current role enums, assignment lists, authorization checks, and notification recipient lists.

Inventory officers can, within their assigned branch:

- Create, edit, and deactivate inventory products.
- Record stock movements.
- View supply requests and approve or reject them.
- Receive supply-request and low-stock notifications.

The merge retains the former manager's product-deactivation permission. Login and request authentication attach the inventory officer's employee/branch context. Branch statistics report `inventoryOfficers`; the separate `inventoryManagers` count was removed.

At backend startup, `migrateInventoryRoles()` updates stored `inventory_manager` user roles to `inventory_officer`. It changes only the role, preserving account IDs, employee references, branch assignments, and history. Repeated runs are safe because converted accounts no longer match the filter. The migration completes before the server accepts requests; a database error prevents successful startup. Adding this code does not itself migrate a running database: restart/deploy the backend to execute it.

## Access-control changes

| Area | Current behavior |
| --- | --- |
| Leave-request listing | Employees see their own requests; branch managers see their branch; admins see all. Customers, front desk, and inventory officers receive 403. |
| Leave navigation | Visible only to employees, branch managers, and admins. Existing leave submission remains employee-only. |
| Payment listing | Customers see their own payments; all non-admin staff are limited to orders in their assigned branch; admins retain global access. |
| Payment lookup | Staff cannot read an order's payments outside their branch. Customer ownership checks remain in place. |
| Electronic payment operations | Front desk and inventory officers now receive the same branch restriction as employees and branch managers when initializing/recording payments. |
| Workflow listing | Employees remain restricted to assigned workflows. Other non-admin staff are restricted to their branch, even if they supply another branch's query parameter. |
| Order workflow lookup | Non-admin staff must belong to the order's branch; employees must also be assigned to the order. Customers remain blocked. |
| Stock recording | Only admins and inventory officers can record movements. Branch managers retain stock-history access but no longer see the Record movement button. |

Frontend `ProtectedRoute` checks explicit role restrictions for exact navigation-linked page paths and restricts staff `/orders/new` access to admins. Unauthorized users return to their role's home page. These client checks improve navigation; backend controllers/routes remain the authority for data access. This is not a claim that every nested frontend URL has its own role guard.

## Order creation and status changes

Order creation is explicitly limited to customers and admins. Customers create orders for themselves; admins select a customer. Other staff can no longer accidentally create orders using their own staff user ID as the customer.

The shared creation page fetches the admin-only users list and displays the customer selector only for admins. Customers load branches/services without requesting that list. The staff Dashboard and Orders pages show New order only to admins.

Canonical order statuses are:

```text
placed, received, processing, quality_check, ready, sent_out, delivered, cancelled
```

The frontend enum now matches the order schema. Obsolete order values `pending` and `completed` were removed from that enum; they remain valid in other domains such as payments. Sent out was added to customer status labels and staff order filters.

## Refund deadline

Refunds are permitted under the existing authorization and payment-balance rules until **48 hours after actual delivery**. At exactly `delivered_at + 48 hours`, and afterward, the API rejects refund requests with HTTP 409. This applies to admins and branch managers; there is no admin override.

- The deadline uses `Order.delivered_at`, not the planned `delivery_time`, payment date, or order creation date.
- Delivery confirmation already records `delivered_at`, including automatic pickup confirmation.
- Delivered orders with a missing/invalid delivery timestamp are rejected because the deadline cannot be verified.
- Orders not yet delivered are not blocked by this deadline, but all existing refund rules still apply.
- The payment must be completed and not itself a refund; the amount must be positive and within its remaining refundable balance; a reason is required; already-refunded payments remain blocked.
- The Payments page hides the refund action when the populated order is outside the window or lacks a verifiable timestamp. The API rechecks the deadline on submission, including when a page/modal was opened before the cutoff. The UI condition is evaluated when rendered; it does not run a dedicated expiry timer.

## Frontend change map

| Files | Changes |
| --- | --- |
| `constants/roles.js`, `auth/AuthProvider.jsx`, `constants/navigation.js` | Shared role vocabulary, staff role options, login allowlist, and leave visibility |
| `auth/LoginPage.jsx`, `routes/AppRoutes.jsx`, `auth/ProtectedRoute.jsx` | Role home pages and navigation-linked route restrictions |
| `pages/employees/EmployeesPage.jsx`, `EmployeeDetailsPage.jsx` | Complete staff-role dropdown options |
| `pages/products/ProductsPage.jsx` | Inventory officer product-management controls |
| `pages/stock-movements/StockMovementsPage.jsx` | Permission-aware Record movement action |
| `pages/dashboard/DashboardPage.jsx`, `pages/orders/OrdersPage.jsx` | Admin-only staff New order action; Orders also gains Sent out filtering |
| `pages/orders/CreateOrderPage.jsx` | Customer-safe loading and admin-only customer selector |
| `constants/orderStatuses.js`, `constants/orderStatusLabels.js` | Schema-aligned statuses and Sent out wording |
| `pages/payments/PaymentsPage.jsx`, `utils/refundEligibility.js` | Delivery-based refund eligibility display |

The customer profile page was not changed as part of this work.

## Validation

```sh
cd backend
npm test
```

```sh
cd frontend
npm run build
npm run lint
```

At the last implementation verification, all **82 backend tests passed** and the frontend production build succeeded. Tests cover inventory role migration, retired-role rejection, branch isolation, leave visibility, retained authorized access, frontend/backend enum agreement, role landing pages, and refund cutoff behavior immediately before/at/after 48 hours.

The frontend build reports a bundle-size warning. The last full lint run reported 10 existing errors and 4 warnings, including unused imports and React effect/dependency issues. These checks are not a live-browser or production-database verification. This README update itself only changes documentation.
