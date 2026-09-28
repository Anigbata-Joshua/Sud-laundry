import cron from 'node-cron';
import Order from '../models/order.model.js';
import { transitionPickup } from '../services/orderPickup.service.js';
import logger from '../utils/logger.js';

export async function confirmOverduePickups(now = new Date()) {
    const orders = await Order.find({ status: 'sent_out', auto_pickup_at: { $lte: now } })
        .select('_id').sort({ auto_pickup_at: 1 }).limit(500).lean();
    let confirmed = 0;
    for (const order of orders) {
        try {
            await transitionPickup({ orderId: order._id, action: 'automatic', now });
            confirmed++;
        } catch (error) {
            logger.error('Automatic pickup confirmation failed', { orderId: String(order._id), error: error.message });
        }
    }
    return confirmed;
}

export function startAutoPickupJob() {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try { await confirmOverduePickups(); }
        catch (error) { logger.error('Automatic pickup job failed', { error: error.message }); }
        finally { running = false; }
    };
    void run(); // Catch up on deadlines that passed while the server was stopped.
    return cron.schedule('* * * * *', run);
}
