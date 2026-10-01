# Laundry App Frontend

React/Vite client for customer and staff laundry workflows. API calls use Axios with credentials for the backend's httpOnly authentication cookie.

See the [full-stack README](../README.md) for the complete change history for this work, permission matrix, refund policy, backend migration, and local setup.

## Setup and commands

Copy `.env.example` to `.env` and set `VITE_API_URL` to the actual backend API address, for example:

```dotenv
VITE_API_URL=http://localhost:3573/api/v1
```

The URL must match backend `PORT`. Restart Vite after changing `.env`. Do not put secrets in `VITE_` variables: they are available to browser code.

```sh
npm install
npm run dev
npm run build
npm run lint
```

## Updated behavior

- Role constants use `branch_manager`, not `manager`, and include all six backend roles. The login allowlist derives from those constants; employee forms share the complete staff-role options.
- Inventory officers land on Inventory, front desk on Orders, employees on Processing, and admins/branch managers on Dashboard. Customers retain their orders home page.
- Exact navigation-linked paths with explicit role restrictions are checked by `ProtectedRoute`. Staff `/orders/new` is admin-only. Backend authorization still controls actual data access.
- Leave requests appear only for employees, branch managers, and admins.
- Inventory officers have product-management controls. Record movement is shown only to admins and inventory officers.
- New order on the staff Dashboard and Orders pages is admin-only. Customer order creation loads branches/services without calling the admin-only users endpoint; the customer selector is admin-only.
- Order status constants match the backend: `placed`, `received`, `processing`, `quality_check`, `ready`, `sent_out`, `delivered`, `cancelled`. Sent out has a customer label and a staff filter.
- Refund buttons require the existing payment eligibility conditions and `isWithinRefundWindow(payment.orderId)`. Delivered orders become ineligible at 48 hours after `delivered_at`. Missing/invalid timestamps also hide the action. The API checks the cutoff again when submitted; the UI does not run a dedicated expiry timer.
- The customer profile page was not changed.

## Structure

- `src/api/`: Domain API functions and shared Axios client.
- `src/auth/`: Login, session state, and protected routes.
- `src/components/`: Reusable forms, navigation, tables, and display components.
- `src/constants/`: Role options, navigation metadata, and order statuses.
- `src/hooks/` and `src/layouts/`: Shared hooks and customer/staff page layouts.
- `src/pages/`: Domain screens.
- `src/routes/`: Application route configuration.
- `src/utils/`: Formatting and refund-eligibility helpers.

## Verification and limitations

The latest implementation build succeeded with a bundle-size warning. Backend tests import the frontend role/status constants and refund helper to verify schema agreement and cutoff behavior. All 82 backend tests passed at the last implementation check.

The last full lint run reported 10 existing errors and 4 warnings involving unused imports and React effects/dependencies. These were not addressed by the role/refund changes. The build and unit tests do not replace browser testing of account-specific workflows.
