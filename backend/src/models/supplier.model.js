// Owner: Series
// Purpose: Supplier schema — reference record only, no login/portal.


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
      },
      address: {
        type: String,
        trim: true,
      },
    },
    items_supplied: [
      {
        type: String,
        trim: true,
      },
    ],
    is_active: {
      type: Boolean,
      default: true, // lets admin "deactivate" a supplier without deleting history
    },
  },
  { timestamps: true }
);

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;