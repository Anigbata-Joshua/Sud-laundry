// Owner: Jasmine
// Purpose: Employee schema — links a user to a branch and job title.

import { Schema, model } from 'mongoose';

const employeeSchema = new Schema(
    {
        user_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },
        branch_id: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: [true, 'Branch ID is required'],
        },
        job_title: {
            type: String,
            required: [true, 'Job title is required'],
            trim: true,
        },
        hired_at: {
            type: Date,
            required: [true, 'Hire date is required'],
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default model('Employee', employeeSchema);
