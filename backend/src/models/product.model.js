// Owner: Josh
// Purpose: Product schema — branch-scoped inventory with reorder_point.
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      trim: true,
      required: true,
    },
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: null },
    price: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, min: 0, required: true, default: 0 },
    reserved_quantity: { type: Number, min: 0, default: 0 },
    unit: { type: String, trim: true, default: "pieces" },
    reorder_point: { type: Number, min: 0, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Branch inventory lookup.
productSchema.index({ branch_id: 1, is_active: 1 });

// Prevent duplicate product names within the same branch.
productSchema.index({ branch_id: 1, name: 1 }, { unique: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
