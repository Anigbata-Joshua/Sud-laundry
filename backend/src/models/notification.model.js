// Owner: Series
// Purpose: Notification schema — in-app notifications per user.

// please read my comments before changing anything, jasmine im looking at you>>> thank you.

import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // adjust ref name to whatever josh calls the User model
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false, // some notifications (e.g. "welcome") may not be tied to an order
    },
    type: {
      type: String,
      enum: [
        'order_received',
        'order_confirmed',
        'order_cancelled',
        'inspecting',
        'processing',
        'payment_failed',
        'payment_successful',
        'payment_overpaid',
        'payment_refunded',
        'order_ready',
        'order_delivered',
        'task_assigned',
        'welcome',
        'other',
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    sent_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification
