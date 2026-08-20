// Owner: Josh
// Purpose: Product schema — branch-scoped inventory with reorder_point.
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
        name: { type: String, required: true },
        description: { type: String },
        price: { type: Number },
        quantity: { type: Number, required: true, default: 0 },
        reorder_point: { type: Number, default: 0 },
    },
    { timestamps: true }
);

productSchema.index({ branch_id: 1 });

module.exports = mongoose.model('Product', productSchema);
