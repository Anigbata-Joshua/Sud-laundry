// Owner: Jasmine
// Purpose: create, view, and update employees,
// scoped by role and branch.

import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';


// POST /employees
export const createEmployee = asyncHandler(async (req, res) => {
    const { user_id, branch_id, job_title, hired_at } = req.body;

    const currentUser = req.user;

    // Only admin and branch manager
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'Only admins and branch managers can create employees');
    }

    if (!user_id || !branch_id || !job_title || !hired_at) {
        throw new ApiError(400, 'user_id, branch_id, job_title, and hired_at are required');
    }

    // Branch manager must use their own branch
    if (currentUser.role === 'branch_manager' && currentUser.branch_id !== branch_id.toString()) {
        throw new ApiError(403, 'You can only create employees at your own branch');
    }

    // Verify user
    const user = await User.findById(user_id);

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Prevent customer account from being assigned as employee
    if (user.role === 'customer') {
        throw new ApiError(400,'Customer accounts cannot be assigned as employees');
    }

    // Check existing employee record
    const existingEmployee = await Employee.findOne({ user_id, });

    if (existingEmployee) {
        throw new ApiError(400,'Employee record already exists for this user');
    }

    const employee = await Employee.create({ user_id, branch_id, job_title, hired_at, });

    await employee.populate('user_id','name email phone role');

    await employee.populate('branch_id','name');

    return apiResponse(res, 201, employee, 'Employee created successfully');
});


// GET /employees
export const getEmployees = asyncHandler(async (req, res) => {
    const currentUser = req.user;

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403,'You do not have permission to view employees');
    }

    const query = {};

    if (currentUser.role === 'branch_manager') {
        query.branch_id = currentUser.branch_id;
    }

    const employees = await Employee.find(query)
    .populate('user_id','name email phone role is_active')
    .populate('branch_id','name')
    .sort({ createdAt: -1 });

    return apiResponse(res, 200, employees,'Employees retrieved successfully');
});


// GET /employees/:id
export const getEmployeeById = asyncHandler(async (req, res) => {

    const { id } = req.params;
    const currentUser = req.user;

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403,'You do not have permission to view employees');
    }

    const employee = await Employee.findById(id)
    .populate('user_id','name email phone role is_active')
    .populate('branch_id','name');

    if (!employee) {
        throw new ApiError(404,'Employee not found');
    }

    if (currentUser.role === 'branch_manager' &&
        employee.branch_id._id.toString() !== currentUser.branch_id) {
        throw new ApiError(403,'You can only view employees from your own branch');
    }

    return apiResponse(res,200,employee,'Employee retrieved successfully');
});


// PATCH /employees/:id
export const updateEmployee = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { job_title, hired_at, } = req.body;

    const currentUser = req.user;

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403,'You do not have permission to update employees');
    }

    const employee = await Employee.findById(id);

    if (!employee) {
        throw new ApiError(404,'Employee not found');
    }

    // Branch manager can only update employees
    // in their own branch
    if (currentUser.role === 'branch_manager' &&
        employee.branch_id.toString() !== currentUser.branch_id) {
        throw new ApiError(403,'You can only update employees from your own branch');
    }

    if (job_title !== undefined) {
        employee.job_title = job_title;
    }

    if (hired_at !== undefined) {
        employee.hired_at = hired_at;
    }

    await employee.save();

    await employee.populate('user_id','name email phone role is_active');

    await employee.populate('branch_id','name');

    return apiResponse(res,200,employee,'Employee updated successfully');
});