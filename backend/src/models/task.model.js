// Owner:Jasmine
// Purpose: task schema — assigns an employee to an order processing stage.

import { Schema, model } from 'mongoose'

const taskSchema = new Schema(
  {
    employee_id: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
    },
    stage: {
      type: String,
      enum: ['intake', 'received', 'processing', 'quality_check', 'delivery_ready'],
      required: [true, 'Stage is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'on_hold'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

// Index for quick lookups by employee and order
taskSchema.index({ employee_id: 1, order_id: 1 })
taskSchema.index({ employee_id: 1, status: 1 })

export default model('Task', taskSchema)
