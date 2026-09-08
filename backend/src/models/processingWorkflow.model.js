import mongoose from 'mongoose'

const processStepSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, enum: ['intake', 'washing', 'processing', 'quality_check', 'packaging', 'delivery_ready'], },
    sequence: { type: Number, required: true, min: 1 },
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    status: {
      type: String,
      enum: ['assigned', 'accepted', 'completed'],
      default: 'assigned',
    },
    accepted_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
  },
  { timestamps: true },
)

const processingWorkflowSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    cycle: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['active', 'completed', 'qc_failed'],
      default: 'active',
    },
    qc_notes: { type: String, trim: true, default: null },
    steps: { type: [processStepSchema], validate: [(steps) => steps.length > 0, 'Add a process'] },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

processingWorkflowSchema.index({ order_id: 1, cycle: 1 }, { unique: true })
processingWorkflowSchema.index({ 'steps.employee_id': 1, status: 1 })

export default mongoose.model('ProcessingWorkflow', processingWorkflowSchema)
