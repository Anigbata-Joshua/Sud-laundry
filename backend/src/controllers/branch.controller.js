// Owner: Josh
// Purpose:
// Branch management.

// - Branch listing is publicly readable.
// - Branch creation is admin-only through route authorization.
// - Admin can update/delete branches.
// - Branch managers can update only their assigned branch.
// - A branch cannot be deleted while it has employees or orders.
// - Branch listing uses caching.

import Branch from '../models/branch.model.js';
import Order from '../models/order.model.js';
import Employee from '../models/employee.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache, deleteCached } from '../services/cache.service.js';

// GET /branches
// Public branch listing.
// Only expose fields required by the frontend/public API.
export const getAllBranches = asyncHandler(async (req, res) => {
    const branches = await withCache('branches:all', async () => {
        return await Branch.find().select('name address phone').sort({ name: 1 });
    });
    apiResponse(res, 200, branches, 'Branches retrieved successfully');
});

// GET /branches/:id
export const getBranchById = asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id).select('name address phone');
    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }
    apiResponse(res, 200, branch, 'Branch fetched successfully');
});

// POST /branches
// Route should be protected by admin authorization.
export const createBranch = asyncHandler(async (req, res) => {
    const { name, address, phone } = req.body;
    
    const existingBranch = await Branch.findOne({ name });
    if (existingBranch) {
        throw new ApiError(409, 'A branch with this name already exists');
    }
    const branch = await Branch.create({ name, address, phone, });

    await deleteCached('branches:all');

    apiResponse(res, 201, branch, 'Branch created successfully');
});

// PUT /branches/:id
// Admin can update any branch.
// Branch manager can only update their own branch.
export const updateBranch = asyncHandler(async (req, res) => {
    const {
        name,
        address,
        phone,
    } = req.body;

    if (req.user.role === 'branch_manager' && req.user.branch_id.toString() !== req.params.id.toString()) {
        throw new ApiError(403, 'Cannot update a branch you are not assigned to');
    }

    const updates = {};

    if (name !== undefined) {
        updates.name = name;
    }

    if (address !== undefined) {
        updates.address = address;
    }

    if (phone !== undefined) {
        updates.phone = phone;
    }

    // If changing the branch name, prevent duplicates.
    if (name !== undefined) {
        const existingBranch = await Branch.findOne({ name, _id: { $ne: req.params.id } });
        if (existingBranch) {
            throw new ApiError(409, 'A branch with this name already exists');
        }
    }

    const branch = await Branch.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Branch data has changed.
    await deleteCached('branches:all');

    apiResponse(res, 200, branch, 'Branch updated successfully');
});

// DELETE /branches/:id
// A branch cannot be deleted if it has employees or orders.
export const deleteBranch = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent deletion if employees are still assigned.
    const employeeCount = await Employee.countDocuments({
        branch_id: id,
    });

    if (employeeCount > 0) {
        throw new ApiError(409, 'Cannot delete branch with active registered employees');
    }

    // Prevent deletion if historical orders exist.
    const orderCount = await Order.countDocuments({ branch_id: id });

    if (orderCount > 0) {
        throw new ApiError(409, 'Cannot delete branch with active order records');
    }

    const branch = await Branch.findByIdAndDelete(id);

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Branch list has changed.
    await deleteCached('branches:all');

    apiResponse(res, 200, branch, 'Branch deleted successfully');
});