// Owner: Josh
// Purpose: service catalog CRUD with branch-scoping and cache management.

import Service from '../models/service.model.js';
import Branch from '../models/branch.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache, deleteCached } from '../services/cache.service.js';


// GET /services
// Public service listing.
// Only active services are shown. Optional ?branch_id= filters to one branch.
export const getAllServices = asyncHandler(async (req, res) => {
    const { branch_id } = req.query;
    const filter = { is_active: true };
    if (branch_id) {
        filter.branch_id = branch_id;
    }

    // Get services from cache base on branchId or get all
    const cacheKey = branch_id ? `services:branch:${branch_id}` : 'services:all';
    const services = await withCache(cacheKey, async () => {
        return await Service.find(filter)
            .select('branch_id name type category price turnaround_hours is_active')
            .sort({ name: 1 });
    });

    return apiResponse(res, 200, services, 'Service list fetched successfully');
});


// GET /services/:id
export const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id).select(
        'branch_id name type category price turnaround_hours is_active');

    if (!service) {
        throw new ApiError(404, 'Service not found');
    }

    return apiResponse(res, 200, service, 'Service detail retrieved successfully');
});


// POST /services
// Admin can create for any branch.
// Branch manager can create only for their own branch.
export const createService = asyncHandler(async (req, res) => {
    const { branch_id, name, category, price, type = 'service', turnaround_hours, } = req.body;

    const currentUser = req.user;

    // Permission check
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'Only admins and branch managers can create services');
    }

    // Required fields
    if (!branch_id || !name || price === undefined) {
        throw new ApiError(400, 'branch_id, name and price are required');
    }

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'Service name must be a valid non-empty string');
    }

    const trimmedName = name.trim();

    // Validate type
    if (!['service', 'add-on'].includes(type)) {
        throw new ApiError(400, 'Type must be either service or add-on');
    }

    // Validate price
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        throw new ApiError(400, 'Price must be a valid non-negative number');
    }

    // Regular services require turnaround time.
    if (type === 'service') {
        if (typeof turnaround_hours !== 'number' || !Number.isFinite(turnaround_hours) || turnaround_hours < 1) {
            throw new ApiError(400, 'Turnaround hours are required for regular services');
        }
    }

    // Determine branch.
    let serviceBranchId = branch_id;

    if (currentUser.role === 'branch_manager') {
        if (!currentUser.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }

        serviceBranchId = currentUser.branch_id;
    }

    // Verify branch exists.
    const branch = await Branch.findById(serviceBranchId);

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Prevent duplicate service names within branch.
    const existing = await Service.findOne({
        branch_id: serviceBranchId,
        name: trimmedName,
    });

    if (existing) {
        throw new ApiError(409, 'A service with this name already exists at this branch');
    }

    const service = await Service.create({
        branch_id: serviceBranchId,
        name: trimmedName,
        type,
        category: category?.trim() || 'general',
        price,
        turnaround_hours: type === 'service' ? turnaround_hours : undefined,
        is_active: true,
    });

    await deleteCached('services:all');

    return apiResponse(res, 201, service, 'Service created successfully');
});


// PATCH /services/:id
export const updateService = asyncHandler(async (req, res) => {
    const { name, category, price, type, turnaround_hours, is_active, } = req.body;

    const currentUser = req.user;

    // Permission check
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to update services');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError(404, 'Service not found');
    }

    // Branch manager can only update services in their branch.
    if (currentUser.role === 'branch_manager' &&
        service.branch_id.toString() !== currentUser.branch_id.toString()
    ) {
        throw new ApiError(403, 'You can only update services in your branch');
    }

    // branch_id is intentionally not accepted here.
    // Services cannot be moved between branches.

    const updatedType = type ?? service.type;

    // Validate type.
    if (!['service', 'add-on'].includes(updatedType)) {
        throw new ApiError(400, 'Type must be either service or add-on');
    }

    // Validate name.
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new ApiError(400, 'Service name must be a valid non-empty string');
        }

        const trimmedName = name.trim();

        const duplicate = await Service.findOne({
            branch_id: service.branch_id,
            name: trimmedName,
            _id: { $ne: service._id },
        });

        if (duplicate) {
            throw new ApiError(409, 'A service with this name already exists at this branch');
        }

        service.name = trimmedName;
    }

    // Validate category.
    if (category !== undefined) {
        if (typeof category !== 'string' || !category.trim()) {
            throw new ApiError(400, 'Category must be a valid non-empty string');
        }

        service.category = category.trim();
    }

    // Validate price.
    if (price !== undefined) {
        if (currentUser.role !== 'admin') {
            throw new ApiError(403, 'Only admins can edit service pricing');
        }

        if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
            throw new ApiError(400, 'Price must be a valid non-negative number');
        }

        service.price = price;
    }

    // Validate turnaround.
    if (updatedType === 'service') {
        const finalTurnaround = turnaround_hours !== undefined ? turnaround_hours : service.turnaround_hours;

        if (typeof finalTurnaround !== 'number' || !Number.isFinite(finalTurnaround) || finalTurnaround < 1) {
            throw new ApiError(400, 'Turnaround hours are required for regular services');
        }

        service.turnaround_hours = finalTurnaround;
    } else {
        // Add-ons don't require turnaround time.
        service.turnaround_hours = undefined;
    }

    service.type = updatedType;

    // Allow activation/deactivation.
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            throw new ApiError(400, 'is_active must be a boolean');
        }

        service.is_active = is_active;
    }

    await service.save();

    await deleteCached('services:all');

    return apiResponse(res, 200, service, 'Service updated successfully');
});


// DELETE /services/:id
// Soft-delete by deactivating the service. This preserves historical order data.
export const removeService = asyncHandler(async (req, res) => {
    const currentUser = req.user;

    // Permission check.
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to delete services');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError(404, 'Service not found');
    }

    // Branch manager can only deactivate services in their branch.
    if (currentUser.role === 'branch_manager' &&
        service.branch_id.toString() !== currentUser.branch_id.toString()
    ) {
        throw new ApiError(403, 'You can only delete services in your branch');
    }

    // Do not physically delete services because existing orders may reference them.
    service.is_active = false;

    await service.save();

    await deleteCached('services:all');

    return apiResponse(res, 200, null, 'Service deactivated successfully');
});