# Phase D Implementation Walkthrough: Automatic Stock & Inventory Cleanup

**Branch**: `devJosh`  
**Base Commit**: Synced with `origin/development` (`5271ec0`)  
**Scope**: Automatic stock reservation & consumption, mid-job extra supplies & manager restock requests, actionable low-stock alerts, 30-minute notification deduplication, initial stock creation, atomic rollbacks across all lifecycle paths, and error middleware fix.

---

## 1. Executive Summary

Phase D eliminates the manual inventory officer approval gate from normal order fulfillment while preserving strict inventory control and auditability:
1. **Automated Order Processing**:
   - Order placement atomically **reserves** recipe supplies.
   - Attendant task acceptance atomically **consumes** reserved stock and logs a `usage` stock movement.
   - Order cancellation atomically **releases** unconsumed reserved stock.
   - Intake verification atomically **adjusts** reserved stock up or down.
2. **Supply Requests Refocused**:
   - Supply requests are no longer required for regular orders.
   - Attendants can request **extra supplies** mid-job (`request_type: 'extra_supplies'`).
   - Branch managers can request **branch restocks** (`request_type: 'restock'`), as managers cannot alter stock directly.
   - Inventory officers review and approve/reject these requests. Approving restock credits inventory and records a `purchase` stock movement.
3. **Actionable Stock Alerts**:
   - Low-stock and shortage notifications route directly to `/inventory?view=needs-attention`.
   - Repeated shortage notices within 30 minutes for the same product and user are deduplicated into a single notification.
   - Officers/admins see **"Add stock"** and **"Add product"** (pre-filled); branch managers see **"Request restock"**.
4. **Seed & Cleanup**:
   - Seed scripts are locked strictly to the 6 core active supplies.
   - Deleted service products (`Perfume`, `Shoe Cleaner`, `Stain Remover`, `Premium Packaging Material`) have zero active order reservations and safe cleanup instructions are documented.
5. **Data Audit**:
   - Live audit confirmed **100% reservation consistency** for Wuse and Jabi branches (0 mismatches across all active orders).
   - Data repair script remains uncommitted.

---

## 2. Comprehensive File-by-File Modifications

### Backend Files

#### 1. `backend/src/middlewares/error.middleware.js`
- **Purpose**: Error handling middleware.
- **Change**: Added `next();` after sending the JSON error response at line 44.
- **Reason**: Ensures downstream Express error pipelines or test runners terminate cleanly without unhandled middleware hangs.

#### 2. `backend/scripts/seedSupplyProducts.js`
- **Purpose**: Seeding core recipe supplies for a branch.
- **Modifications**:
  - Removed deleted service products (`Perfume`, `Shoe Cleaner`, `Stain Remover`, `Premium Packaging Material`).
  - Restricted `CORE_RECIPE_PRODUCTS` to the 6 active supplies: `Laundry Detergent` (100 scoop), `Fabric Softener` (50 cap), `Ironing Starch` (50 spray), `Dry Cleaning Solvent` (50 unit), `Packaging Nylon` (100 pieces), `Hanger` (100 pieces).
  - Exported `CORE_RECIPE_PRODUCTS` and `seedSupplyProducts(branchId)`.
  - Guarded `mongoose.connect` so automated unit tests (`NODE_ENV === 'test'`) can import and test idempotency without connecting to Atlas.
  - Made CLI invocation idempotent (`process.argv[1].endsWith('seedSupplyProducts.js')`).

#### 3. `backend/src/models/supplyRequest.model.js`
- **Purpose**: Schema definition for supply requests.
- **Modifications**:
  - Made `order_id`, `workflow_id`, and `step_id` optional (previously strictly required).
  - Added `request_type`: `{ type: String, enum: ['extra_supplies', 'restock'], default: 'extra_supplies' }`.
  - Added `reason`: `{ type: String, trim: true }` to capture urgency or justification from the requester.
  - Replaced the full unique index on `{ step_id: 1, status: 1 }` with a partial index `{ unique: true, partialFilterExpression: { status: 'pending', step_id: { $type: 'objectId' } } }` so branch restock requests (where `step_id` is null) are not constrained by it.

#### 4. `backend/src/controllers/supplyRequest.controller.js`
- **Purpose**: Supply request lifecycle handler.
- **Modifications**:
  - **`createRequest`**:
    - Supports `request_type === 'restock'` from `branch_manager` or `admin`. Validates items, creates request, and notifies active branch inventory officers (`supply_requested`).
    - Mid-job `extra_supplies` requests validate that the attendant is assigned to the step and step status is `assigned` or `accepted`.
  - **`approveRequest`**:
    - If `request.request_type === 'restock'`: validates branch products, increases `product.quantity`, creates a `purchase` stock movement for each item, sets status to `approved`, and notifies requester (`supply_approved`).
    - If `request.request_type === 'extra_supplies'`: calls `disburseApprovedSupplies` to deduct stock and update order supplies.
  - **`rejectRequest`**:
    - Rejects request with `rejection_reason` and notifies requester. Scopes notification reference to order number or "Restock request".
  - Populates `user_id.role` on `requested_by` and `reviewed_by`.

#### 5. `backend/src/routes/product.routes.js`
- **Purpose**: Express routing for inventory products.
- **Modifications**:
  - Registered `GET /needs-attention` **before** `GET /:id` to prevent Express from capturing "needs-attention" as an ObjectId param.
  - Authorized all staff roles (`admin`, `branch_manager`, `employee`, `inventory_officer`, `front_desk`) for product read endpoints.

#### 6. `backend/src/controllers/product.controller.js`
- **Purpose**: Inventory product CRUD and attention queries.
- **Modifications**:
  - Added `CORE_RECIPE_SUPPLIES` list (matching `serviceSupplies.config.js`).
  - Implemented `getProductsNeedingAttention`:
    - Scoped by user's branch (or `query.branch_id` for admin).
    - Checks active branch products: flags items where `quantity <= reorder_point` or `available <= reorder_point` with `status: 'low_stock'`.
    - Cross-references with `CORE_RECIPE_SUPPLIES`: flags missing supplies with `is_missing: true`, `status: 'missing'`, and `reason: 'missing_recipe_supply'`.
    - Returns summary metadata: `{ branch, items, total, low_stock_count, missing_count }`.
  - Updated `createProduct`:
    - Added `initial_stock` field handling.
    - Role restriction: only `admin` and `inventory_officer` can supply `initial_stock > 0` (returns 403 for `branch_manager`).
    - Automatically creates a `purchase` stock movement with `notes: 'Initial stock on product creation'`.

#### 7. `backend/src/services/inventoryConsumption.service.js`
- **Purpose**: Recipe supply calculation, atomic reservation, consumption, and rollback.
- **Modifications**:
  - **30-Minute Deduplication**:
    - In `notifyOfficersOfStockShortage` and `notifyBranchManagersOfLowStock`: checks for an existing unread notification for the same user, type, and product created within the last 30 minutes (`Date.now() - 30 * 60 * 1000`).
    - If found, updates `existing.message`, `existing.sent_at`, and saves instead of inserting a duplicate notice.
    - Added connection state guard (`mongoose.connection.readyState === 1 || Notification.findOne?.mock`) to prevent test runner buffering when disconnected.
  - **Consumption Return**:
    - `consumeReservedSuppliesForStep` now returns `{ appliedProducts, createdMovements }` to enable atomic rollback if caller fails.

#### 8. `backend/src/controllers/processingWorkflow.controller.js`
- **Purpose**: Workflow steps execution.
- **Modifications**:
  - In `updateStep` (`action === 'accept'`):
    - Stores previous order and step states before calling `consumeReservedSuppliesForStep`.
    - Wraps `order.save()` and `workflow.save()` in a `try / catch` block.
    - If saving throws, rolls back step status, resets `product.quantity` and `product.reserved_quantity` to previous values, deletes created `StockMovement` records, restores `order.supplies_reserved` and `order.supplies_used`, and rolls back order status.
    - Customer notification is sent only after workflow state is committed.

#### 9. `backend/src/controllers/order.controller.js`
- **Purpose**: Order management and cancellation.
- **Modifications**:
  - In `cancelOrder` (customer path) and `forceCancelOrder` (staff path):
    - Tracks `previouslyConsumed` state.
    - Calls `releaseReservedSuppliesForOrder`.
    - Wraps `order.save()` in `try / catch`: if order save throws, rolls back `Product.reserved_quantity` and resets `consumed: false` on reserved items.

#### 10. `backend/test/phase-d-inventory.test.js` *(New Test Suite)*
- **Purpose**: Comprehensive test coverage for all Phase D requirements.
- **Tests**:
  1. `GET /products/needs-attention` returns low stock and missing core recipe items.
  2. `initial_stock` on `POST /products` creates product and records `purchase` stock movement.
  3. Branch manager cannot supply `initial_stock` directly (returns 403).
  4. Branch manager submits `restock` request; officer approval increases stock and creates `purchase` movement.
  5. 30-minute stock shortage notification deduplication updates existing notice.
  6. `CORE_RECIPE_PRODUCTS` contains only the 6 core supplies without deleted products.
  7. `seedSupplyProducts` is idempotent (skips existing, creates missing).
  8. Concurrency for last stock unit allows winner and rolls back loser with 409.
  9. Attendant step accept rolls back consumed supplies and stock movements if workflow save fails.

---

### Frontend Files

#### 11. `frontend/src/api/products.api.js`
- **Change**: Added `getProductsNeedingAttention(params)` calling `GET /products/needs-attention`.

#### 12. `frontend/src/pages/notifications/NotificationsPage.jsx`
- **Modifications**:
  - Replaced ambiguous "Other" notification title with descriptive titles: **"Stock Alert"** for inventory messages, "Order Cancellation", and "Leave Request".
  - Displays a pill badge *"View attention list →"* on stock alert notifications.
  - Clicking any stock alert automatically marks it read and navigates directly to `/inventory?view=needs-attention` for authorized roles (`admin`, `branch_manager`, `inventory_officer`).

#### 13. `frontend/src/pages/products/ProductsPage.jsx`
- **Modifications**:
  - Added URL view tab switching: **"All Products"** vs **"Needs Attention"** (`?view=needs-attention`).
  - Added counter badge for items requiring attention.
  - Needs Attention table highlights:
    - Low stock products with remaining vs reorder point.
    - Missing core recipe products with *"Missing from branch"* badge.
  - Role-gated Action buttons:
    - **Inventory Officer & Admin**:
      - For missing products: **"Add product"** (pre-fills product name, unit, and reorder point in modal).
      - For low-stock products: **"Add stock"** (opens quick movement modal).
      - "Initial stock on hand" field in Add Product modal (creates purchase movement).
    - **Branch Manager**:
      - Gets **"Request restock"** button (managers cannot change stock directly).
      - Opens "Request Restock" dialog (specifies quantity needed and urgency note).
      - Submits restock request to branch inventory officer.
  - Retained "Reserved" and "Available" columns in inventory table.

#### 14. `frontend/src/pages/supply-requests/SupplyRequestsPage.jsx`
- **Modifications**:
  - Updated title to **"Supply & Restock Requests"** and subtitle to reflect mid-job extra supplies and manager restock requests.
  - Differentiates cards with **"Restock"** (amber badge) vs **"Extra Supplies"** (sky badge).
  - Shows restock reason notes when provided by branch manager.
  - Approval modal adapts context:
    - For Restock: *"Approve restock request — this will increase on-hand stock in the branch inventory"*, confirm button: *"Confirm restock & add to inventory"*.
    - For Extra Supplies: *"Approve supply request — this is what actually gets deducted from stock"*, confirm button: *"Confirm & disburse"*.

---

### Temporary Data Repair Script *(Uncommitted)*

#### 15. `backend/scripts/audit_and_repair_reservations.js`
- **Purpose**: Audits and recomputes `Product.reserved_quantity` against active orders for Jabi and Wuse branches.
- **Safety Features**:
  - Automatically writes a pre-repair JSON backup of all branch products to `backend/scripts/backups/`.
  - Runs in dry-run mode by default, displaying a formatted table comparing Current vs Computed reservations.
  - Requires explicit `--apply` flag to write changes to MongoDB.

---

## 3. Order Lifecycle & Stock Movement Architecture

```
[ Customer Order Placed ]
       │
       ▼
checkAndReserveSuppliesForOrder()
(Product.reserved_quantity incremented atomically)
       │
       ▼
[ Intake Verification by Front Desk / Manager ]
       │
       ├─► Quantities changed? ──► adjustReservedSuppliesForIntake()
       ▼
[ Auto-Assignment to Lightest-Loaded Attendant ]
       │
       ▼
[ Attendant clicks "Accept" on Task ]
       │
       ▼
consumeReservedSuppliesForStep()
(Product.quantity decremented, reserved_quantity decremented)
(StockMovement logged: type 'usage')
       │
       ├─► (Atomic rollback if workflow save fails)
       ▼
[ Order Enters Processing ]
```

---

## 4. Role Permissions Matrix

| Capability | Customer | Attendant / Employee | Branch Manager | Inventory Officer | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Place Order (reserves stock) | Yes | Yes (customer role) | Yes (customer role) | Yes (customer role) | Yes |
| Accept Task (consumes stock) | No | **Yes** (assigned step) | No | No | No |
| Request Extra Supplies (mid-job) | No | **Yes** (during step) | No | No | No |
| Request Branch Restock | No | No | **Yes** | No | **Yes** |
| Approve / Reject Supply Requests | No | No | No | **Yes** | **Yes** |
| Create Product with Initial Stock | No | No | No | **Yes** | **Yes** |
| Direct Stock Movement (Purchase/Adjustment) | No | No | No | **Yes** | **Yes** |
| View Needs-Attention List | No | Yes (view only) | **Yes** (Restock action) | **Yes** (Add stock/product) | **Yes** (All actions) |

---

## 5. Live Database Audit Results (Jabi & Wuse)

Executed against live database using `backend/scripts/audit_and_repair_reservations.js`:

### Wuse Branch (`6a8cffe12225b93e5b0d4a63`)
- **Active Orders**: 4
- **Backup Created**: `backend/scripts/backups/products_Wuse_Branch_2026-11-04T13-24-50-755Z.json`
- **Audit Table**:
  - `Laundry Detergent`: On hand 100 | Current Reserved: 5 | Computed Reserved: 5 | **Diff: 0 (MATCH)**
  - `Fabric Softener`: On hand 50 | Current Reserved: 5 | Computed Reserved: 5 | **Diff: 0 (MATCH)**
  - `Ironing Starch`: On hand 50 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Dry Cleaning Solvent`: On hand 50 | Current Reserved: 1 | Computed Reserved: 1 | **Diff: 0 (MATCH)**
  - `Packaging Nylon`: On hand 100 | Current Reserved: 8 | Computed Reserved: 8 | **Diff: 0 (MATCH)**
  - `Hanger`: On hand 100 | Current Reserved: 8 | Computed Reserved: 8 | **Diff: 0 (MATCH)**
  - `Stain Remover`: On hand 50 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Shoe Cleaner`: On hand 30 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Perfume`: On hand 50 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Premium Packaging Material`: On hand 100 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**

### Jabi Branch (`6a992e20abd4df31c43b1c5a`)
- **Active Orders**: 17
- **Backup Created**: `backend/scripts/backups/products_Jabi_Branch_2026-11-04T13-24-50-755Z.json`
- **Audit Table**:
  - `Ironing Starch`: On hand 47 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Laundry Detergent`: On hand 36 | Current Reserved: 11 | Computed Reserved: 11 | **Diff: 0 (MATCH)**
  - `Fabric Softener`: On hand 36 | Current Reserved: 10 | Computed Reserved: 10 | **Diff: 0 (MATCH)**
  - `Dry Cleaning Solvent`: On hand 49 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Packaging Nylon`: On hand 113 | Current Reserved: 17 | Computed Reserved: 17 | **Diff: 0 (MATCH)**
  - `Hanger`: On hand 113 | Current Reserved: 17 | Computed Reserved: 17 | **Diff: 0 (MATCH)**
  - `Stain Remover`: On hand 49 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Shoe Cleaner`: On hand 30 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Perfume`: On hand 48 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**
  - `Premium Packaging Material`: On hand 99 | Current Reserved: 0 | Computed Reserved: 0 | **Diff: 0 (MATCH)**

---

## 6. Safe MongoDB Deactivation/Cleanup Commands

The 4 retired products (`Perfume`, `Shoe Cleaner`, `Stain Remover`, `Premium Packaging Material`) have 0 active reservations.

### Option A: Soft-Deactivation (Recommended — Preserves historical stock movements)
Run in MongoDB Shell / Compass:
```javascript
db.products.updateMany(
  {
    name: {
      $in: [
        /^perfume$/i,
        /^shoe cleaner$/i,
        /^stain remover$/i,
        /^premium packaging material$/i
      ]
    }
  },
  { $set: { is_active: false } }
);
```

### Option B: Hard Deletion (If no historical audit retention is needed)
```javascript
db.products.deleteMany({
  name: {
    $in: [
      /^perfume$/i,
      /^shoe cleaner$/i,
      /^stain remover$/i,
      /^premium packaging material$/i
    ]
  }
});
```

---

## 7. Verification Results

- **Backend Test Suite**:
  - Command: `npm test`
  - Result: **159 passed, 0 failed** (includes all 9 Phase D tests in `phase-d-inventory.test.js`).
- **Frontend Linting**:
  - Command: `npm run lint`
  - Result: **Clean, 0 errors, 0 warnings**.
- **Frontend Formatting**:
  - Command: `npx prettier --check ...`
  - Result: **All matched files use Prettier code style**.

---

## 8. Step-by-Step UI Manual Test Guide

### Scenario 1: Stock Shortage Alerts & Navigation
1. Log in as **Inventory Officer** or **Admin**.
2. Go to `/notifications`.
3. Locate any notification titled **"Stock Alert"** (with badge *"View attention list →"*).
4. Click the card.
5. **Expected**: Navigates to `/inventory?view=needs-attention`. The "Needs Attention" tab is active. Products below reorder point show "Low Stock"; missing core supplies show "Missing".

### Scenario 2: Officer Adding Missing Product with Initial Stock
1. On `/inventory?view=needs-attention` as **Inventory Officer**, find a product marked *"Missing"*.
2. Click **"Add product"**.
3. **Expected**: The Add Product modal opens with the product Name and Unit already filled in.
4. Enter `40` in the "Initial stock on hand" field and click Save.
5. **Expected**: Product is created. Go to Stock History (`/stock-movements`): a `purchase` movement of +40 is recorded.

### Scenario 3: Branch Manager "Request Restock" vs Officer Approval
1. Log in as **Branch Manager**.
2. Navigate to `/inventory` and switch to the **Needs Attention** tab.
3. Observe that managers do **not** have "Add stock" or direct modification controls; each item shows **"Request restock"**.
4. Click **"Request restock"** on a low-stock product. Enter quantity `20`, reason `"Running low for tomorrow's pickups"`, and submit.
5. **Expected**: Toast confirms submission.
6. Log out and log in as **Inventory Officer**.
7. Navigate to `/supply-requests`.
8. Locate the request with the amber **RESTOCK** badge and the manager's reason note.
9. Click **"Review & approve"** -> confirm *"Confirm restock & add to inventory"*.
10. **Expected**: Request status changes to `approved`. In `/inventory`, that product's on-hand quantity is increased by 20.

### Scenario 4: Standard Order Flow Without Officer Approval Gate
1. Log in as **Customer** and place an order for 2 garments with `Washing & Folding`.
2. Check `/inventory`: `Reserved` increases by 2 scoops of detergent and 2 caps of softener.
3. Log in as **Front Desk** / **Manager** and complete intake verification.
4. Log in as the assigned **Attendant**.
5. Go to `/tasks` and click **"Accept"**.
6. **Expected**: The attendant starts processing immediately. **No officer approval click is needed**.
7. Check `/inventory`: the 2 scoops and 2 caps move from `Reserved` to consumed (`quantity` decreases, `reserved` decreases back to 0). An automatic `usage` movement is logged in `/stock-movements`.

### Scenario 5: Order Cancellation Releases Reservation
1. Place a customer order.
2. Note the increased `Reserved` quantity in `/inventory`.
3. Cancel the order from customer order details before processing starts.
4. **Expected**: Reserved quantity returns to 0 immediately without altering on-hand inventory.

