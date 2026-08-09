# Developer 3 — Guide

## Your area
Billing/Invoicing, CRM, Reporting & Analytics.
You own payments, customer-facing notifications, supplier records, and dashboard reporting.

---

## Before you start — shared foundation

Do this together with Dev 1 and Dev 2 on Day 1, before anyone starts individual work:

- `src/app.js`, `src/server.js`
- `src/config/` (db.js, env.js, redis.js)
- `src/middlewares/` (auth, role, validate, rateLimiter, error)
- `src/utils/` (asyncHandler, apiError, apiResponse, generateToken)

These are shared by every module. Agree on their shape as a team before writing any individual controller.

---

## Your work order

Work top to bottom. Each row is "done" when its goal is met — don't move to the next file until it is.

| Step | File | Goal (done when...) |
|---|---|---|
| 1 | `src/models/payment.model.js` | Schema defined (order_id, method, amount, status, transaction_ref, paid_at) |
| 2 | `src/controllers/payment.controller.js` + `src/routes/payment.routes.js` | Recording a payment correctly updates the related order's `payment_status` |
| 3 | `src/models/notification.model.js` | Schema defined (user_id, order_id, type, message, sent_at) |
| 4 | `src/controllers/notification.controller.js` + `src/routes/notification.routes.js` | A logged-in customer can view their notification feed and mark items as read |
| 5 | `src/services/notification.service.js` | A single exported function (e.g. `createNotification`) works and is confirmed with Dev 1 and Dev 2, since they will call it from their own controllers |
| 6 | `src/models/supplier.model.js` | Schema defined (name, contact, items_supplied) |
| 7 | `src/controllers/supplier.controller.js` + `src/routes/supplier.routes.js` | Admin-only CRUD works — no login/portal is being built for suppliers |
| 8 | `src/services/report.service.js` | Aggregation logic for revenue, order volume, and top services works when called directly, before wiring it to a route |
| 9 | `src/controllers/report.controller.js` + `src/routes/report.routes.js` | A Branch Manager only sees their own branch's numbers; Admin sees the company-wide, consolidated view |
| 10 | `src/services/cache.service.js` | Dashboard summary figures are cached with a short expiry; coordinated with Dev 2 on shared cache key naming |
| 11 | Register your routes in `src/routes/index.js` | Your endpoints are reachable under `/api/v1` |

---

## Rules for this folder set — read before editing anything

1. **Only touch the files listed above as yours.** If Dev 1 or Dev 2 need a change to `notification.service.js` or `cache.service.js`, they ask you — you make the change, not them.
2. **Never cache order data, inventory quantities, or anything financial.** These must always be read live from the database — only cache things like the service/branch catalog and dashboard summary figures.
3. **Report data is branch-scoped automatically for non-admin roles.** A Branch Manager's report queries always filter by their own `branch_id` — this is enforced in the query, not just hidden in the UI.
4. **Password reset and welcome emails belong to Dev 1's auth module.** Your use of `services/email.service.js` is limited to order and notification-related messages — don't duplicate auth email logic here.
5. `src/routes/index.js` is shared by all three devs — see the shared-file rule below.

---

## Git workflow

**Branch naming:** `feature/dev3-<module>` — one branch per module, not one giant branch for everything.
Examples: `feature/dev3-payments`, `feature/dev3-notifications`, `feature/dev3-suppliers`, `feature/dev3-reports`

**Steps, every time you start new work:**

```
git checkout main
git pull origin main
git checkout -b feature/dev3-payments
```

**While working:**
- Commit small and often. Don't wait until a whole module is done to make your first commit.
- Stage specific files, not everything blindly:
  ```
  git add src/models/payment.model.js src/controllers/payment.controller.js
  git commit -m "Add payment model and record-payment endpoint"
  ```
- Run `git status` before every commit so you know exactly what's being committed.

**Before pushing, always sync with main first:**
```
git pull origin main --rebase
```
This replays your changes on top of the latest main and surfaces any conflicts immediately, while they're small — instead of discovering a big conflict later.

**Push and open a PR:**
```
git push origin feature/dev3-payments
```
Open a Pull Request into `main`. Request a review from at least one teammate before merging.

**After merge:**
```
git checkout main
git pull origin main
```
Then delete your feature branch and start the next one from a clean, up-to-date `main`.

---

## Rules to avoid Git conflicts

- Never commit directly to `main` — always through a reviewed PR.
- Keep each branch scoped to one module (per the work order above) — small PRs conflict far less often than large ones.
- Pull and rebase from `main` daily, even mid-task, so conflicts stay small and easy to resolve.
- Never force-push a branch that a teammate has already pulled from.
- Before editing a shared file (`routes/index.js`, `services/notification.service.js`, `services/cache.service.js`), say so in the team chat first — add your change, commit, and push quickly so the file isn't "open" for long.
- If a conflict does happen, resolve it locally in your editor — don't resolve non-trivial conflicts directly in GitHub's web interface.
- Keep commits scoped to one concern each — don't mix unrelated changes in a single commit.
