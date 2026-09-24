// Owner: Josh
// Purpose: Service schema — laundry service catalog, tied to a branch.
// Each service can define the inventory supplies consumed per service unit.

import mongoose from 'mongoose';

const serviceSupplySchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId,ref: 'Product',required: true,},
        quantity_per_unit: { type: Number, required: true, min: 0.001, },
    },
    { _id: false }
);

const serviceSchema = new mongoose.Schema(
    {
        branch_id: {type: mongoose.Schema.Types.ObjectId,ref: 'Branch',required: true,},
        name: {type: String,required: true,trim: true,},
        type: {type: String,enum: ['service', 'add-on'],default: 'service',required: true,},
        category: {type: String,trim: true,},
        category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory' },
        price: {type: Number,min: 0,required: true,},
        turnaround_hours: {type: Number,min: 1,},

        // Inventory supplies consumed when this service is processed.
        supplies: {type: [serviceSupplySchema], default: [],},

        is_active: {type: Boolean,default: true,},
    },

    { timestamps: true }
);

// General branch lookup
serviceSchema.index({ branch_id: 1 });
serviceSchema.index({ branch_id: 1, category_id: 1, is_active: 1 });

// Prevent duplicate service/add-on names within the same branch
serviceSchema.index(
    { branch_id: 1, name: 1 },
    { unique: true }
);

const Service = mongoose.model('Service', serviceSchema);

export default Service;
