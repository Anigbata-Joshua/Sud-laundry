// Owner: Jasmine
// Purpose: submit, approve, reject leave requests.

import LeaveRequest from '../models/leaveRequest.model.js';
import Employee from '../models/employee.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const submitLeaveRequest = asyncHandler(async (req, res, next) => {
    const { employee_id, start_date, end_date, reason } = req.body;
    const currentUser = req.user;

    // Only employees can submit leave requests
    if (currentUser.role !== 'employee') {
        throw new ApiError(403, 'Only employees can submit leave requests');
    }

    // Verify employee exists
    const employee = await Employee.findById(employee_id);
    if (!employee) {
        throw new ApiError(404, 'Employee not found');
    }

    // Create leave request
    const leaveRequest = await LeaveRequest.create({
        employee_id,
        start_date,
        end_date,
        reason,
        status: 'pending',
    });

    await leaveRequest.populate('employee_id');

    return apiResponse(res, 201, leaveRequest, 'Leave request submitted successfully');
});

export const getLeaveRequests = asyncHandler(async (req, res, next) => {
    const currentUser = req.user;
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

    // Only branch managers and admins can approve
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to approve leave requests');
    }

    // Branch managers can only approve for their branch
    if (currentUser.role === 'branch_manager') {
        const employee = await Employee.findById(leaveRequest.employee_id);
        if (employee.branch_id.toString() !== currentUser.branch_id) {
            throw new ApiError(403, 'You can only approve leave requests for your branch');
        }
    }

    // Update leave request
    leaveRequest.status = 'approved';
    leaveRequest.approved_by = currentUser.id;
    await leaveRequest.save();

    await leaveRequest.populate('employee_id');
    await leaveRequest.populate('approved_by', 'name email');

    return apiResponse(res, 200, leaveRequest, 'Leave request approved successfully');
});

export const rejectLeaveRequest = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const currentUser = req.user;

    const leaveRequest = await LeaveRequest.findById(id);
    if (!leaveRequest) {
        throw new ApiError(404, 'Leave request not found');
    }

    // Only branch managers and admins can reject
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to reject leave requests');
    }

    // Branch managers can only reject for their branch
    if (currentUser.role === 'branch_manager') {
        const employee = await Employee.findById(leaveRequest.employee_id);
        if (employee.branch_id.toString() !== currentUser.branch_id) {
            throw new ApiError(403, 'You can only reject leave requests for your branch');
        }
    }

    // Update leave request
    leaveRequest.status = 'rejected';
    leaveRequest.rejection_reason = rejection_reason;
    await leaveRequest.save();

    await leaveRequest.populate('employee_id');

    return apiResponse(res, 200, leaveRequest, 'Leave request rejected successfully');
});
