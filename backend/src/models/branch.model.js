// Owner: Josh
// Purpose: Branch schema — name, address, phone.
import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        address: { type: String, required: true },
        phone: { type: String, required: true, unique: true },
    },
    { timestamps: true }
);

const Branch = mongoose.model('Branch', branchSchema);
export default Branch;
