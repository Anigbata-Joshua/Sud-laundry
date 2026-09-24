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
            unique: true, //Josh updated this filed
            lowercase: true,
            match: [/.+@.+\..+/, 'Invalid email format'],
        },
        password_hash: {
            type: String,
            required: [true, 'Password is required'],
        },
          role: {
            type: String,
            enum: ['admin', 'branch_manager', 'employee', 'front_desk', 'inventory_officer', 'inventory_manager', 'customer'],
            default: 'customer',
        },
        // Required for customers so the laundry can actually reach them
        // (delivery, order updates). Staff/admin accounts (created directly
        // with a non-customer role by seedAdmin.js / adminUser.controller.js)
        // are unaffected by this — only self-registered customers hit it.
        phone: {
            type: String,
            trim: true,
            default: null,
            required: [
                function () {
                    return this.role === 'customer';
                },
                'Phone number is required for customer accounts',
            ],
            match: [/^\+?[0-9]{7,15}$/, 'Phone number must be 7-15 digits, optionally starting with +'],
        },
        address: {
            type: String,
            trim: true,
            default: null,
            required: [
                function () {
                    return this.role === 'customer';
                },
                'Address is required for customer accounts',
            ],
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        passwordResetToken: {
            type: String,
            default: null,
        },
        passwordResetExpires: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

export default model('User', userSchema);