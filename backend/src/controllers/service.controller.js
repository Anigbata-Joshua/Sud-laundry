// Owner: Josh
// Purpose: public service browsing, admin/branch-manager pricing edits.

import Service from '../models/service.model.js';
import Branch from '../models/branch.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache,deleteCached,} from '../services/cache.service.js';


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
        throw new ApiError(404,'No service found');
    }

    return apiResponse(res,200,service,'Service detail retrieved successfully');
});


// POST /services
// Admin can create for any branch.
// Branch manager can create only for own branch.
export const createService = asyncHandler(async (req, res) => {
    const { branch_id,name,category,price,turnaround_hours,} = req.body;

    const currentUser = req.user;

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403,'Only admins and branch managers can create services');
    }

    if (!branch_id || !name || price === undefined) {
        throw new ApiError(400,'branch_id, name, and price are required');
    }

    if (typeof price !== 'number' || price < 0) {
        throw new ApiError(400,'Price must be a valid non-negative number');
    }

    // Branch manager is forced to own branch
    let serviceBranchId = branch_id;

    if (currentUser.role === 'branch_manager') {
        serviceBranchId = currentUser.branch_id;
    }

    // Verify branch exists
    const branch = await Branch.findById(serviceBranchId);

    if (!branch) {
        throw new ApiError(404,'Branch not found');
    }

    // Prevent duplicate service names at same branch
    const existing = await Service.findOne({ branch_id: serviceBranchId,name: name.trim(), });

    if (existing) {
        throw new ApiError(409,'A service with this name already exists at this branch');
    }

    const service = await Service.create({ branch_id: serviceBranchId,name: name.trim(),category,price,turnaround_hours, });

    await deleteCached('services:all');

    return apiResponse(res,201,service,'Service created successfully');
});


// PATCH /services/:id
export const updateService = asyncHandler(async (req, res) => {
    const { name,category,price,turnaround_hours, } = req.body;

    const currentUser = req.user;

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403,'You do not have permission to update services');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError(404,'Service not found');
    }

    // Branch manager can only update own branch service
    if (currentUser.role === 'branch_manager' && service.branch_id.toString() !== currentUser.branch_id) {
        throw new ApiError(403,'You can only update services in your branch');
    }

    // Validate price
    if (price !== undefined &&(typeof price !== 'number' || price < 0)) {
        throw new ApiError(400,'Price must be a valid non-negative number');
    }

    // Prevent duplicate names
    if (name !== undefined) {
        const existing = await Service.findOne({ branch_id: service.branch_id, name: name.trim(), _id: { $ne: service._id } });

        if (existing) {
            throw new ApiError(409,'A service with this name already exists at this branch');
        }

        service.name = name.trim();
    }

    if (category !== undefined) {
        service.category = category;
    }

    if (price !== undefined) {
        service.price = price;
    }

    if (turnaround_hours !== undefined) {
        service.turnaround_hours = turnaround_hours;
    }

    await service.save();

    await deleteCached('services:all');

    return apiResponse(res,200,service,'Service updated successfully');
});


// DELETE /services/:id
export const removeService = asyncHandler(async (req, res) => {
    const currentUser = req.user;

    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403,'You do not have permission to delete services');
    }

    const service = await Service.findById(req.params.id);

    if (!service) {
        throw new ApiError(404,'Service not found');
    }

    if (currentUser.role === 'branch_manager' && service.branch_id.toString() !== currentUser.branch_id) {
        throw new ApiError(403,'You can only delete services in your branch');
    }

    await service.deleteOne();

    await deleteCached('services:all');

    return apiResponse(res,200,null,'Service deleted successfully');
});