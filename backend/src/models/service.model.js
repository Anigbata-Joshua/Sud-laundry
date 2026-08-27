// Owner: Josh
// Purpose: Service schema — laundry service catalog, tied to a branch.
import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
    {
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
        name: { type: String, required: true },
        category: { type: String },
        price: { type: Number, required: true },
        turnaround_hours: { type: Number },
    },
    { timestamps: true }
);

serviceSchema.index({ branch_id: 1 });

const Service = mongoose.model('Service', serviceSchema);
export default Service;
