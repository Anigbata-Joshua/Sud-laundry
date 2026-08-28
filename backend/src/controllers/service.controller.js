// Owner: Josh
// Purpose: public service browsing, admin-only pricing edits.
import Service from '../models/service.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache, deleteCached } from '../services/cache.service.js';

export const getAllServices = asyncHandler(async (req, res) => {
    const services = await withCache('services:all', async () => {
        return await Service.find().select('name category price turnaround_hours');
    });
    apiResponse(res, 200, services, 'Service list fetched successfully');
});

export const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id).select(
        'name category price turnaround_hours'
    );
    if (!service) throw new ApiError(404, 'No service found');
    apiResponse(res, 200, service, 'Service detail retrieved successfully');
});

export const createService = asyncHandler(async (req, res) => {
    const { branch_id, name, category, price, turnaround_hours } = req.body;

    if (!branch_id || !name || price === undefined) {
        throw new ApiError(400, 'branch_id, name, and price are required');
    }

    const existing = await Service.findOne({ branch_id, name });
    if (existing) throw new ApiError(409, 'A service with this name already exists at this branch');

    const service = await Service.create({ branch_id, name, category, price, turnaround_hours });
    
    // Invalidate services cache
    await deleteCached('services:all');

    apiResponse(res, 201, service, 'Service created successfully');
});

export const updateService = asyncHandler(async (req, res) => {
    const { branch_id, name, category, price, turnaround_hours } = req.body;

    const updates = {};
    if (branch_id !== undefined) updates.branch_id = branch_id;
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = price;
    if (turnaround_hours !== undefined) updates.turnaround_hours = turnaround_hours;

    const service = await Service.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
    });
    if (!service) throw new ApiError(404, 'Service not found');

    // Invalidate services cache
    await deleteCached('services:all');

    apiResponse(res, 200, service, 'Service updated successfully');
});

export const removeService = asyncHandler(async (req, res) => {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) throw new ApiError(404, 'Service not found');

    // Invalidate services cache
    await deleteCached('services:all');

    apiResponse(res, 200, service, 'Service deleted successfully');
});