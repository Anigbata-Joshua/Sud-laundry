// Owner: Josh
// Purpose: Branch schema — name, address, phone.
import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        address: { type: String, required: true },
        phone: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
