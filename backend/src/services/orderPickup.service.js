import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Notification from '../models/notification.model.js';
import ApiError from '../utils/apiError.js';

export const PICKUP_CONFIRMATION_DELAY_MS = 48 * 60 * 60 * 1000;

// Persist the transition and customer notice together. The status predicate prevents
// customer, staff, and scheduled confirmations from overwriting one another.
export async function transitionPickup({ orderId, actor, action, now = new Date() }) {
    if (!mongoose.isObjectIdOrHexString(orderId)) throw new ApiError(400, 'Invalid order ID');
    const session = await mongoose.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            const order = await Order.findById(orderId).session(session);
            if (!order) throw new ApiError(404, 'Order not found');
            const automatic = action === 'automatic';
            if (!automatic) {
                if (actor?.role === 'customer') {
                    if (String(order.customer_id) !== String(actor.id)) throw new ApiError(403, 'You can only confirm your own order');
                    if (action !== 'confirm') throw new ApiError(403, 'Only staff can mark orders as sent out');
                } else {
                    if (!['admin', 'branch_manager', 'front_desk'].includes(actor?.role)) throw new ApiError(403, 'You cannot manage order pickup');
                    if (actor.role !== 'admin' && String(order.branch_id) !== String(actor.branch_id)) throw new ApiError(403, 'Cannot manage an order outside your branch');
                }
            }
            if (action !== 'send' && order.status === 'delivered') {
                result = order;
                return;
            }
            const filter = { _id: order._id, status: order.status };
            let updates;
            let message;
            if (action === 'send') {
                if (order.status !== 'ready') throw new ApiError(409, 'Only ready orders can be marked as sent out');
                const deadline = new Date(now.getTime() + PICKUP_CONFIRMATION_DELAY_MS);
                updates = { status: 'sent_out', sent_out_at: now, auto_pickup_at: deadline };
                message = `Your order has been sent out. Please mark it as picked up once you receive it. If you do not confirm, it will automatically be marked as picked up after 2 days, at ${deadline.toISOString()}.`;
            } else {
                if (!['ready', 'sent_out'].includes(order.status)) throw new ApiError(409, 'Order is not ready for pickup confirmation');
                if (automatic) {
                    if (order.status !== 'sent_out' || !order.auto_pickup_at || order.auto_pickup_at > now) throw new ApiError(409, 'Automatic pickup confirmation is not due');
                    filter.auto_pickup_at = { $lte: now };
                }
                if (!order.received_at) throw new ApiError(409, 'Order must have been received before pickup confirmation');
                updates = {
                    status: 'delivered', picked_up_at: now, delivered_at: now,
                    pickup_confirmed_at: now,
                    pickup_confirmation_source: automatic ? 'automatic' : actor.role === 'customer' ? 'customer' : 'staff',
                    actual_turnaround_hours: Math.max(0, Math.round((now - order.received_at) / 3600000 * 100) / 100),
                };
                if (!automatic) updates.pickup_confirmed_by = actor.id;
                message = automatic
                    ? 'Your order has automatically been marked as picked up because 2 days have passed since it was sent out without your confirmation.'
                    : 'Your order has been marked as picked up. Thank you!';
            }
            result = await Order.findOneAndUpdate(filter, { $set: updates }, { new: true, runValidators: true, session });
            if (!result) throw new ApiError(409, 'Order changed while confirming pickup; please retry');
            await Notification.create([{
                user_id: order.customer_id, order_id: order._id,
                type: action === 'send' ? 'order_sent_out' : 'order_delivered',
                message, sent_at: now,
            }], { session });
        });
        return result;
    } finally {
        await session.endSession();
    }
}
