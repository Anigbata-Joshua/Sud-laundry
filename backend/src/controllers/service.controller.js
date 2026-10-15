// Owner: Josh
// Purpose: service catalog CRUD with branch-scoping and cache management.

import Service from '../models/service.model.js';
import mongoose from 'mongoose';
import ServiceCategory from '../models/serviceCategory.model.js';
import { textQuery, literalSearch } from '../utils/listQuery.js';
import Branch from '../models/branch.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { deleteCached } from '../services/cache.service.js';

async function resolveCategory({ category_id, category, branch_id }) {
    if (category_id !== undefined) {
        if (typeof category_id !== 'string' || !mongoose.isObjectIdOrHexString(category_id)) throw new ApiError(400, 'Invalid category_id');
        const record = await ServiceCategory.findOne({ _id: category_id, branch_id, is_active: true });
        if (!record) throw new ApiError(400, 'Choose an active category from this branch');
        return { category_id: record._id, category: record.name };
    }
    // Legacy clients can continue sending category names; these become reusable records.
    const name = category === undefined ? 'general' : category;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new ApiError(400, 'Category must contain 1 to 100 characters');
    const key = name.trim().toLowerCase();
    const record = await ServiceCategory.findOneAndUpdate(
        { branch_id, name_key: key },
        { $setOnInsert: { branch_id, name: name.trim(), name_key: key } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (!record.is_active) throw new ApiError(400, 'This category is inactive');
    return { category_id: record._id, category: record.name };
}

async function invalidateServices(branchId) {
    await Promise.all([deleteCached('services:all'), deleteCached(`services:branch:${branchId}`)]);
}


// GET /services
// Public service listing.
// Only active services are shown. Optional ?branch_id= filters to one branch.
export const getAllServices = asyncHandler(async (req, res) => {
    const { branch_id, category_id, type } = req.query;
    const filter = { is_active: true };
    if (branch_id) {
        if (typeof branch_id !== 'string' || !mongoose.isObjectIdOrHexString(branch_id)) throw new ApiError(400, 'Invalid branch_id');
        filter.branch_id = branch_id;
    }
    if (category_id !== undefined) {
        if (typeof category_id !== 'string' || !mongoose.isObjectIdOrHexString(category_id)) throw new ApiError(400, 'Invalid category_id');
        filter.category_id = category_id;
    }
    if (type !== undefined) {
        if (!['service', 'add-on'].includes(type)) throw new ApiError(400, 'Invalid service type');
        filter.type = type;
    }
    const category = textQuery(req.query.category, 'category');
    if (category) filter.category = category;
    const search = textQuery(req.query.q, 'q');
    if (search) filter.name = literalSearch(search);

    const fetchServices = async () => {
        return await Service.find(filter)
            .select('branch_id name type category category_id price turnaround_hours is_active')
            .populate('category_id', 'name description is_active')
            .sort({ name: 1 });
    };
    // Category names can change independently of services, so return populated data live.
    const services = await fetchServices();

    return apiResponse(res, 200, services, 'Service list fetched successfully');
});


// GET /services/:id
export const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id).select(
        'branch_id name type category category_id price turnaround_hours is_active').populate('category_id', 'name description is_active');

    if (!service) {
        throw new ApiError(404, 'Service not found');
    }

    return apiResponse(res, 200, service, 'Service detail retrieved successfully');
});


// POST /services
// Admin can create for any branch.
// Branch manager can create only for their own branch.
export const createService = asyncHandler(async (req, res) => {
    const { branch_id, name, category, category_id, price, type = 'service', turnaround_hours, } = req.body;

    const currentUser = req.user;

    // Permission check
    if (!['admin', 'branch_manager'].includes(currentUser.role)) {
        throw new ApiError(403, 'Only admins and branch managers can create services');
    }

    // Required fields
    if ((!branch_id && currentUser.role === 'admin') || !name) {
        throw new ApiError(400, 'branch_id and name are required');
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

    // Validate price if provided (optional/legacy)
    if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
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
        if (branch_id && String(branch_id) !== String(serviceBranchId)) throw new ApiError(403, 'You can only create services in your branch');
    }

    if (!mongoose.isObjectIdOrHexString(serviceBranchId)) throw new ApiError(400, 'Invalid branch_id');

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

    const categoryFields = await resolveCategory({ category_id, category, branch_id: serviceBranchId });
    const service = await Service.create({
        branch_id: serviceBranchId,
        name: trimmedName,
        type,
        ...categoryFields,
        price,
        turnaround_hours: type === 'service' ? turnaround_hours : undefined,
        is_active: true,
    });

    await invalidateServices(service.branch_id);

    return apiResponse(res, 201, service, 'Service created successfully');
});


// PATCH /services/:id
export const updateService = asyncHandler(async (req, res) => {
    const { name, category, category_id, price, type, turnaround_hours, is_active, } = req.body;

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
        service.branch_id.toString() !== String(currentUser.branch_id)
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

    if (category !== undefined || category_id !== undefined) {
        Object.assign(service, await resolveCategory({ category_id, category, branch_id: service.branch_id }));
    }
    await service.save();

    await invalidateServices(service.branch_id);

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
        service.branch_id.toString() !== String(currentUser.branch_id)
    ) {
        throw new ApiError(403, 'You can only delete services in your branch');
    }

    // Do not physically delete services because existing orders may reference them.
    service.is_active = false;

    await service.save();

    await invalidateServices(service.branch_id);

    return apiResponse(res, 200, null, 'Service deactivated successfully');
});
