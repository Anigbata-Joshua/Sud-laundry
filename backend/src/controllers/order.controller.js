// Owner: Josh
// Purpose: Order CRUD — customer placement/history, branch-scoped staff view/update.

import Order from '../models/order.model.js';
import Service from '../models/service.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
import createNotification from '../services/notification.service.js';
import { env } from '../config/env.js';

const DUPLICATE_ORDER_WINDOW_SECONDS = 10;
const FORCE_CANCEL_FEE_PERCENT = 30; // business keeps this % of total_price when staff force-cancels a paid order

// POST /orders — customer places an order
export const createOrder = asyncHandler(async (req, res) => {
    const { branch_id, items, pickup_time, delivery_time } = req.body;

    if (!branch_id || !Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'branch_id and at least one item are required');
    }

    // Guard against the same order being submitted twice in quick succession
    const duplicateRequest = await Order.findOne({
        customer_id: req.user.id,
        branch_id,
        createdAt: { $gte: new Date(Date.now() - DUPLICATE_ORDER_WINDOW_SECONDS * 1000) },
    }).sort({ createdAt: -1 });

    // Check
    if (duplicateRequest) {
        throw new ApiError(
            409,
            'A similar order was just submitted — if this is intentional, please wait a few seconds and try again'
        );
    }

    let total_price = 0;
    const resolvedItems = [];

    for (const item of items) {
        if (!item.service_id || typeof item.quantity !== 'number' || item.quantity <= 0) {
            throw new ApiError(400, 'Each item requires a valid service_id and a positive quantity');
        }

        const service = await Service.findById(item.service_id);
        if (!service) {
            throw new ApiError(404, `Service not found: ${item.service_id}`);
        }

        const subtotal = service.price * item.quantity;
        total_price += subtotal;

        resolvedItems.push({
            service_id: service._id,
            name: service.name,
            quantity: item.quantity,
            subtotal,
        });
    }

    const order = await Order.create({
        customer_id: req.user.id,
        branch_id,
        items: resolvedItems,
        total_price,
        pickup_time,
        delivery_time,
    });

    await createNotification({
        user_id: req.user.id,
        order_id: order._id,
        type: 'order_received',
        message: `Your order has been placed. You can cancel it until we begin processing it, or within ${env.cancellationWindowMinutes} minutes — whichever comes first.`,
    });

    apiResponse(res, 201, order, 'Order placed successfully');
});

// GET /orders/me — customer's own order history across all branches, paginated
export const getMyOrders = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = parseInt(req.query.skip, 10) || 0;

    const orders = await Order.find({ customer_id: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

    apiResponse(res, 200, orders, 'Order history fetched successfully');
});

// GET /orders — staff/admin, branch-scoped for staff, all branches for admin
export const getAllOrders = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = parseInt(req.query.skip, 10) || 0;

    const filter = {};
    if (req.user.role !== 'admin') {
        filter.branch_id = req.user.branch_id;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip);
    apiResponse(res, 200, orders, 'Orders fetched successfully');
});

// GET /orders/:id — customer (own order only) or staff/admin (branch-scoped)
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');

    if (req.user.role === 'customer' && order.customer_id.toString() !== req.user.id) {
        throw new ApiError(403, 'Cannot view another customer\'s order');
    }
    if (
        ['branch_manager', 'employee'].includes(req.user.role) &&
        order.branch_id.toString() !== req.user.branch_id
    ) {
        throw new ApiError(403, 'Cannot view an order outside your branch');
    }

    apiResponse(res, 200, order, 'Order fetched successfully');
});

// PATCH /orders/:id — customer cancellation (time-boxed) or staff/admin update
export const updateOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');

    // Customer path: cancellation only, within the window, own order only
    if (req.user.role === 'customer') {
        if (order.customer_id.toString() !== req.user.id) {
            throw new ApiError(403, 'Cannot modify another customer\'s order');
        }
        if (req.body.status !== 'cancelled' || Object.keys(req.body).length > 1) {
            throw new ApiError(403, 'Customers may only cancel their own order');
        }
        if (order.status !== 'placed') {
            // Covers 'cancelled' (already done), and 'processing'/'ready'/'delivered' —
            // once a task exists, work has started regardless of the time window.
            throw new ApiError(409, `Order cannot be cancelled once it is ${order.status}`);
        }

        const minutesSincePlaced = (Date.now() - order.createdAt.getTime()) / 60000;
        if (minutesSincePlaced > env.cancellationWindowMinutes) {
            throw new ApiError(400, 'Cancellation window has passed — order is already in progress');
        }

        order.status = 'cancelled';
        await order.save();

        await createNotification({
            user_id: req.user.id,
            order_id: order._id,
            type: 'other',
            message: 'Your order has been cancelled.',
        });

        return apiResponse(res, 200, order, 'Order cancelled successfully');
    }

    // Staff/admin path: branch scoping, everything except status transitions ---
    if (['branch_manager', 'employee'].includes(req.user.role)) {
        if (order.branch_id.toString() !== req.user.branch_id) {
            throw new ApiError(403, 'Cannot update an order outside your branch');
        }
    }

    const { pickup_time, delivery_time, payment_status, status } = req.body;

    if (status !== undefined) {
        // order.status is system-derived from Task progress (see
        // services/orderStatusSync.service.js) except for 'delivered', which staff
        // set manually below. Direct writes to 'placed'/'processing'/'ready' are
        // rejected so the two never drift out of sync.
        if (status !== 'delivered') {
            throw new ApiError(
                400,
                'Order status is derived from task progress and cannot be set directly, except marking as delivered'
            );
        }
        if (order.status !== 'ready') {
            throw new ApiError(409, 'Order must be ready before it can be marked delivered');
        }
        order.status = 'delivered';
    }

    const updates = {};
    if (pickup_time !== undefined) updates.pickup_time = pickup_time;
    if (delivery_time !== undefined) updates.delivery_time = delivery_time;
    if (payment_status !== undefined) updates.payment_status = payment_status;

    Object.assign(order, updates);
    await order.save();

    apiResponse(res, 200, order, 'Order updated successfully');
});

// PATCH /orders/:id/force-cancel — staff/admin only. Allowed while status is
// PATCH /orders/:id/force-cancel — staff/admin only. Allowed while status is
// 'placed' or 'processing' — blocked once 'ready' (work is essentially done),
// 'delivered', or already 'cancelled'.
export const forceCancelOrder = asyncHandler(async (req, res) => {
    if (!['admin', 'branch_manager'].includes(req.user.role)) {
        throw new ApiError(403, 'Only staff or admin can force-cancel an order');
    }

    const { reason, on_customer_request } = req.body;
    if (!reason) {
        throw new ApiError(400, 'A cancellation reason is required');
    }

    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');

    if (req.user.role === 'branch_manager' && order.branch_id.toString() !== req.user.branch_id) {
        throw new ApiError(403, 'Cannot cancel an order outside your branch');
    }

    if (!['placed', 'processing'].includes(order.status)) {
        throw new ApiError(409, `Order cannot be force-cancelled once it is ${order.status} — work is too far along`);
    }

    const fee = (order.total_price * FORCE_CANCEL_FEE_PERCENT) / 100;
    let refund_amount = 0;
    let amount_due = 0;

    if (order.payment_status === 'paid') {
        refund_amount = order.total_price - fee;
        order.payment_status = 'refunded';
    } else {
        // Nothing was collected up front, but the branch already committed
        // product/labor — the customer still owes the cancellation fee,
        // settled in person when they come to collect their (unfinished) items.
        amount_due = fee;
    }

    order.status = 'cancelled';
    order.cancellation_reason = reason;
    order.cancelled_by = req.user.id;
    order.cancelled_at = new Date();
    order.cancelled_on_customer_request = !!on_customer_request;
    order.refund_amount = refund_amount;
    order.amount_due = amount_due;
    await order.save();

    const openingLine = on_customer_request
        ? 'Your order was cancelled per your request.'
        : `Your order was cancelled by staff (reason: ${reason}).`;

    const moneyLine =
        refund_amount > 0
            ? ` A refund of ${refund_amount} is due (${FORCE_CANCEL_FEE_PERCENT}% cancellation fee applied).`
            : amount_due > 0
            ? ` A cancellation fee of ${amount_due} is due at pickup.`
            : '';

    await createNotification({
        user_id: order.customer_id,
        order_id: order._id,
        type: 'other',
        message: openingLine + moneyLine,
    });

    apiResponse(res, 200, order, 'Order force-cancelled successfully');
});