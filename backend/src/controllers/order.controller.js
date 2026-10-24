// Owner: Josh
// Purpose: Order CRUD — customer placement/history,
// branch-scoped staff view/update.

import Order from "../models/order.model.js";
import Service from "../models/service.model.js";
import CatalogItem from "../models/catalogItem.model.js";
import Branch from "../models/branch.model.js";
import Employee from "../models/employee.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import apiResponse from "../utils/apiResponse.js";
import createNotification from "../services/notification.service.js";
import logger from "../utils/logger.js";
import { env } from "../config/env.js";
import { transitionPickup } from "../services/orderPickup.service.js";
import {
  checkAndReserveSuppliesForOrder,
  releaseReservedSuppliesForOrder,
  adjustReservedSuppliesForIntake,
} from "../services/inventoryConsumption.service.js";
import { autoAssignProcessingWorkflow } from "../services/workflowAssignment.service.js";

export function calculateExpressSurcharge(totalPrice, priority) {
  if (priority !== "express") return 0;
  return Math.round(totalPrice * (env.expressSurchargePercent / 100) * 100) / 100;
}

// GET /orders/pricing-config
export const getPricingConfig = asyncHandler(async (req, res) => {
  return apiResponse(res, 200, { express_surcharge_percent: env.expressSurchargePercent, },
    "Pricing configuration",
  );
});

export const confirmPickup = asyncHandler(async (req, res) => {
  const order = await transitionPickup({
    orderId: req.params.id,
    actor: req.user,
    action: "confirm",
  });
  return apiResponse(res, 200, order, "Order marked as picked up");
});

export const sendOutOrder = asyncHandler(async (req, res) => {
  const order = await transitionPickup({
    orderId: req.params.id,
    actor: req.user,
    action: "send",
  });
  return apiResponse(res, 200, order, "Order sent out; pickup confirmation is due in 2 days");
});

const DUPLICATE_ORDER_WINDOW_SECONDS = 10;

const FORCE_CANCEL_FEE_PERCENT = 30;

// POST /orders
// Customer places an order
export const createOrder = asyncHandler(async (req, res) => {
  if (!["admin", "customer"].includes(req.user.role)) {
    throw new ApiError(403, "Only customers and admins can create orders");
  }
  const { branch_id, customer_id, items, pickup_time, priority = "normal" } = req.body;
  const customerId = req.user.role === "admin" ? customer_id : req.user.id;

  if (!branch_id || !customerId || !Array.isArray(items) || !items.length) {
    throw new ApiError(400, "branch_id, customer_id and at least one item are required");
  }

  // Validate priority
  if (!["normal", "express"].includes(priority)) {
    throw new ApiError(400, "Priority must be either normal or express");
  }

  // Validate pickup time
  if (!pickup_time) {
    throw new ApiError(400, "pickup_time is required");
  }

  const pickupDate = new Date(pickup_time);

  if (Number.isNaN(pickupDate.getTime())) {
    throw new ApiError(400, "pickup_time must be a valid date");
  }

  // Pickup time cannot be in the past
  if (pickupDate < new Date()) {
    throw new ApiError(400, "pickup_time cannot be in the past");
  }

  // Prevent duplicate submissions
  const duplicateRequest = await Order.findOne({
    customer_id: customerId,
    branch_id,
    createdAt: {
      $gte: new Date(Date.now() - DUPLICATE_ORDER_WINDOW_SECONDS * 1000),
    },
  }).sort({ createdAt: -1 });

  if (duplicateRequest) {
    throw new ApiError(409, "A similar order was just submitted — if this is intentional, please wait a few seconds and try again");
  }

  let total_price = 0;
  let longestTurnaroundHours = 0;
  const resolvedItems = [];
  const seenLines = new Set();

  for (const item of items) {
    if (!item.catalog_item_id) {
      throw new ApiError(400, "Each item requires a valid catalog_item_id");
    }

    if (!item.service_id) {
      throw new ApiError(400, "Each item requires a valid service_id");
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 500) {
      throw new ApiError(400, "Item quantity must be a positive integer not exceeding 500");
    }

    const lineKey = `${item.catalog_item_id}:${item.service_id}`;
    if (seenLines.has(lineKey)) {
      throw new ApiError(400, "Duplicate item and service detected: please combine quantities into a single line");
    }
    seenLines.add(lineKey);

    const catalogItem = await CatalogItem.findOne({
      _id: item.catalog_item_id,
      branch_id,
      is_active: true,
    });

    if (!catalogItem) {
      throw new ApiError(400, "Garment item not found or inactive at this branch",);
    }

    const servicePricing = catalogItem.services.find(
      (s) =>
        String(s.service_id) === String(item.service_id) &&
        s.is_available === true,
    );

    if (!servicePricing) {
      throw new ApiError( 400,`Service is unavailable for "${catalogItem.name}"`);
    }

    const service = await Service.findById(item.service_id);

    if (!service) {
      throw new ApiError(404, `Service not found: ${item.service_id}`);
    }

    if (!service.is_active) {
      throw new ApiError(400, `Service "${service.name}" is no longer active`);
    }

    // IMPORTANT:
    // Service must belong to selected branch
    if (service.branch_id.toString() !== branch_id.toString()) {
      throw new ApiError(
        400,
        `Service "${service.name}" is not available at the selected branch`,
      );
    }

    // Only regular services determine order turnaround.
    if (service.type === "service") {
      if (
        typeof service.turnaround_hours !== "number" ||
        service.turnaround_hours < 1
      ) {
        throw new ApiError(
          400,
          `Service "${service.name}" does not have a valid turnaround time`,
        );
      }

      longestTurnaroundHours = Math.max(
        longestTurnaroundHours,
        service.turnaround_hours,
      );
    }

    // Never trust client price: use verified price from CatalogItem
    const unit_price = servicePricing.price;
    const subtotal = Math.round(unit_price * item.quantity * 100) / 100;

    total_price += subtotal;

    resolvedItems.push({
      service_id: service._id,
      name: service.name, // SERVICE name
      category: service.category, // SERVICE category
      type: service.type || "service",
      catalog_item_id: catalogItem._id,
      item_name: catalogItem.name, // GARMENT name
      item_category: catalogItem.category, // GARMENT category
      piece_count: catalogItem.piece_count || 1,
      service_name: service.name,
      quantity: item.quantity,
      unit_price,
      subtotal,
    });
  }

  // An order cannot contain only add-ons.
  if (longestTurnaroundHours < 1) {
    throw new ApiError(
      400,
      "An order must contain at least one regular service",
    );
  }

  // Normal = longest service turnaround
  // Express = fixed 24-hour turnaround
  const turnaround_hours = priority === "express" ? 24 : longestTurnaroundHours;

  // Calculate delivery time from pickup time
  const deliveryDate = new Date(
    pickupDate.getTime() + turnaround_hours * 60 * 60 * 1000,
  );
  // Express orders receive the configured surcharge calculated via shared helper
  const express_surcharge = calculateExpressSurcharge(total_price, priority);

  const amount_due = total_price + express_surcharge;

  // Check and atomically reserve stock across all required products for this order
  const supplies_reserved = await checkAndReserveSuppliesForOrder({
    branch_id,
    items: resolvedItems,
    customer_id: customerId,
  });

  let order;
  try {
    order = await Order.create({
      customer_id: customerId,
      branch_id,
      items: resolvedItems,
      supplies_reserved,
      total_price,
      express_surcharge,
      amount_due,
      pickup_time: pickupDate,
      delivery_time: deliveryDate,

      fulfillment: {
        priority,
        turnaround_hours,
      },
    });
  } catch (createErr) {
    if (supplies_reserved && supplies_reserved.length) {
      await releaseReservedSuppliesForOrder({ supplies_reserved }).catch(
        (releaseErr) => {
          logger.error(
            "Failed to release reserved supplies on order creation failure:",
            {
              error: releaseErr.message,
            },
          );
        },
      );
    }
    throw createErr;
  }

  await createNotification({
    user_id: customerId,
    order_id: order._id,
    type: "order_received",
    message: `Your order has been placed. You can cancel it until we begin processing it, or within ${env.cancellationWindowMinutes} minutes — whichever comes first.`,
  });

  const [branchEmployees, branch] = await Promise.all([
    Employee.find({ branch_id, is_active: true }).populate({
      path: "user_id",
      match: {
        role: { $in: ["branch_manager", "front_desk"] },
        is_active: true,
      },
      select: "_id",
    }),
    Branch.findById(branch_id).select("name"),
  ]);
  const staffRecipients = new Set(
    branchEmployees
      .filter((employee) => employee.user_id)
      .map((employee) => employee.user_id._id.toString()),
  );
  staffRecipients.delete(customerId.toString());
  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
  await Promise.all(
    [...staffRecipients].map((userId) =>
      createNotification({
        user_id: userId,
        order_id: order._id,
        type: "order_received",
        message: `New order ${reference} was received at ${branch?.name || "the selected branch"}.`,
      }),
    ),
  );

  return apiResponse(res, 201, order, "Order placed successfully");
});

// GET /orders/me
export const getMyOrders = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

  const orders = await Order.find({ customer_id: req.user.id })
    .populate("branch_id", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

  return apiResponse(res, 200, orders, "Order history fetched successfully");
});

// GET /orders
export const getAllOrders = asyncHandler(async (req, res) => {
  const currentUser = req.user;

  if (
    !["admin", "branch_manager", "employee", "front_desk"].includes(
      currentUser.role,
    )
  ) {
    throw new ApiError(403, "You do not have permission to view orders");
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

  const filter = {};

  // Staff are restricted to their branch
  if (["branch_manager", "employee", "front_desk"].includes(currentUser.role)) {
    filter.branch_id = currentUser.branch_id;
  }

  // Admin can optionally filter branch
  if (currentUser.role === "admin" && req.query.branch_id) {
    filter.branch_id = req.query.branch_id;
  }

  const orders = await Order.find(filter)
    .populate("customer_id", "name email")
    .populate("branch_id", "name")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

  return apiResponse(res, 200, orders, "Orders fetched successfully");
});

// GET /orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("customer_id", "name email phone address")
    .populate("branch_id", "name address phone");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Customer can only see own order
  const customerId = order.customer_id?._id
    ? order.customer_id._id.toString()
    : order.customer_id?.toString();
  if (req.user.role === "customer" && customerId !== req.user.id) {
    throw new ApiError(403, "Cannot view another customer's order");
  }

  // Staff are branch scoped
  const branchId = order.branch_id?._id
    ? order.branch_id._id.toString()
    : order.branch_id?.toString();
  if (
    ["branch_manager", "employee", "front_desk", "inventory_officer"].includes(
      req.user.role,
    ) &&
    branchId !== req.user.branch_id
  ) {
    throw new ApiError(403, "Cannot view an order outside your branch");
  }

  return apiResponse(res, 200, order, "Order fetched successfully");
});

const populateOrderDetails = async (doc) => {
  if (doc && typeof doc.populate === "function") {
    await doc.populate([
      { path: "customer_id", select: "name email phone address" },
      { path: "branch_id", select: "name address phone" },
    ]);
  }
  return doc;
};

// PATCH /orders/:id
export const updateOrder = asyncHandler(async (req, res) => {
  if (["sent_out", "delivered"].includes(req.body.status)) {
    if (Object.keys(req.body).length !== 1)
      throw new ApiError(
        400,
        "Send pickup status changes separately from other order updates",
      );
    const updated = await transitionPickup({
      orderId: req.params.id,
      actor: req.user,
      action: req.body.status === "sent_out" ? "send" : "confirm",
    });
    await populateOrderDetails(updated);
    return apiResponse(res, 200, updated, "Order updated successfully");
  }
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // CUSTOMER PATH
  if (req.user.role === "customer") {
    if (order.customer_id.toString() !== req.user.id) {
      throw new ApiError(403, "Cannot modify another customer's order");
    }

    // Customer can ONLY cancel
    if (req.body.status !== "cancelled" || Object.keys(req.body).length !== 1) {
      throw new ApiError(403, "Customers may only cancel their own order");
    }

    if (order.status !== "placed") {
      throw new ApiError(
        409,
        `Order cannot be cancelled once it is ${order.status}`,
      );
    }

    const minutesSincePlaced = (Date.now() - order.createdAt.getTime()) / 60000;

    if (minutesSincePlaced > env.cancellationWindowMinutes) {
      throw new ApiError(
        400,
        "Cancellation window has passed — order is already in progress",
      );
    }

    order.status = "cancelled";

    await releaseReservedSuppliesForOrder(order);
    await order.save();
    await populateOrderDetails(order);

    await createNotification({
      user_id: req.user.id,
      order_id: order._id,
      type: "other",
      message: "Your order has been cancelled.",
    });

    return apiResponse(res, 200, order, "Order cancelled successfully");
  }

  // STAFF / ADMIN PATH
  if (
    !["admin", "branch_manager", "employee", "front_desk"].includes(
      req.user.role,
    )
  ) {
    throw new ApiError(403, "You do not have permission to update orders");
  }

  // Branch restriction
  if (
    ["branch_manager", "employee", "front_desk"].includes(req.user.role) &&
    order.branch_id.toString() !== req.user.branch_id
  ) {
    throw new ApiError(403, "Cannot update an order outside your branch");
  }

  const {
    pickup_time,
    delivery_time,
    payment_status,
    status,
    intake_items,
    intake_notes,
  } = req.body;

  // STATUS
  if (status !== undefined) {
    const allowedTransition =
      order.status === "placed" && status === "received";
    if (!allowedTransition) {
      throw new ApiError(409, "Order status is controlled by its workflow");
    }

    // Intake verification: front desk (or manager/admin covering for them)
    if (
      order.status === "placed" &&
      status === "received" &&
      Array.isArray(intake_items)
    ) {
      if (intake_items.length !== order.items.length) {
        throw new ApiError(
          400,
          "intake_items must match the number of items on the order",
        );
      }

      const employee = await Employee.findOne({ user_id: req.user.id });
      if (!employee) throw new ApiError(404, "Employee record not found");

      const originalItems = order.items.map((item) => ({
        ...(item.toObject ? item.toObject() : item),
      }));
      const originalSuppliesReserved = (order.supplies_reserved || []).map(
        (s) => ({
          ...(s.toObject ? s.toObject() : s),
        }),
      );
      const originalTotalPrice = order.total_price;
      const originalExpressSurcharge = order.express_surcharge;
      const originalAmountDue = order.amount_due;
      const originalStatus = order.status;

      const correctedItems = order.items.map((item, index) => {
        const correction = intake_items[index];
        const quantity = Number(correction?.quantity);
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw new ApiError(
            400,
            `intake_items[${index}].quantity must be a positive number`,
          );
        }
        return {
          ...item.toObject(),
          quantity,
          unit_price: item.unit_price,
          subtotal: Math.round(item.unit_price * quantity * 100) / 100,
        };
      });

      // Adjust atomically reserved supplies according to corrected quantities
      await adjustReservedSuppliesForIntake({
        order,
        intakeItems: correctedItems,
        branch_id: order.branch_id,
      });

      try {
        const previousAmountDue = order.amount_due;
        order.intake = {
          original_items: originalItems,
          verified_by: employee._id,
          verified_at: new Date(),
          notes: intake_notes?.trim() || undefined,
        };
        order.items = correctedItems;
        order.total_price = correctedItems.reduce(
          (sum, item) => sum + item.subtotal,
          0,
        );
        order.express_surcharge = calculateExpressSurcharge(
          order.total_price,
          order.priority,
        );
        order.amount_due = order.total_price + order.express_surcharge;
        order.status = status;

        if (previousAmountDue !== order.amount_due) {
          await createNotification({
            user_id: order.customer_id,
            order_id: order._id,
            type: "order_received",
            message: `Your order quantities were verified at intake. The updated total is ₦${order.amount_due.toLocaleString()}.`,
          });
        }

        if (pickup_time !== undefined) {
          const pickupDate = new Date(pickup_time);
          if (Number.isNaN(pickupDate.getTime())) {
            throw new ApiError(400, "pickup_time must be a valid date");
          }
          order.pickup_time = pickupDate;
        }

        if (delivery_time !== undefined) {
          const deliveryDate = new Date(delivery_time);
          if (Number.isNaN(deliveryDate.getTime())) {
            throw new ApiError(400, "delivery_time must be a valid date");
          }
          order.delivery_time = deliveryDate;
        }

        if (payment_status !== undefined) {
          if (req.user.role !== "admin") {
            throw new ApiError(
              403,
              "Only admins can manually update payment status",
            );
          }
          order.payment_status = payment_status;
        }

        order.status = status;
        await order.save();

        await autoAssignProcessingWorkflow({
          order,
          createdByUserId: req.user.id,
        });

        await populateOrderDetails(order);
        return apiResponse(res, 200, order, "Order updated successfully");
      } catch (err) {
        // Rollback reserved supplies back to original
        await adjustReservedSuppliesForIntake({
          order,
          intakeItems: originalItems,
          branch_id: order.branch_id,
        }).catch((rollbackErr) => {
          logger.error(
            "Failed to rollback reserved supplies during failed intake:",
            {
              error: rollbackErr.message,
            },
          );
        });

        order.items = originalItems;
        order.supplies_reserved = originalSuppliesReserved;
        order.total_price = originalTotalPrice;
        order.express_surcharge = originalExpressSurcharge;
        order.amount_due = originalAmountDue;
        order.status = originalStatus;
        order.intake = undefined;

        throw err;
      }
    }

    order.status = status;
  }

  // OTHER UPDATES
  if (pickup_time !== undefined) {
    const pickupDate = new Date(pickup_time);

    if (Number.isNaN(pickupDate.getTime())) {
      throw new ApiError(400, "pickup_time must be a valid ");
    }

    order.pickup_time = pickupDate;
  }

  if (delivery_time !== undefined) {
    const deliveryDate = new Date(delivery_time);

    if (Number.isNaN(deliveryDate.getTime())) {
      throw new ApiError(400, "delivery_time must be a valid");
    }

    order.delivery_time = deliveryDate;
  }

  // Payment status should ideally be managed
  // by payment controller.
  // Keeping this restricted to admin for safety.
  if (payment_status !== undefined) {
    if (req.user.role !== "admin") {
      throw new ApiError(403, "Only admins can manually update payment status");
    }

    order.payment_status = payment_status;
  }

  const becameReceived = order.isModified("status") && order.status === "received";
  await order.save();

  if (becameReceived) {
    try {
      await autoAssignProcessingWorkflow({
        order,
        createdByUserId: req.user.id,
      });
    } catch (assignErr) {
      order.status = "placed";
      await order.save();
      throw assignErr;
    }
  }

  await populateOrderDetails(order);

  return apiResponse(res, 200, order, "Order updated successfully");
});

// PATCH /orders/:id/force-cancel
export const forceCancelOrder = asyncHandler(async (req, res) => {
  if (!["admin", "branch_manager"].includes(req.user.role)) {
    throw new ApiError(403, "Only staff or admin can force-cancel an order");
  }

  const { reason, on_customer_request } = req.body;

  if (!reason) {
    throw new ApiError(400, "A cancellation reason is required");
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Branch manager scope
  if (
    req.user.role === "branch_manager" &&
    order.branch_id.toString() !== req.user.branch_id
  ) {
    throw new ApiError(403, "Cannot cancel an order outside your branch");
  }

  // Only placed or processing orders can be force cancelled
  if (!["placed", "processing"].includes(order.status)) {
    throw new ApiError(
      409,
      `Order cannot be force-cancelled once it is ${order.status} — work is too far along`,
    );
  }

  const fee = (order.total_price * FORCE_CANCEL_FEE_PERCENT) / 100;

  let refund_amount = 0;
  let amount_due = 0;

  if (order.payment_status === "paid") {
    // Calculate refund (subtract fee)
    refund_amount = order.total_price - fee;
    order.payment_status = "refunded";
  } else {
    // Amount due is the full fee
    amount_due = fee;
  }

  order.status = "cancelled";
  order.cancellation_reason = reason;
  order.cancelled_by = req.user.id;
  order.cancelled_at = new Date();
  order.cancelled_on_customer_request = !!on_customer_request;

  order.refund_amount = refund_amount;
  order.amount_due = amount_due;

  await releaseReservedSuppliesForOrder(order);
  await order.save();
  await populateOrderDetails(order);

  const openingLine = on_customer_request
    ? "Your order was cancelled per your request."
    : `Your order was cancelled by staff (reason: ${reason}).`;

  const moneyLine =
    refund_amount > 0
      ? ` A refund of ${refund_amount} is due (${FORCE_CANCEL_FEE_PERCENT}% cancellation fee applied).`
      : amount_due > 0
        ? ` A cancellation fee of ${amount_due} is due at pickup.`
        : "";

  await createNotification({
    user_id: order.customer_id,
    order_id: order._id,
    type: "other",
    message: openingLine + moneyLine,
  });

  return apiResponse(res, 200, order, "Order force-cancelled successfully");
});
