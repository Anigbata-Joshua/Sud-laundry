// Owner: Josh
// Purpose: Order CRUD — customer placement/history,
// branch-scoped staff view/update.

import Order from '../models/order.model.js';
import Service from '../models/service.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
import createNotification from '../services/notification.service.js';
import { env } from '../config/env.js';

const DUPLICATE_ORDER_WINDOW_SECONDS = 10;

const FORCE_CANCEL_FEE_PERCENT = 30;


// POST /orders
// Customer places an order
export const createOrder = asyncHandler(async (req, res) => {
    const { branch_id, items, pickup_time, delivery_time, } = req.body;

    if (!branch_id || !Array.isArray(items) || !items.length) {
        throw new ApiError(400, 'branch_id and at least one item are required');
    }

    // Prevent duplicate submissions
    const duplicateRequest = await Order.findOne({
        customer_id: req.user.id,
        branch_id,
        createdAt: { $gte: new Date(Date.now() - DUPLICATE_ORDER_WINDOW_SECONDS * 1000), },
    }).sort({ createdAt: -1 });

    if (duplicateRequest) {
        throw new ApiError(409, 'A similar order was just submitted — if this is intentional, please wait a few seconds and try again');
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

        // IMPORTANT:
        // Service must belong to selected branch
        if (service.branch_id.toString() !== branch_id.toString()) {
            throw new ApiError(400, `Service "${service.name}" is not available at the selected branch`);
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
        message:
            `Your order has been placed. You can cancel it until we begin processing it, or within ${env.cancellationWindowMinutes} minutes — whichever comes first.`,
    });

    return apiResponse(res, 201, order, 'Order placed successfully');
});


// GET /orders/me
export const getMyOrders = asyncHandler(async (req, res) => {

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const orders = await Order.find({ customer_id: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

    return apiResponse(res, 200, orders, 'Order history fetched successfully');
});


// GET /orders
export const getAllOrders = asyncHandler(async (req, res) => {
    const currentUser = req.user;

    if (!['admin', 'branch_manager', 'employee'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to view orders');
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const filter = {};

    // Staff are restricted to their branch
    if (['branch_manager', 'employee'].includes(currentUser.role)) {
        filter.branch_id = currentUser.branch_id;
    }

    // Admin can optionally filter branch
    if (currentUser.role === 'admin' && req.query.branch_id) {
        filter.branch_id = req.query.branch_id;
    }

    const orders = await Order.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

    return apiResponse(res, 200, orders, 'Orders fetched successfully');
});


// GET /orders/:id
export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Customer can only see own order
    if (req.user.role === 'customer' && order.customer_id.toString() !== req.user.id) {
        throw new ApiError(403, 'Cannot view another customer\'s order');
    }

    // Staff are branch scoped
    if (['branch_manager', 'employee'].includes(req.user.role) && order.branch_id.toString() !== req.user.branch_id) {
        throw new ApiError(403,'Cannot view an order outside your branch');
    }

    return apiResponse(res, 200, order, 'Order fetched successfully');
});


// PATCH /orders/:id
export const updateOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(  req.params.id  );

    if (!order) {
        throw new ApiError(404,'Order not found');
    }

    // CUSTOMER PATH
    if (req.user.role === 'customer') {
        if (order.customer_id.toString() !== req.user.id ) {
            throw new ApiError(403,'Cannot modify another customer\'s order');
        }

        // Customer can ONLY cancel
        if (req.body.status !== 'cancelled' || Object.keys(req.body).length !== 1) {
            throw new ApiError(403,'Customers may only cancel their own order');
        }

        if (order.status !== 'placed') {
            throw new ApiError(409,`Order cannot be cancelled once it is ${order.status}`);
        }

        const minutesSincePlaced =(Date.now() -order.createdAt.getTime()) /60000;

        if (minutesSincePlaced > env.cancellationWindowMinutes ) {
            throw new ApiError(400,'Cancellation window has passed — order is already in progress');
        }

        order.status = 'cancelled';

        await order.save();

        await createNotification({
            user_id: req.user.id,
            order_id: order._id,
            type: 'other',
            message:'Your order has been cancelled.',
        });

        return apiResponse(res, 200, order, 'Order cancelled successfully');
    }

    // STAFF / ADMIN PATH

    if (!['admin', 'branch_manager', 'employee'].includes(req.user.role)) {
        throw new ApiError(403,'You do not have permission to update orders');
    }

    // Branch restriction
    if (['branch_manager', 'employee'].includes(req.user.role) &&
        order.branch_id.toString() !==req.user.branch_id ) {
        throw new ApiError(403,'Cannot update an order outside your branch');
    }

    const { pickup_time, delivery_time, payment_status, status,} = req.body;

    // STATUS

    if (status !== undefined) {
        // Only delivered can be manually set
        if (status !== 'delivered') {
            throw new ApiError(400,'Order status is derived from task progress and cannot be set directly, except marking as delivered');
        }

        // Must be ready
        if (order.status !== 'ready') {
            throw new ApiError(409,'Order must be ready before it can be marked delivered');
        }

        order.status = 'delivered';
    }


    // OTHER UPDATES

    if (pickup_time !== undefined) {
        order.pickup_time = pickup_time;
    }

    if (delivery_time !== undefined) {
        order.delivery_time = delivery_time;
    }

    // Payment status should ideally be managed
    // by payment controller.
    // Keeping this restricted to admin for safety.
    if (payment_status !== undefined) {
        if (req.user.role !== 'admin') { 
            throw new ApiError(403,'Only admins can manually update payment status');
        }

        order.payment_status = payment_status;
    }

    await order.save();

    return apiResponse(res,200,order,'Order updated successfully');
});


// PATCH /orders/:id/force-cancel
export const forceCancelOrder = asyncHandler(async (req, res) => {
    if (!['admin', 'branch_manager'].includes(req.user.role)) {
        throw new ApiError(403,'Only staff or admin can force-cancel an order');
    }

    const { reason,on_customer_request,} = req.body;

    if (!reason) {
        throw new ApiError(400,'A cancellation reason is required');
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
        throw new ApiError(404,'Order not found');
    }

    // Branch manager scope
    if (req.user.role === 'branch_manager' && order.branch_id.toString() !==req.user.branch_id) {
        throw new ApiError(403,'Cannot cancel an order outside your branch');
    }

    // Only placed or processing orders can be force cancelled
    if (!['placed', 'processing'].includes(order.status)) {
        throw new ApiError(409,`Order cannot be force-cancelled once it is ${order.status} — work is too far along`);
    }

    const fee = (order.total_price * FORCE_CANCEL_FEE_PERCENT) / 100;

    let refund_amount = 0;
    let amount_due = 0;

    if (order.payment_status === 'paid') {
        // Calculate refund (subtract fee)
        refund_amount = order.total_price - fee;
        order.payment_status = 'refunded';
    } else {
        // Amount due is the full fee
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

    const moneyLine = refund_amount > 0
            ? ` A refund of ${refund_amount} is due (${FORCE_CANCEL_FEE_PERCENT}% cancellation fee applied).`
            : amount_due > 0
                ? ` A cancellation fee of ${amount_due} is due at pickup.`
                : '';

    await createNotification({
        user_id: order.customer_id,
        order_id: order._id,
        type: 'other',
        message:
            openingLine + moneyLine,
    });

    return apiResponse(res, 200, order, 'Order force-cancelled successfully');
});