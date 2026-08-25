// Owner: Josh
// Purpose: Order CRUD — customer placement/history, branch-scoped staff view/update.

import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
import createNotification from '../services/notification.service.js';
import { env } from '../config/env.js';

// POST /orders — customer places an order
// total_price is always server-calculated from items[].subtotal — never trust a client-sent value.
export const createOrder = asyncHandler(async (req, res) => {
    const { branch_id, items, pickup_time, delivery_time } = req.body;

    if (!branch_id || !Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'branch_id and at least one item are required');
    }

    const total_price = items.reduce((sum, item) => {
        if (typeof item.subtotal !== 'number' || item.subtotal < 0) {
            throw new ApiError(400, `Invalid subtotal for item: ${item.name || item.service_id}`);
        }
        return sum + item.subtotal;
    }, 0);

    const order = await Order.create({
        customer_id: req.user.id,
        branch_id,
        items,
        total_price,
        pickup_time,
        delivery_time,
    });

    await createNotification({
        user_id: req.user.id,
        order_id: order._id,
        type: 'order_confirmed',
        message: `Your order has been placed. You may cancel it within ${env.cancellationWindowMinutes} minutes — after that it is assumed to be in progress and cannot be cancelled.`,
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

    // --- Customer path: cancellation only, within the window, own order only ---
    if (req.user.role === 'customer') {
        if (order.customer_id.toString() !== req.user.id) {
            throw new ApiError(403, 'Cannot modify another customer\'s order');
        }
        if (req.body.status !== 'cancelled' || Object.keys(req.body).length > 1) {
            throw new ApiError(403, 'Customers may only cancel their own order');
        }
        if (order.status === 'cancelled') {
            throw new ApiError(409, 'Order is already cancelled');
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
            type: 'order_cancelled',
            message: 'Your order has been cancelled.',
        });

        return apiResponse(res, 200, order, 'Order cancelled successfully');
    }

    // --- Staff/admin path: branch scoping, everything except status transitions ---
    if (['branch_manager', 'employee'].includes(req.user.role)) {
        if (order.branch_id.toString() !== req.user.branch_id) {
            throw new ApiError(403, 'Cannot update an order outside your branch');
        }
    }

    const { pickup_time, delivery_time, payment_status, status } = req.body;

    if (status !== undefined) {
        // TODO(Rule 6, blocked on Dev1 conversation): order.status transitions driven by
        // Task.stage progress are not yet defined — the two enums don't currently map
        // 1:1 (see order.model.js vs task.model.js). Do not allow arbitrary status writes
        // here until that mapping is agreed. Rejecting for now rather than guessing.
        throw new ApiError(
            501,
            'Status updates via this endpoint are not yet implemented — pending status/stage mapping agreement with Dev1'
        );
    }

    const updates = {};
    if (pickup_time !== undefined) updates.pickup_time = pickup_time;
    if (delivery_time !== undefined) updates.delivery_time = delivery_time;
    if (payment_status !== undefined) updates.payment_status = payment_status;

    Object.assign(order, updates);
    await order.save();

    apiResponse(res, 200, order, 'Order updated successfully');
});