# Phase B Manual Testing Guide: Garment Catalog & Matrix Pricing

This guide provides step-by-step testing instructions with exact inputs and expected totals for verifying Phase B order placement, matrix pricing, express surcharges, and front-desk intake adjustments.

---

## Prerequisites & Test Accounts

Ensure both backend (`localhost:5000`) and frontend (`localhost:5173`) are running.

| Role | Email | Password | Assigned Branch |
| :--- | :--- | :--- | :--- |
| **Branch Manager** | `manager.wuse@laundry.test` | `Password123!` | Wuse Branch |
| **Front Desk** | `frontdesk.wuse@laundry.test` | `Password123!` | Wuse Branch |
| **Customer** | `customer@laundry.test` | `Password123!` | Public / Any |
| **Admin** | `admin@laundry.test` | `Password123!` | All Branches |

> [!NOTE]
> All currency amounts are denominated in Nigerian Naira (₦). Express surcharge is dynamically served from the server at **30%** (`env.expressSurchargePercent`).

---

## Test Scenario 1: Customer Order (Standard vs. Express)

Verifies multi-item order placement, dynamic express surcharge calculations from the server, and turnaround estimation.

### Steps
1. Open your browser and navigate to `/order`.
2. Select **Wuse Branch** from the branch cards.
3. Under the garment catalog:
   - **Item 1**: Locate **T-Shirt** (Casuals category).
     - Select service: **Washing & Folding** (₦800).
     - Set quantity: **2**.
     - *Item Subtotal*: $2 \times ₦800 = ₦1,600$.
   - **Item 2**: Locate **Suit Jacket** or **Jeans** (Formal/Casual category).
     - Select service: **Dry Cleaning** (₦2,500).
     - Set quantity: **1**.
     - *Item Subtotal*: $1 \times ₦2,500 = ₦2,500$.
4. **Test Standard Delivery**:
   - Ensure the delivery toggle is set to **Standard**.
   - Check the live totals breakdown in the order summary sidebar:
     - **Items Subtotal**: `₦4,100.00`
     - **Express Surcharge (0%)**: `₦0.00`
     - **Total Amount Due**: `₦4,100.00`
     - **Turnaround Time**: Displays longest regular service duration (e.g., 48 hours for Dry Cleaning).
5. **Test Express Delivery**:
   - Click the **Express (+30%)** toggle.
   - Verify the summary immediately recalculates:
     - **Items Subtotal**: `₦4,100.00`
     - **Express Surcharge (30%)**: `₦1,230.00` ($4,100 \times 0.30$)
     - **Total Amount Due**: `₦5,330.00` ($4,100 + 1,230$)
     - **Turnaround Time**: Fixed at **24 hours**.
6. Set a pickup time (e.g., tomorrow at 10:00 AM) and enter contact details.
7. Click **Place Order**.
8. **Expected Result**: Order is created successfully. The confirmation screen displays:
   - Order Status: `placed`
   - Total Amount Due: `₦5,330.00`
   - Line items display using `"Item · Service"` format (e.g., `T-Shirt · Washing & Folding`, `Suit Jacket · Dry Cleaning`).

---

## Test Scenario 2: Staff Order Creation

Verifies that branch staff can create orders on behalf of walk-in or phone-in customers with multi-piece garments and stock reservations.

### Steps
1. Log in as `frontdesk.wuse@laundry.test` or `manager.wuse@laundry.test`.
2. Navigate to **Orders** from the sidebar $\rightarrow$ click **New Order** (`/orders/new`).
3. Select **Operating Branch**: **Wuse Branch**.
4. In **Customer & Schedule Details**:
   - Pick a customer from the customer account dropdown.
   - Select a pickup date and time.
5. In **Services, Priority & Line Items**:
   - Add a multi-piece garment (e.g., **3-Piece Suit** or **King Duvet**).
   - Observe the garment card and selected line item badge: shows `3 pcs/item`.
   - Add another garment (e.g., **Shirt** at ₦1,000 for Ironing, quantity 2).
6. Click **Create order**.
7. **Expected Result**:
   - Order is placed with status `placed`.
   - Stock supplies are atomically reserved in the database for Wuse Branch.
   - Sizing properly scales supplies by `quantity * piece_count` for all stages.

---

## Test Scenario 3: Duplicate Line Prevention & Rejection

Verifies that duplicate combinations of the same garment item and service cannot be split across multiple conflicting order lines.

### Steps (UI Auto-Merge)
1. On `/order` or `/orders/new`, click **T-Shirt** with service **Washing & Folding**.
2. Notice the item appears in the selected items table with quantity `1`.
3. In the garment catalog grid, click **T-Shirt** a second time.
4. **Expected Result**:
   - No second line is created.
   - The existing line's quantity stepper automatically increments from `1` to `2`.
   - Subtotal updates from `₦800` to `₦1,600`.

### Steps (API Rejection)
1. Submit an order via API or Postman to `POST /api/v1/orders` with duplicate lines:
   ```json
   {
     "branch_id": "<wuse_branch_id>",
     "priority": "normal",
     "items": [
       { "catalog_item_id": "<tshirt_id>", "service_id": "<wash_service_id>", "quantity": 1 },
       { "catalog_item_id": "<tshirt_id>", "service_id": "<wash_service_id>", "quantity": 2 }
     ],
     "pickup_time": "2026-10-20T10:00:00.000Z"
   }
   ```
2. **Expected Result**:
   - HTTP Status: `400 Bad Request`
   - Response message: `"Duplicate item and service detected: please combine quantities into a single line"`.

---

## Test Scenario 4: Front Desk Intake Quantity Corrections (Up & Down)

Verifies that front desk staff can correct garment quantities when physical clothes are counted at the counter, adjusting reserved inventory, totals, express surcharges, and customer notifications.

### Steps (Correction Up)
1. Open the order created in **Test Scenario 1** (Total: `₦5,330`, Express, 2 T-Shirts @ ₦800 + 1 Suit Jacket @ ₦2,500).
2. Go to the order's detail page (`/orders/:id`).
3. Click **Verify Intake & Receive** (status changes from `placed` to `received`).
4. In the intake verification modal:
   - For **T-Shirt · Washing & Folding**, change quantity from `2` to `3` (e.g., customer brought an extra shirt).
   - Leave **Suit Jacket · Dry Cleaning** at `1`.
   - Enter Intake Notes: `"Additional T-Shirt found during physical inspection."`
5. Click **Confirm Intake & Receive**.
6. **Expected Recalculation**:
   - **T-Shirt Subtotal**: $3 \times ₦800 = ₦2,400.00$
   - **Suit Jacket Subtotal**: $1 \times ₦2,500 = ₦2,500.00$
   - **New Items Subtotal**: `₦4,900.00`
   - **Express Surcharge (30%)**: `₦1,470.00` ($4,900 \times 0.30$)
   - **Updated Amount Due**: `₦6,370.00` ($4,900 + 1,470$)
   - Order status moves to `received`.
   - The customer receives an in-app notification:
     > *"Your order quantities were verified at intake. The updated total is ₦6,370."*
   - Order details page shows the **Intake Verification Audit** block with original vs. verified counts.

### Steps (Correction Down)
1. For an order with 3 T-Shirts (`₦2,400`), open **Verify Intake & Receive**.
2. Change the quantity from `3` down to `1`.
3. Click **Confirm Intake & Receive**.
4. **Expected Recalculation**:
   - **New Items Subtotal**: `₦800.00`
   - **Express Surcharge (if express, 30%)**: `₦240.00`
   - **Updated Amount Due**: `₦1,040.00` (or `₦800.00` if standard)
   - The unneeded reserved supplies in inventory are released back to available stock.

---

## Test Scenario 5: Intake Correction Exceeding Available Stock

Verifies that intake increases are rejected when the branch does not have enough detergent, solvent, or packaging nylon in stock to fulfill the higher quantity.

### Steps
1. In the database or inventory page for Wuse Branch, check the available stock of `Laundry Detergent` (e.g., only 1 or 2 scoops remain unreserved).
2. As Front Desk, open a placed order and click **Verify Intake & Receive**.
3. Attempt to increase garment quantities to an excessive amount (e.g. increase King Duvets or T-Shirts to `100`).
4. Click **Confirm Intake & Receive**.
5. **Expected Result**:
   - HTTP Status: `409 Conflict`
   - Toast/Alert message: `"Insufficient stock available to increase intake quantities"`
   - The order remains in `placed` status.
   - Quantities, totals, and original inventory reservations remain unchanged.

---

## Quick Reference: Expected Totals Matrix

| Garment Item | Service Selected | Unit Price | Qty | Priority | Item Subtotal | Express Surcharge | Total Amount Due |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| T-Shirt | Washing & Folding | ₦800 | 2 | Standard | ₦1,600 | ₦0 | ₦1,600 |
| T-Shirt | Washing & Folding | ₦800 | 2 | Express | ₦1,600 | ₦480 (30%) | ₦2,080 |
| T-Shirt + Suit Jacket | Wash & Fold + Dry Clean | ₦800 + ₦2,500 | 2 + 1 | Standard | ₦4,100 | ₦0 | **₦4,100** |
| T-Shirt + Suit Jacket | Wash & Fold + Dry Clean | ₦800 + ₦2,500 | 2 + 1 | Express | ₦4,100 | ₦1,230 (30%) | **₦5,330** |
| Intake Corrected Up | Wash & Fold + Dry Clean | ₦800 + ₦2,500 | 3 + 1 | Express | ₦4,900 | ₦1,470 (30%) | **₦6,370** |
