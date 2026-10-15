// Owner: Josh
// Purpose: Garment and household item catalog schema with per-service pricing per branch.

import mongoose from 'mongoose';

const itemServicePriceSchema = new mongoose.Schema(
  {
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true},
    service_name: { type: String, required: true,trim: true,},
    price: { type: Number, required: true, min: 0, },
    is_available: { type: Boolean, default: true, }
  },
  { _id: false },
);

const catalogItemSchema = new mongoose.Schema(
  {
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true,},
    name: { type: String, required: true, trim: true,},
    category: { type: String,required: true,enum: ['Casuals','Native & Traditional','Corporate Wear','Outerwear & Jackets','Bedding & Household',],},
    description: { type: String,trim: true,default: '',},
    piece_count: { type: Number, default: 1,min: 1,},
    is_active: {type: Boolean,default: true,},
    services: {
      type: [itemServicePriceSchema],
      validate: [(services) => Array.isArray(services) && services.length > 0, 'At least one service price is required'],
    },
  },
  { timestamps: true },
);

// Optimize branch catalog lookups
catalogItemSchema.index({ branch_id: 1, category: 1, is_active: 1 });
catalogItemSchema.index({ branch_id: 1, name: 1 }, { unique: true });

const CatalogItem = mongoose.model('CatalogItem', catalogItemSchema);

export default CatalogItem;
