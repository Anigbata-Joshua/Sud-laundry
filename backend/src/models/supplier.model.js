// Owner: Series
//
// Purpose:
// Supplier reference record.
// Suppliers are shared company records and are not branch-scoped.
//
// Important:
// Supplier does not own inventory or product quantities.
// Products supplied by a supplier are recorded through purchase/stock
// movement records.

import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    contact: {
      phone: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },

      address: {
        type: String,
        trim: true,
        default: null,
      },
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Supplier names should be unique.
supplierSchema.index(
  { name: 1 },
  { unique: true }
);

// Useful when filtering active suppliers.
supplierSchema.index({
  is_active: 1,
});

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;