// Owner: Jasmine
// Purpose: leave request schema — employee_id, start_date, end_date, status.

import { Schema, model } from 'mongoose';

const leaveRequestSchema = new Schema(
    {
        employee_id: {
            type: Schema.Types.ObjectId,
            ref: 'Employee',
            required: [true, 'Employee ID is required'],
        },
        start_date: {
            type: Date,
            required: [true, 'Start date is required'],
        },
        end_date: {
            type: Date,
            required: [true, 'End date is required'],
        },
        reason: {
            type: String,
            required: [true, 'Reason is required'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        approved_by: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        rejection_reason: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

export default model('LeaveRequest', leaveRequestSchema);
