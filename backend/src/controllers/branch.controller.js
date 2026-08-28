// Owner: Josh
// Purpose: public branch listing (minimal fields) plus admin-only create/edit.
import Branch from '../models/branch.model.js';
import Order from '../models/order.model.js';
import Employee from '../models/employee.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache, deleteCached } from '../services/cache.service.js';

export const getAllBranches = asyncHandler(async (req, res) => {
    const branches = await withCache('branches:all', async () => {
        return await Branch.find().select('name address phone');
    });
    apiResponse(res, 200, branches, 'Branches retrieved successfully');
});

export const getBranchById = asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id).select('name address phone');
    if (!branch) throw new ApiError(404, 'Branch not found');
    apiResponse(res, 200, branch, 'Branch fetched successfully');
});

// POST /branches — admin only
export const createBranch = asyncHandler(async (req, res) => {
    const { name, address, phone } = req.body;

    if (!name || !address) throw new ApiError(400, 'Name and address are required');

    const existing = await Branch.findOne({ name });
    if (existing) throw new ApiError(409, 'A branch with this name already exists');

    const branch = await Branch.create({ name, address, phone });
    
    // Invalidate branches cache
    await deleteCached('branches:all');

    apiResponse(res, 201, branch, 'Branch created successfully');
});

// PUT /branches/:id — admin or branch_manager (scoped to their own branch)
export const updateBranch = asyncHandler(async (req, res) => {
    const { name, address, phone } = req.body;

    // Branch managers may only update the branch they're assigned to.
    if (req.user.role === 'branch_manager' && req.user.branch_id !== req.params.id) {
        throw new ApiError(403, 'Cannot update a branch you are not assigned to');
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;

    const branch = await Branch.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
    });
    
    if (!branch) throw new ApiError(404, 'Branch not found');

    // Invalidate branches cache
    await deleteCached('branches:all');

    apiResponse(res, 200, branch, 'Branch updated successfully');
});

export const deleteBranch = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Block deletion if this branch has any employees
    const employeeCount = await Employee.countDocuments({ branch_id: id });
    if (employeeCount > 0) {
        throw new ApiError(409, 'Cannot delete branch with active registered employees');
    }

    // Block deletion if this branch has any orders
    const orderCount = await Order.countDocuments({ branch_id: id });
    if (orderCount > 0) {
        throw new ApiError(409, 'Cannot delete branch with active order records');
    }

    const branch = await Branch.findByIdAndDelete(id);
    if (!branch) throw new ApiError(404, 'Branch not found');

    // Invalidate branches cache
    await deleteCached('branches:all');

    apiResponse(res, 200, branch, 'Branch deleted successfully');
});