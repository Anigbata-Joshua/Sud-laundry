import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    available_branch_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    // Legacy field retained temporarily so existing branch-owned records remain readable.
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: false },
  },
  { timestamps: true },
)

serviceSchema.index({ available_branch_ids: 1 })

export default mongoose.model('Service', serviceSchema)
