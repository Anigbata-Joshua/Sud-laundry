// Owner: Jasmine
// Purpose: assign, view, and update order-stage tasks.

import Task from '../models/task.model.js';
import Employee from '../models/employee.model.js';
import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { syncOrderStatusFromTasks } from '../services/orderStatusSync.service.js';


// POST /tasks
// Admin and branch managers can create tasks.
export const createTask = asyncHandler(async (req, res) => {
    const { employee_id, order_id, stage } = req.body;
    const currentUser = req.user;

    // Only admins and branch managers can create tasks
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to create tasks');
    }

    if (!employee_id || !order_id || !stage) {
        throw new ApiError(400, 'employee_id, order_id, and stage are required');
    }

    // Verify employee exists
    const employee = await Employee.findById(employee_id);

    if (!employee) {
        throw new ApiError(404, 'Employee not found');
    }

    // Verify order exists
    const order = await Order.findById(order_id);

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Branch managers can only assign to their branch employees
    if (currentUser.role === 'branch_manager' &&employee.branch_id.toString() !== currentUserbranch_id) {
     throw new ApiError(403,'You can only assign tasks to employees in your branch');
    }

    // Ensure employee and order belong to the same branch
    if (employee.branch_id.toString() !== order.branch_id.toString()) {
     throw new ApiError(400,'Employee and order must belong to the same branch');
    }

    // Branch manager cannot create a task for an order outside their branch
    if (currentUser.role === 'branch_manager' &&order.branch_id.toString() !== currentUserbranch_id) {
     throw new ApiError(403,'You can only create tasks for orders in your branch');
    }

    const task = await Task.create({
        employee_id,
        order_id,
        stage,
        status: 'pending',
    });

    // Synchronize order status after task creation
    await syncOrderStatusFromTasks(order_id);

    await task.populate('employee_id');
    await task.populate('order_id');

    return apiResponse(res, 201, task, 'Task created successfully');
});


// GET /tasks
// Employees see their own tasks.
// Branch managers see tasks for their branch.
// Admins see all tasks.
export const getEmployeeTasks = asyncHandler(async (req, res) => {
    const currentUser = req.user;
    let query = {};

    if (currentUser.role === 'employee') {
        const employee = await Employee.findOne({ user_id: currentUser.id, });

        if (!employee) {
            throw new ApiError(404, 'Employee record not found');
        }

        query.employee_id = employee._id;
    }

    else if (currentUser.role === 'branch_manager') {
        const employees = await Employee.find({ branch_id: currentUser.branch_id, }).select('_id');

        const employeeIds = employees.map(employee => employee._id);

        query.employee_id = { $in: employeeIds };
    }

    else if (currentUser.role !== 'admin') {
        throw new ApiError(403, 'You do not have permission to view tasks');
    }

    const tasks = await Task.find(query)
        .populate('employee_id')
        .populate('order_id')
        .sort({ createdAt: -1 });

    return apiResponse(res, 200, tasks, 'Tasks retrieved successfully');
});


// GET /tasks/:id
export const getTaskById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;

    const task = await Task.findById(id)
        .populate('employee_id')
        .populate('order_id');

    if (!task) {
        throw new ApiError(404, 'Task not found');
    }

    // Employee can only view their own task
    if (currentUser.role === 'employee') {
        const employee = await Employee.findOne({ user_id: currentUser.id, });

        if (!employee || task.employee_id._id.toString() !== employee._id.toString())
        { throw new ApiError(403,'You can only view your own tasks');}
    }

    // Branch manager can only view branch tasks
    else if (currentUser.role === 'branch_manager') {
        if (task.order_id.branch_id.toString() !== currentUser.branch_id) {
            throw new ApiError(403,'You can only view tasks for your branch');
        }
    }

    else if (currentUser.role !== 'admin') {
        throw new ApiError(403,'You do not have permission to view this task');
    }

    return apiResponse(res,200, task,'Task retrieved successfully');
});


// PATCH /tasks/:id/status
export const updateTaskStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const currentUser = req.user;

    const allowedStatuses = ['pending','in_progress','completed', 'on_hold'];

    if (status !== undefined && !allowedStatuses.includes(status)) {
        throw new ApiError(400, `Invalid task status. Allowed statuses: ${allowedStatuses.join(', ')}`);
    }

    const task = await Task.findById(id);

    if (!task) {throw new ApiError(404, 'Task not found');}

    // Employee authorization
    if (currentUser.role === 'employee') {
        const employee = await Employee.findOne({user_id: currentUser.id,});

        if (!employee ||task.employee_id.toString() !== employee._id.toString()) {
            throw new ApiError(403,'You can only update your own tasks');
        }
    }

    // Branch manager authorization
    else if (currentUser.role === 'branch_manager') {
        const employee = await Employee.findById(task.employee_id);

        if (!employee) {throw new ApiError(404,'Assigned employee not found');}

        if (employee.branch_id.toString() !==currentUser.branch_id) {
            throw new ApiError(403,'You can only update tasks for your branch');
        }
    }

    // Only admin, manager and employee should reach here
    else if (currentUser.role !== 'admin') {
        throw new ApiError(403,'You do not have permission to update tasks');
    }

    // Update status
    if (status !== undefined) {
        task.status = status;

        if (status === 'completed') {task.completed_at = new Date();}

        else {task.completed_at = undefined;}
    }

    // Update notes
    if (notes !== undefined) {
        task.notes = notes;
    }

    await task.save();

    // IMPORTANT:
    // Keep order.status synchronized with task progress.
    await syncOrderStatusFromTasks(task.order_id);

    await task.populate('employee_id');
    await task.populate('order_id');

    return apiResponse(res,200,task,'Task updated successfully');
});