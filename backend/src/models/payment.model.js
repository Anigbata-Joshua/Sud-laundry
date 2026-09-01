// Owner: Series
// Purpose: Payment schema — linked to an order.


import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true
        },
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
        },
        amount: {
            type: Number,
            required: true
        },
        paymentMethod: {
            type: String,
            enum: ['card', 'transfer', 'cash'],
            required: true
        },
        transaction_ref: {
            type: String,
            sparse: true,
        },
        customer_Name: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        paymentType: {
            type: String,
            enum: ['part payment', 'full payment'],
            default: 'full payment'
        }
    },
    { timestamps: true }
)
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ branch_id: 1, createdAt: -1 }); 
const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;