// Owner: Jasmine
// Purpose: create/view employees, scoped by role and branch.

import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createEmployee = asyncHandler(async (req, res, next) => {
    const { user_id, branch_id, job_title, hired_at } = req.body;
    const currentUser = req.user;

    // Admin can create employees at any branch
    // Branch Manager can only create at their own branch
    if (currentUser.role === 'branch_manager' && currentUser.branch_id !== branch_id.toString()) {
        throw new ApiError(403, 'You can only create employees at your own branch');
    }

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'Only admins and branch managers can create employees');
    }

    // Verify user exists
    const user = await User.findById(user_id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Check if employee already exists for this user
    const existingEmployee = await Employee.findOne({ user_id });
    if (existingEmployee) {
        throw new ApiError(400, 'Employee record already exists for this user');
    }

    // Create employee
    const employee = await Employee.create({
        user_id,
        branch_id,
        job_title,
        hired_at,
    });

    // Populate references
    await employee.populate('user_id', 'name email phone');
    await employee.populate('branch_id', 'name');

    return apiResponse(res, 201, employee, 'Employee created successfully');
});

export const getEmployees = asyncHandler(async (req, res, next) => {
    const currentUser = req.user;
    let query = {};

    // Branch managers see only their branch employees
    if (currentUser.role === 'branch_manager') {
        query.branch_id = currentUser.branch_id;
    }
    // Admins see all employees
    // Employees can't view employee list

    if (currentUser.role === 'employee' || currentUser.role === 'customer') {
        throw new ApiError(403, 'You do not have permission to view employees');
    }

    const employees = await Employee.find(query)
        .populate('user_id', 'name email phone')
        .populate('branch_id', 'name');

    return apiResponse(res, 200, employees, 'Employees retrieved successfully');
});

export const getEmployeeById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const currentUser = req.user;

    const employee = await Employee.findById(id)
        .populate('user_id', 'name email phone')
        .populate('branch_id', 'name');

    if (!employee) {
        throw new ApiError(404, 'Employee not found');
    }

    // Branch managers can only view employees from their branch
    if (currentUser.role === 'branch_manager' && currentUser.branch_id !== employee.branch_id.toString()) {
        throw new ApiError(403, 'You can only view employees from your own branch');
    }

    return apiResponse(res, 200, employee, 'Employee retrieved successfully');
});

export const updateEmployee = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { job_title, hired_at } = req.body;
    const currentUser = req.user;

    const employee = await Employee.findById(id);
    if (!employee) {
        throw new ApiError(404, 'Employee not found');
    }

    // Branch managers can only update employees from their branch
    if (currentUser.role === 'branch_manager' && currentUser.branch_id !== employee.branch_id.toString()) {
        throw new ApiError(403, 'You can only update employees from your own branch');
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'branch_manager') {
        throw new ApiError(403, 'You do not have permission to update employees');
    }

    // Update fields
    if (job_title) employee.job_title = job_title;
    if (hired_at) employee.hired_at = hired_at;

    await employee.save();
    await employee.populate('user_id', 'name email phone');
    await employee.populate('branch_id', 'name');

    return apiResponse(res, 200, employee, 'Employee updated successfully');
});

export const deleteEmployee = asyncHandler(async (req, res) => {
    const employee = await Employee.findById(req.params.id);
    if (!employee) throw new ApiError(404, 'Employee not found');
    if (
        req.user.role === 'branch_manager' &&
        employee.branch_id.toString() !== req.user.branch_id
    ) {
        throw new ApiError(403, 'You can only delete employees from your own branch');
    }
    if (!['admin', 'branch_manager'].includes(req.user.role)) {
        throw new ApiError(403, 'You do not have permission to delete employees');
    }
    await employee.deleteOne();
    await User.findByIdAndUpdate(employee.user_id, { role: 'customer' });
    return apiResponse(res, 200, null, 'Employee deleted successfully');
});
