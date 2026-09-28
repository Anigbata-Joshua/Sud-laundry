import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, trim: true, required: true, maxlength: 100 },
    name_key: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    is_active: { type: Boolean, default: true },
}, { timestamps: true });

schema.pre('validate', function () {
    if (this.name) this.name_key = this.name.trim().toLowerCase();
});
schema.index({ branch_id: 1, name_key: 1 }, { unique: true });

export default mongoose.model('ServiceCategory', schema);
