// Owner: Josh
// Purpose: immutable inventory movement history.

import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
    {
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
        type: { type: String, enum: ['purchase', 'sale', 'usage'], required: true,},

        // Always store the actual signed inventory change.
        // purchase = positive
        // sale = negative
        // usage = negative
        quantity: { type: Number, required: true,validate: {validator: Number.isFinite,message: 'Quantity must be a valid number',},},

        // Branch where the movement occurred.
        branch_id: { type: mongoose.Schema.Types.ObjectId,ref: 'Branch',required: true,},
        
        // Employee responsible for usage.
        employee_id: { type: mongoose.Schema.Types.ObjectId,ref: 'Employee',},
        
        // Order associated with usage.
        order_id: {type: mongoose.Schema.Types.ObjectId,ref: 'Order',},

        // Audit notes
        notes: { type: String, trim: true, default: null },
    },
    {
        timestamps: {createdAt: 'created_at',updatedAt: false,},
    }
);


// Product history / inventory ledger.
stockMovementSchema.index({product_id: 1,created_at: -1,});

// Branch inventory reporting.
stockMovementSchema.index({branch_id: 1,created_at: -1,});

// Order usage lookup.
stockMovementSchema.index({order_id: 1,type: 1,});

// Employee usage history.
stockMovementSchema.index({employee_id: 1,created_at: -1,});

const StockMovement = mongoose.model('StockMovement',stockMovementSchema);

export default StockMovement;