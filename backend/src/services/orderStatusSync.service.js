// Owner: Josh (shared logic — called by Jasmine's task.controller.js after task create/update)
// Purpose: derive Order.status from the state of its Task documents, per the
// agreed mapping: first task created -> 'processing'; a task with
// stage 'delivery_ready' reaching status 'completed' -> 'ready'.
// 'delivered' and 'cancelled' are excluded — those remain manual/customer-driven.
// See guides/ for the shared-file rule — this file is called by both Dev1 and Dev2's
// controllers, so coordinate in team chat before editing.

import Order from '../models/order.model.js';
import Task from '../models/task.model.js';

const TERMINAL_STATUSES = ['delivered', 'cancelled'];

export const syncOrderStatusFromTasks = async (order_id) => {
    const order = await Order.findById(order_id);
    if (!order || TERMINAL_STATUSES.includes(order.status)) return;

    const tasks = await Task.find({ order_id });
    if (tasks.length === 0) return;

    const deliveryReadyDone = tasks.some((t) => t.stage === 'delivery_ready' && t.status === 'completed');

    let nextStatus = null;
    if (deliveryReadyDone) {
        nextStatus = 'ready';
    } else if (order.status === 'placed') {
        nextStatus = 'processing';
    }

    if (nextStatus && nextStatus !== order.status) {
        order.status = nextStatus;
        await order.save();
    }
};