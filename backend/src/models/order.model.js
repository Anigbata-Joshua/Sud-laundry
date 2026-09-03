// Owner: Josh
// Purpose: Order schema — includes embedded items, supplies_used, and feedback.

import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false },
)

const supplyUsedSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String },
    quantity_used: { type: Number, required: true },
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    used_at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    submitted_at: { type: Date },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    status: {
      type: String,
      enum: [
        'placed',
        'received',
        'processing',
        'quality_check',
        'ready',
        'delivered',
        'cancelled',
      ],
      default: 'placed',
    },
    received_time: { type: Date, default: null },
    delivered_time: { type: Date, default: null },
    turnaround_hours: { type: Number, min: 0, default: null },
    total_price: { type: Number, required: true },
    payment_status: {
      type: String,
      enum: ['unpaid', 'paid','part_payment', 'refunded'],
      default: 'unpaid',
    },
    items: [orderItemSchema],
    supplies_used: [supplyUsedSchema],
    feedback: feedbackSchema,
  },
  { timestamps: true },
)

orderSchema.pre('validate', function updateFulfilmentTimes() {
  if (this.isModified('status') && this.status === 'received' && !this.received_time) {
    this.received_time = new Date()
  }
  if (this.isModified('status') && this.status === 'delivered' && !this.delivered_time) {
    if (!this.received_time) {
      this.invalidate('status', 'An order must be received before it can be delivered')
      return
    }
    this.delivered_time = new Date()
  }

  if (!this.received_time || !this.delivered_time) {
    this.turnaround_hours = null
    return
  }

  const durationMs = this.delivered_time.getTime() - this.received_time.getTime()
  if (durationMs <= 0) {
    this.invalidate('delivered_time', 'Delivered time must be later than received time')
    return
  }
  this.turnaround_hours = Math.round((durationMs / 3600000) * 100) / 100
})

orderSchema.index({ customer_id: 1 })
orderSchema.index({ branch_id: 1, status: 1 })

// keep this bellow your schema (i need it and its good for our project) just after the scema definition, so we can index the collection for faster queries
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ branch_id: 1, createdAt: -1 })

const Order = mongoose.model('Order', orderSchema)
export default Order
