// Owner: Josh
// Purpose: StockMovement schema — purchase / sale / usage events.
import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        type: { type: String, enum: ['purchase', 'sale', 'usage'], required: true },
        quantity: { type: Number, required: true },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

stockMovementSchema.index({ product_id: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
