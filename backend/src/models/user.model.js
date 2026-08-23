// Owner: Jasmine
// Purpose: User schema — base account record for all roles (admin, branch_manager, employee, customer).

import { Schema, model } from 'mongoose';

const userSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            match: [/.+@.+\..+/, 'Invalid email format'],
        },
        password_hash: {
            type: String,
            required: [true, 'Password is required'],
        },
        role: {
            type: String,
            enum: ['admin', 'branch_manager', 'employee', 'customer'],
            default: 'customer',
        },
        phone: {
            type: String,
            default: null,
        },
        address: {
            type: String,
            default: null,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default model('User', userSchema);
