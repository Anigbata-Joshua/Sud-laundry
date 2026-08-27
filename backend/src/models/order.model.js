// Owner: Josh
// Purpose: Order schema — includes embedded items, supplies_used, and feedback.

import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
    {
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        subtotal: { type: Number, required: true },
    },
    { _id: false }
);

const supplyUsedSchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String },
        quantity_used: { type: Number, required: true },
        employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        used_at: { type: Date, default: Date.now },
    }, { _id: false }
);

const feedbackSchema = new mongoose.Schema(
    {
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        submitted_at: { type: Date },
    }, { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
        status: {
            type: String,
            enum: ['placed', 'processing', 'ready', 'delivered', 'cancelled'],
            default: 'placed',
        },
        pickup_time: { type: Date },
        delivery_time: { type: Date },
        total_price: { type: Number, required: true },
        payment_status: {
            type: String,
            enum: ['unpaid', 'paid', 'refunded'],
            default: 'unpaid',
        },
        items: [orderItemSchema],
        supplies_used: [supplyUsedSchema],
        feedback: feedbackSchema,
        cancellation_reason: { type: String },
        cancelled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cancelled_at: { type: Date },
        refund_amount: { type: Number },
        amount_due: { type: Number, default: 0 },
        cancelled_on_customer_request: { type: Boolean, default: false },
    },
    { timestamps: true }
);

orderSchema.index({ customer_id: 1 });
orderSchema.index({ branch_id: 1, status: 1 });

// keep this bellow your schema (i need it and its good for our project) just after the scema definition, so we can index the collection for faster queries
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ branch_id: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;