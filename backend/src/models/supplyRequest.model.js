// Owner: Josh
// Purpose: Attendant/staff supply requests:
// 1) "extra_supplies" — optional mid-job requests when attendants need extra supplies
// 2) "restock" — branch manager supply requests for low/missing stock
// Reviewed and approved/rejected by inventory officers.

import mongoose from 'mongoose';

const requestedItemSchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        product_name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
        unit: { type: String },
    },
    { _id: false },
);

const supplyRequestSchema = new mongoose.Schema(
    {
        order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        workflow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessingWorkflow' },
        step_id: { type: mongoose.Schema.Types.ObjectId },
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

        requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

        request_type: {
            type: String,
            enum: ['extra_supplies', 'restock'],
            default: 'extra_supplies',
        },
        reason: { type: String, trim: true },

        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },

        // Items requested / suggested
        calculated_items: [requestedItemSchema],

        // What the officer actually decides to disburse or restock
        approved_items: [requestedItemSchema],

        reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        reviewed_at: { type: Date },
        rejection_reason: { type: String, trim: true },
    },
    { timestamps: true },
);

// One pending request per step for extra supplies
supplyRequestSchema.index(
    { step_id: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'pending', step_id: { $type: 'objectId' } } },
);

supplyRequestSchema.index({ branch_id: 1, status: 1, createdAt: -1 });
supplyRequestSchema.index({ order_id: 1 });

const SupplyRequest = mongoose.model('SupplyRequest', supplyRequestSchema);
export default SupplyRequest;
