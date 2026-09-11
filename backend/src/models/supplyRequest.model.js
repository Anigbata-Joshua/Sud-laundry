// Owner: Josh
// Purpose: attendant -> inventory officer approval gate for supply
// disbursement. Replaces the old flat auto-deduction — stock is only
// ever removed once an inventory_officer reviews and approves this.

import mongoose from 'mongoose';

const requestedItemSchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        product_name: { type: String, required: true }, // kept even if product_id is null (not found at branch)
        quantity: { type: Number, required: true, min: 0 },
        unit: { type: String },
    },
    { _id: false },
);

const supplyRequestSchema = new mongoose.Schema(
    {
        order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
        workflow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessingWorkflow', required: true },
        step_id: { type: mongoose.Schema.Types.ObjectId, required: true },
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

        requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },

        // System-calculated suggestion, shown to the officer as a starting point.
        calculated_items: [requestedItemSchema],

        // What the officer actually decides to disburse — may differ from
        // calculated_items if they judge the order needs more/less.
        approved_items: [requestedItemSchema],

        reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        reviewed_at: { type: Date },
        rejection_reason: { type: String, trim: true },
    },
    { timestamps: true },
);

// One pending request per step at a time — an attendant shouldn't be able
// to spam multiple requests for the same step.
supplyRequestSchema.index(
    { step_id: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } },
);

supplyRequestSchema.index({ branch_id: 1, status: 1, createdAt: -1 });
supplyRequestSchema.index({ order_id: 1 });

const SupplyRequest = mongoose.model('SupplyRequest', supplyRequestSchema);
export default SupplyRequest;