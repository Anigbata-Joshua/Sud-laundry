# Developer 1 — Guide

## Your area
Auth, Employee & Workflow Management, Admin support.
You own account access, staff records, task assignment, and leave requests.

---

## Before you start — shared foundation

Do this together with Dev 2 and Dev 3 on Day 1, before anyone starts individual work:

- `src/app.js`, `src/server.js`
- `src/config/` (db.js, env.js, redis.js)
- `src/middlewares/` (auth, role, validate, rateLimiter, error)
- `src/utils/` (asyncHandler, apiError, apiResponse, generateToken)

These are shared by every module. Agree on their shape as a team before writing any individual controller — changing them later after others depend on them causes rework for everyone.

---

## Your work order

Work top to bottom. Each row is "done" when its goal is met — don't move to the next file until it is.

| Step | File | Goal (done when...) |
|---|---|---|
| 1 | `src/models/user.model.js` | Schema defined (name, email, password_hash, role, phone, address), email indexed unique |
| 2 | `src/validators/auth.validator.js` | register/login/forgot/reset schemas exported |
| 3 | `src/controllers/auth.controller.js` + `src/routes/auth.routes.js` | You can register and log in a user via Postman/curl and get a valid token back |
| 4 | `src/models/employee.model.js` | Schema defined (user_id, branch_id, job_title, hired_at) |
| 5 | `src/controllers/employee.controller.js` + `src/routes/employee.routes.js` | Admin can create an employee at any branch; Branch Manager can only create one at their own branch — tested both ways |
| 6 | `src/models/leaveRequest.model.js` | Schema defined |
| 7 | `src/controllers/leaveRequest.controller.js` + `src/routes/leaveRequest.routes.js` | Employee can submit a request; manager can approve/reject, scoped to their branch only |
| 8 | `src/models/task.model.js` | Schema defined (employee_id, order_id, stage, status, timestamps) |
| 9 | `src/controllers/task.controller.js` + `src/routes/task.routes.js` | An employee sees only tasks assigned to them; status updates persist |
| 10 | `src/controllers/user.controller.js` + `src/routes/user.routes.js` | Admin can view/deactivate any account; no one else can |
| 11 | Register your routes in `src/routes/index.js` | Your endpoints are reachable under `/api/v1` |

---

## Rules for this folder set — read before editing anything

1. **Only touch the files listed above as yours.** If a module you don't own needs a field or change, ask the owner — don't edit their file directly.
2. **New employee accounts are never created with a password.** Create the account shell only, then trigger an invite email (via `services/email.service.js`) so the employee sets their own password. Never let a manager set or see another user's password.
3. **Branch scoping is enforced in the query, not just the UI.** Every employee/leave/task query for a Branch Manager or Employee role must filter by their own `branch_id`.
4. `src/routes/index.js` is shared by all three devs — see the shared-file rule below.
5. Don't rename fields on `user.model.js` after Dev 2 or Dev 3 start referencing `customer_id`/`user_id` in their own models, without telling them first.

---

## Git workflow

**Branch naming:** `feature/dev1-<module>` — one branch per module, not one giant branch for everything.
Examples: `feature/dev1-auth`, `feature/dev1-employee`, `feature/dev1-leave`, `feature/dev1-tasks`

**Steps, every time you start new work:**

```
git checkout main
git pull origin main
git checkout -b feature/dev1-auth
```

**While working:**
- Commit small and often. Don't wait until a whole module is done to make your first commit.
- Stage specific files, not everything blindly:
  ```
  git add src/models/user.model.js src/validators/auth.validator.js
  git commit -m "Add user model and auth validators"
  ```
- Run `git status` before every commit so you know exactly what's being committed.

**Before pushing, always sync with main first:**
```
git pull origin main --rebase
```
This replays your changes on top of the latest main and surfaces any conflicts immediately, while they're small and easy to resolve — instead of discovering a big conflict later.

**Push and open a PR:**
```
git push origin feature/dev1-auth
```
Open a Pull Request into `main`. Request a review from at least one teammate before merging — even a quick look catches problems early.

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
- Before editing a shared file (`routes/index.js`, `services/notification.service.js`, `services/email.service.js`), say so in the team chat first — add your one line, commit, and push quickly so the file isn't "open" for long.
- If a conflict does happen, resolve it locally in your editor — don't resolve non-trivial conflicts directly in GitHub's web interface.
- Keep commits scoped to one concern each — don't mix unrelated changes in a single commit.
