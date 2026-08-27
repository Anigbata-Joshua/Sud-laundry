# Developer 2 — Guide

## Your area
Order Management, Inventory & Supplies, Multi-Location data logic.
You own branches, the service catalog, the order lifecycle, and inventory.

---

## Before you start — shared foundation

Do this together with Dev 1 and Dev 3 on Day 1, before anyone starts individual work:

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
| 1 | `src/models/branch.model.js` | Schema defined (name, address, phone) |
| 2 | `src/controllers/branch.controller.js` + `src/routes/branch.routes.js` | `GET /branches` is public and returns only name/address/phone (no operational data); create/edit is admin-only |
| 3 | `src/models/service.model.js` | Schema defined (branch_id, name, category, price, turnaround_hours) |
| 4 | `src/controllers/service.controller.js` + `src/routes/service.routes.js` | Anyone can browse the service catalog; only admin can edit pricing |
| 5 | `src/models/order.model.js` | Schema defined, including embedded `items`, `supplies_used`, and `feedback` — reviewed carefully since this is the most complex model in the system |
| 6 | `src/controllers/order.controller.js` + `src/routes/order.routes.js` | A logged-in customer can place an order, view their full order history across any branch, and staff can view/update orders scoped to their own branch |
| 7 | `src/models/product.model.js` | Schema defined (branch_id, name, price, quantity, reorder_point) |
| 8 | `src/controllers/product.controller.js` + `src/routes/product.routes.js` | Branch-scoped inventory CRUD works; a Branch Manager cannot see another branch's inventory |
| 9 | `src/models/stockMovement.model.js` | Schema defined (product_id, type, quantity) |
| 10 | `src/controllers/stockMovement.controller.js` + `src/routes/stockMovement.routes.js` | Logging a "usage" movement correctly updates both the product's quantity and the related order's `supplies_used` array |
| 11 | Register your routes in `src/routes/index.js` | Your endpoints are reachable under `/api/v1` |

---

## Rules for this folder set — read before editing anything

1. **Only touch the files listed above as yours.** If Dev 1 or Dev 3 needs a change to `order.model.js` or `branch.model.js`, they ask you — you make the change, not them.
2. **Customer accounts are never branch-locked.** `branch_id` on an order records where that specific order was placed — it is not a restriction on the customer's account. Don't add a branch restriction to the customer's own model.
3. **`GET /branches` stays public and minimal.** Never expose orders, revenue, or staff data through this endpoint — that data has its own protected endpoints.
4. **Branch scoping is enforced in the query, not just the UI.** Every order/product/stock query for a Branch Manager or Employee role must filter by their own `branch_id`.
5. `src/routes/index.js` is shared by all three devs — see the shared-file rule below.
6. Agree the exact `status` enum values on `order.model.js` with Dev 1 before building — Dev 1's `task.model.js` stage names need to line up with your order status so the two stay in sync.

---

## Git workflow

**Branch naming:** `feature/dev2-<module>` — one branch per module, not one giant branch for everything.
Examples: `feature/dev2-branches`, `feature/dev2-services`, `feature/dev2-orders`, `feature/dev2-inventory`

**Steps, every time you start new work:**

```
git checkout main
git pull origin main
git checkout -b feature/dev2-branches
```

**While working:**
- Commit small and often. Don't wait until a whole module is done to make your first commit.
- Stage specific files, not everything blindly:
  ```
  git add src/models/branch.model.js src/controllers/branch.controller.js
  git commit -m "Add branch model and public branch listing endpoint"
  ```
- Run `git status` before every commit so you know exactly what's being committed.

**Before pushing, always sync with main first:**
```
git pull origin main --rebase
```
This replays your changes on top of the latest main and surfaces any conflicts immediately, while they're small — instead of discovering a big conflict later.

**Push and open a PR:**
```
git push origin feature/dev2-branches
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
- Before editing a shared file (`routes/index.js`, `services/cache.service.js`), say so in the team chat first — add your change, commit, and push quickly so the file isn't "open" for long.
- If a conflict does happen, resolve it locally in your editor — don't resolve non-trivial conflicts directly in GitHub's web interface.
- Keep commits scoped to one concern each — don't mix unrelated changes in a single commit.
