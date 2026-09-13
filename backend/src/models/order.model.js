// Owner: Josh
// Purpose: Order schema — includes embedded items, supplies_used, and feedback.

import mongoose from 'mongoose'

// An order item
const orderItemSchema = new mongoose.Schema(
  {
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    name: { type: String, required: true },
    category: { type: String },
    type: { type: String },
    quantity: { type: Number, min: 1, required: true },
    unit_price: { type: Number, min: 0, required: true },
    subtotal: { type: Number, min: 0, required: true },
  },
  { _id: false },
)

// A supply used in the laundry process or requested by an employee for an order 
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

// Feedback from a customer for an order
const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    submitted_at: { type: Date },
  },
  { _id: false },
)

// Intake of an order by an employee
const intakeSchema = new mongoose.Schema(
  {
    original_items: [orderItemSchema],
    verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    verified_at: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: false },
)

// The main order document
const orderSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    status: {
      type: String,
      enum: ['placed','received','processing','quality_check','ready','delivered','cancelled',],
      default: 'placed',
    },
    fulfillment: {
      priority: { type: String, enum: ['normal', 'express'], default: 'normal' },
      turnaround_hours: { type: Number },
    },
    pickup_time: { type: Date },
    delivery_time: { type: Date },

    // Actual fulfillment timestamps
    picked_up_at: { type: Date },
    received_at: { type: Date },
    processing_started_at: { type: Date },
    delivered_at: { type: Date },
    actual_turnaround_hours: { type: Number, min: 0 },

    total_price: { type: Number, required: true },
    express_surcharge: { type: Number, default: 0, min: 0 },
    payment_status: {
      type: String,
      enum: ['unpaid', 'part_payment', 'paid', 'refunded'],
      default: 'unpaid',
    },
    items: [orderItemSchema],
    supplies_used: [supplyUsedSchema],
    feedback: feedbackSchema,
    intake: intakeSchema,
    cancellation_reason: { type: String },
    cancelled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelled_at: { type: Date },
    refund_amount: { type: Number },
    amount_due: { type: Number, default: 0 },
    cancelled_on_customer_request: { type: Boolean, default: false },
  },
  { timestamps: true },
)


// Pre-validation hook to update actual fulfillment times
orderSchema.pre('validate', function updateActualFulfillmentTimes() {
  if (this.isModified('status') && this.status === 'received' && !this.received_at) {
    this.received_at = new Date()
  }
  if (this.isModified('status') && this.status === 'delivered' && !this.delivered_at) {
    if (!this.received_at) {
      this.invalidate('status', 'An order must be received before it can be delivered')
      return
    }
    this.delivered_at = new Date()
  }
  if (this.received_at && this.delivered_at) {
    const milliseconds = this.delivered_at.getTime() - this.received_at.getTime()
    this.actual_turnaround_hours = Math.round((milliseconds / 3600000) * 100) / 100
  }
})

// Index for customer lookup
orderSchema.index({ customer_id: 1 })

// Index for branch status
orderSchema.index({ branch_id: 1, status: 1 })

  // Indexes for order retrieval
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ branch_id: 1, createdAt: -1 })

const Order = mongoose.model('Order', orderSchema)
export default Order