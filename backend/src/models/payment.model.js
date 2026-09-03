// Owner: Series
// Purpose: Payment schema — linked to an order.

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
    },
    net_amount: { type: Number },
    transaction_type: {
      type: String,
      enum: ['payment', 'refund'],
      default: 'payment',
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'transfer', 'cash'],
      required: true,
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
      default: 'pending',
    },
    paymentType: {
      type: String,
      enum: ['part payment', 'full payment', 'overpayment'],
      default: 'full payment',
    },
    refunded_payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    refund_reason: { type: String, trim: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)
paymentSchema.index({ status: 1, createdAt: -1 })
paymentSchema.index({ branch_id: 1, createdAt: -1 })
paymentSchema.index(
  { refunded_payment_id: 1 },
  {
    unique: true,
    partialFilterExpression: { transaction_type: 'refund' },
  },
)
const Payment = mongoose.model('Payment', paymentSchema)
export default Payment
