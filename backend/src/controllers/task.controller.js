// Owner: Jasmine
// Purpose: assign, view, and update order-stage tasks.

import Task from '../models/task.model.js';
import Employee from '../models/employee.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { syncOrderStatusFromTasks } from '../services/orderStatusSync.service.js';


export const createTask = asyncHandler(async (req, res, next) => {
    const { employee_id, order_id, stage } = req.body;
    const currentUser = req.user;

    // Only admins and branch managers can create tasks
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to create tasks');
    }

    // Verify employee exists
    const employee = await Employee.findById(employee_id);
    if (!employee) {
        throw new ApiError(404, 'Employee not found');
    }

    // Branch managers can only assign to their branch employees
    if (currentUser.role === 'branch_manager' && currentUser.branch_id !== employee.branch_id.toString()) {
        throw new ApiError(403, 'You can only assign tasks to employees in your branch');
    }

    // Create task
    const task = await Task.create({
        employee_id,
        order_id,
        stage,
        status: 'pending',
    });

    await task.populate('employee_id');
    await task.populate('order_id');

    await syncOrderStatusFromTasks(order_id);

    return apiResponse(res, 201, task, 'Task created successfully');
});


export const getEmployeeTasks = asyncHandler(async (req, res, next) => {
    const currentUser = req.user;
    let query = {};

    // Employees see only their assigned tasks
    if (currentUser.role === 'employee') {
        const employee = await Employee.findOne({ user_id: currentUser.id });
        if (!employee) {
            throw new ApiError(404, 'Employee record not found');
        }
        query.employee_id = employee._id;
    }
    // Branch managers and admins can see all tasks in their scope
    else if (currentUser.role === 'branch_manager') {
        const employees = await Employee.find({ branch_id: currentUser.branch_id });
        const employeeIds = employees.map(e => e._id);
        query.employee_id = { $in: employeeIds };
    }
    // Admins see all tasks

    const tasks = await Task.find(query)
        .populate('employee_id')
        .populate('order_id')
        .sort({ createdAt: -1 });

    return apiResponse(res, 200, tasks, 'Tasks retrieved successfully');
});

export const getTaskById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const currentUser = req.user;

    const task = await Task.findById(id)
        .populate('employee_id')
        .populate('order_id');

    if (!task) {
        throw new ApiError(404, 'Task not found');
    }

    // Employees can only view their own tasks
    if (currentUser.role === 'employee') {
        const employee = await Employee.findOne({ user_id: currentUser.id });
        if (!employee || task.employee_id._id.toString() !== employee._id.toString()) {
            throw new ApiError(403, 'You can only view your own tasks');
        }
    }
    // Branch managers can only view tasks for their branch
    else if (currentUser.role === 'branch_manager') {
        const employee = await Employee.findById(task.employee_id._id);
        if (employee.branch_id.toString() !== currentUser.branch_id) {
            throw new ApiError(403, 'You can only view tasks for your branch');
        }
    }

    return apiResponse(res, 200, task, 'Task retrieved successfully');
});

export const updateTaskStatus = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const currentUser = req.user;

    const task = await Task.findById(id);
    if (!task) {
        throw new ApiError(404, 'Task not found');
    }

    // Employees can only update their own tasks
    if (currentUser.role === 'employee') {
        const employee = await Employee.findOne({ user_id: currentUser.id });
        if (!employee || task.employee_id.toString() !== employee._id.toString()) {
            throw new ApiError(403, 'You can only update your own tasks');
        }
    }
    // Branch managers and admins can update any task in their scope
    else if (currentUser.role === 'branch_manager') {
        const employee = await Employee.findById(task.employee_id);
        if (employee.branch_id.toString() !== currentUser.branch_id) {
            throw new ApiError(403, 'You can only update tasks for your branch');
        }
    }

    // Update fields
    if (status) {
        task.status = status;
        if (status === 'completed') {
            task.completed_at = new Date();
        }
    }
    if (notes !== undefined) task.notes = notes;

    await task.save();
    await task.populate('employee_id');
    await task.populate('order_id');

    return apiResponse(res, 200, task, 'Task updated successfully');
});
