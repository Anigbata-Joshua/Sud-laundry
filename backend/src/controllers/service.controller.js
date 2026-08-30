// Owner: Josh
// Purpose: public service browsing, admin/branch-manager pricing edits.

import Service from '../models/service.model.js';
import Branch from '../models/branch.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache, deleteCached, } from '../services/cache.service.js';


// GET /services
// Public service listing
export const getAllServices = asyncHandler(async (req, res) => {
    const services = await withCache('services:all', async () => {
        return await Service.find().select('branch_id name category price turnaround_hours').sort({ name: 1 });
    });

    return apiResponse(res, 200, services, 'Service list fetched successfully');
});


// GET /services/:id
export const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id).select('branch_id name category price turnaround_hours');

    if (!service) {
        throw new ApiError(404, 'No service found');
    }

    return apiResponse(res, 200, service, 'Service detail retrieved successfully');
});


// POST /services
// Admin can create for any branch.
// Branch manager can create only for own branch.
export const createService = asyncHandler(async (req, res) => {
    const { branch_id, name, category, price, type = 'service', turnaround_hours } = req.body;

    const currentUser = req.user;

    // Only admin and branch manager can create services
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'Only admins and branch managers can create services');
    }

    // Required fields
    if (!branch_id || !name || price === undefined) {
        throw new ApiError(400, 'branch_id, name and price are required');
    }

    // Validate type
    if (!['service', 'add-on'].includes(type)) {
        throw new ApiError(400, 'Type must be either service or add-on');
    }
    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'Service name must be a valid non-empty string');
    }

    // Validate price
    if (typeof price !== 'number' || price < 0) {
        throw new ApiError(400, 'Price must be a valid non-negative number');
    }

    // Regular services MUST have a turnaround time.
    // Add-ons do not need their own turnaround time.
    if (type === 'service') {
        if (turnaround_hours === undefined || typeof turnaround_hours !== 'number' || turnaround_hours < 1) {
            throw new ApiError(400, 'Turnaround hours are required for regular services');
        }
    }

    // Branch manager is forced to own branch but admin can create for any branch
    let serviceBranchId = branch_id;

    if (currentUser.role === 'branch_manager') {
        if (!currentUser.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }
        serviceBranchId = currentUser.branch_id;
    }

    // Verify branch exists
    const branch = await Branch.findById(serviceBranchId);

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Prevent duplicate service names at same branch
    const existing = await Service.findOne({ branch_id: serviceBranchId, name: name.trim(), });

    if (existing) {
        throw new ApiError(409, 'A service with this name already exists at this branch');
    }

    const service = await Service.create({
        branch_id: serviceBranchId,
        name: name.trim(),
        type,
        category: category?.trim() || 'general',
        price,
        turnaround_hours: type === 'service' ? turnaround_hours : undefined,
    });

    await deleteCached('services:all');

    return apiResponse(res, 201, service, 'Service created successfully');
});


// PATCH /services/:id
export const updateService = asyncHandler(async (req, res) => {
    const { name, category, price, type, turnaround_hours, } = req.body;

    const currentUser = req.user;

    // Permission check
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError( 403,'You do not have permission to update services');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError(404, 'Service not found');
    }

    // Branch manager can only update services in their own branch
    if (currentUser.role === 'branch_manager' && service.branch_id.toString() !== currentUser.branch_id.toString()) {
        throw new ApiError( 403,'You can only update services in your branch');
    }

    // Determine the type after the update
    const updatedType = type ?? service.type;

    // Validate type
    if (!['service', 'add-on'].includes(updatedType)) {
        throw new ApiError(  400,'Type must be either service or add-on');
    }

    // Validate name
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new ApiError( 400,'Service name must be a valid non-empty string');
        }

        const trimmedName = name.trim();

        // Prevent duplicate names within the same branch
        const existing = await Service.findOne({
            branch_id: service.branch_id,
            name: trimmedName,
            _id: { $ne: service._id },
        });

        if (existing) {
            throw new ApiError(409,'A service with this name already exists at this branch');
        }

        service.name = trimmedName;
    }

    // Validate category
    if (category !== undefined) {
        if (typeof category !== 'string' || !category.trim()) {
            throw new ApiError(  400,'Category must be a valid non-empty string');
        }

        service.category = category.trim();
    }

    // Validate price
    if (price !== undefined) {
        if (typeof price !== 'number' || price < 0) {
            throw new ApiError(  400,'Price must be a valid non-negative number');
        }

        service.price = price;
    }

    // Validate turnaround based on the resulting type
    if (updatedType === 'service') {
        const finalTurnaround = turnaround_hours !== undefined ? turnaround_hours : service.turnaround_hours;

        if (typeof finalTurnaround !== 'number' || finalTurnaround < 1) {
            throw new ApiError(  400,'Turnaround hours are required for regular services');
        }

        service.turnaround_hours = finalTurnaround;
    } else {
        service.turnaround_hours = undefined; // Add-ons do not have a turnaround time
    }

    service.type = updatedType; // Save the new type

    await service.save();

    // Invalidate service cache
    await deleteCached('services:all');

    return apiResponse(res, 200, service, 'Service updated successfully');
});


// DELETE /services/:id
export const removeService = asyncHandler(async (req, res) => {
    const currentUser = req.user;


    // Permission check
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'You do not have permission to delete services');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError(404, 'Service not found');
    }

    if (currentUser.role === 'branch_manager' && service.branch_id.toString() !== currentUser.branch_id) {
        throw new ApiError(403, 'You can only delete services in your branch');
    }

    await service.deleteOne();

    // Cache invalidation
    await deleteCached('services:all');

    return apiResponse(res, 200, null, 'Service deleted successfully');
});