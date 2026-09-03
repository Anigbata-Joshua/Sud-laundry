import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    net_amount: { type: Number, required: true },
    transaction_type: {
      type: String,
      enum: ['payment', 'refund'],
      default: 'payment',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'transfer', 'cash'],
      required: true,
    },
    transaction_ref: { type: String, sparse: true },
    customer_Name: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    paymentType: {
      type: String,
      enum: ['part payment', 'full payment', 'overpayment'],
      default: 'part payment',
    },
    refunded_payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    refund_reason: { type: String, trim: true, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)

paymentSchema.index({ orderId: 1, status: 1 })
paymentSchema.index({ branch_id: 1, createdAt: -1 })
paymentSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Payment', paymentSchema)
