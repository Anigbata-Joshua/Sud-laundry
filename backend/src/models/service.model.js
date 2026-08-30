// Owner: Josh
// Purpose: Service schema — laundry service catalog, tied to a branch.
import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
    {
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ['service', 'add-on'], default: 'service', required: true },
        category: { type: String, trim: true },
        price: { type: Number, min: 0, required: true },
        turnaround_hours: { type: Number, min: 1},
        is_active: { type: Boolean, default: true,}
    },
    { timestamps: true }
);

// General branch lookup
serviceSchema.index({ branch_id: 1 });

// Prevent duplicate service/add-on names within the same branch
serviceSchema.index(
    { branch_id: 1, name: 1 },
    { unique: true }
);

const Service = mongoose.model('Service', serviceSchema);
export default Service;
