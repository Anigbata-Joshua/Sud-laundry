// Owner: Jasmine
// Purpose: submit, approve, reject leave requests.

import LeaveRequest from '../models/leaveRequest.model.js';
import Employee from '../models/employee.model.js';
import ProcessingWorkflow from '../models/processingWorkflow.model.js';
import createNotification from '../services/notification.service.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const submitLeaveRequest = asyncHandler(async (req, res, next) => {
    const { start_date, end_date, reason } = req.body;
    let { employee_id } = req.body;
    const currentUser = req.user;

    // Only employees can submit leave requests
    if (currentUser.role !== 'employee') {
        throw new ApiError(403, 'Only employees can submit leave requests');
    }

    if (!start_date || !end_date || !reason) {
        throw new ApiError(400, 'start_date, end_date, and reason are required');
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new ApiError(400, 'Invalid date format for start_date or end_date');
    }

    if (startDate > endDate) {
        throw new ApiError(400, 'start_date must be before or equal to end_date');
    }

    // Always ensure the employee submitting owns this record
    const employee = await Employee.findOne({ user_id: currentUser.id });
    if (!employee) {
        throw new ApiError(404, 'Employee record not found for this user');
    }

    if (employee_id && employee._id.toString() !== employee_id.toString()) {
        throw new ApiError(403, 'You can only submit leave requests for yourself');
    }

    employee_id = employee._id;

    // Check for overlapping pending or approved leave requests for this employee
    const overlapping = await LeaveRequest.findOne({
        employee_id,
        status: { $in: ['pending', 'approved'] },
        start_date: { $lte: endDate },
        end_date: { $gte: startDate },
    });
    if (overlapping) {
        throw new ApiError(400, 'You already have a pending or approved leave request covering this period');
    }

    // Create leave request
    const leaveRequest = await LeaveRequest.create({
        employee_id,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'pending',
    });

    await leaveRequest.populate('employee_id');

    return apiResponse(res, 201, leaveRequest, 'Leave request submitted successfully');
});

export const getLeaveRequests = asyncHandler(async (req, res, next) => {
    const currentUser = req.user;
    if (!['admin', 'branch_manager', 'employee'].includes(currentUser.role)) {
        throw new ApiError(403, 'You cannot view leave requests');
    }
    let query = {};

    // Employees see only their own requests
    if (currentUser.role === 'employee') {
        // Get employee record for this user
        const employee = await Employee.findOne({ user_id: currentUser.id });
        if (!employee) {
            throw new ApiError(404, 'Employee record not found');
        }
        query.employee_id = employee._id;
    }
    // Branch managers see requests for employees in their branch
    else if (currentUser.role === 'branch_manager') {
        const employees = await Employee.find({ branch_id: currentUser.branch_id });
        const employeeIds = employees.map(e => e._id);
        query.employee_id = { $in: employeeIds };
    }
    // Admins see all requests

    const leaveRequests = await LeaveRequest.find(query)
        .populate('employee_id')
        .populate('approved_by', 'name email');

    return apiResponse(res, 200, leaveRequests, 'Leave requests retrieved successfully');
});

export const approveLeaveRequest = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const currentUser = req.user;

    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
        throw new ApiError(404, 'Leave request not found');
    }

    // Prevent approving an already-decided request
    if (leaveRequest.status !== 'pending') {
        throw new ApiError(400, `Leave request has already been ${leaveRequest.status}`);
    }

    // Only branch managers and admins can approve
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to approve leave requests');
    }

    // Branch managers can only approve for their branch
    const employee = await Employee.findById(leaveRequest.employee_id);
    if (!employee) {
        throw new ApiError(404, 'Assigned employee not found');
    }
    if (currentUser.role === 'branch_manager' && employee.branch_id.toString() !== currentUser.branch_id) {
        throw new ApiError(403, 'You can only approve leave requests for your branch');
    }

    // Block approval if employee has active in-progress workflow tasks
    const activeTask = await ProcessingWorkflow.findOne({
        status: 'active',
        steps: {
            $elemMatch: {
                employee_id: leaveRequest.employee_id,
                status: { $in: ['assigned', 'accepted'] },
            },
        },
    });
    if (activeTask) {
        throw new ApiError(
            400,
            'Cannot approve leave: employee has active workflow tasks. Please reassign their tasks before approving leave.',
        );
    }

    // Update leave request
    leaveRequest.status = 'approved';
    leaveRequest.approved_by = currentUser.id;
    await leaveRequest.save();

    await leaveRequest.populate('employee_id');
    await leaveRequest.populate('approved_by', 'name email');

    // Notify employee of approval
    if (employee.user_id) {
        createNotification({
            user_id: employee.user_id,
            type: 'other',
            message: `Your leave request from ${new Date(leaveRequest.start_date).toLocaleDateString()} to ${new Date(leaveRequest.end_date).toLocaleDateString()} has been approved.`,
        }).catch(() => {});
    }

    return apiResponse(res, 200, leaveRequest, 'Leave request approved successfully');
});

export const rejectLeaveRequest = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { rejection_reason, reason } = req.body;
    const finalReason = (rejection_reason || reason || '').trim();
    const currentUser = req.user;

    if (!finalReason) {
        throw new ApiError(400, 'Rejection reason is required');
    }

    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
        throw new ApiError(404, 'Leave request not found');
    }

    // Prevent rejecting an already-decided request
    if (leaveRequest.status !== 'pending') {
        throw new ApiError(400, `Leave request has already been ${leaveRequest.status}`);
    }

    // Only branch managers and admins can reject
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to reject leave requests');
    }

    // Branch managers can only reject for their branch
    const employee = await Employee.findById(leaveRequest.employee_id);
    if (!employee) {
        throw new ApiError(404, 'Assigned employee not found');
    }
    if (currentUser.role === 'branch_manager' && employee.branch_id.toString() !== currentUser.branch_id) {
        throw new ApiError(403, 'You can only reject leave requests for your branch');
    }

    // Update leave request
    leaveRequest.status = 'rejected';
    leaveRequest.rejection_reason = finalReason;
    await leaveRequest.save();

    await leaveRequest.populate('employee_id');

    // Notify employee of rejection
    if (employee.user_id) {
        createNotification({
            user_id: employee.user_id,
            type: 'other',
            message: `Your leave request was rejected. Reason: ${finalReason}`,
        }).catch(() => {});
    }

    return apiResponse(res, 200, leaveRequest, 'Leave request rejected successfully');
});
