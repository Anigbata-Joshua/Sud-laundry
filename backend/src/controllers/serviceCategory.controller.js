import mongoose from 'mongoose';
import ServiceCategory from '../models/serviceCategory.model.js';
import Branch from '../models/branch.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { textQuery, literalSearch } from '../utils/listQuery.js';

function validId(value, field) {
    if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) {
        throw new ApiError(400, `Invalid ${field}`);
    }
    return value;
}

function assertManager(user, branchId) {
    if (!['admin', 'branch_manager'].includes(user.role)) throw new ApiError(403, 'Only admins and branch managers can manage categories');
    if (user.role !== 'admin' && String(user.branch_id) !== String(branchId)) {
        throw new ApiError(403, 'You can only manage categories in your branch');
    }
}

function categoryFields(body, creating = false) {
    const fields = {};
    if (creating || body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
            throw new ApiError(400, 'name must contain 1 to 100 characters');
        }
        fields.name = body.name.trim();
        fields.name_key = fields.name.toLowerCase();
    }
    if (body.description !== undefined) {
        if (typeof body.description !== 'string' || body.description.length > 1000) throw new ApiError(400, 'description must be a string of at most 1000 characters');
        fields.description = body.description.trim();
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== 'boolean') throw new ApiError(400, 'is_active must be a boolean');
        fields.is_active = body.is_active;
    }
    return fields;
}

export const listCategories = asyncHandler(async (req, res) => {
    const filter = { is_active: true };
    if (req.query.branch_id !== undefined) filter.branch_id = validId(req.query.branch_id, 'branch_id');
    const search = textQuery(req.query.q, 'q');
    if (search) filter.name = literalSearch(search);
    const categories = await ServiceCategory.find(filter).select('-name_key').sort({ name: 1, _id: 1 });
    return apiResponse(res, 200, categories, 'Service categories retrieved');
});

export const createCategory = asyncHandler(async (req, res) => {
    const branchId = req.user.role === 'branch_manager' ? req.user.branch_id : req.body.branch_id;
    validId(branchId, 'branch_id');
    assertManager(req.user, branchId);
    if (req.user.role !== 'admin' && req.body.branch_id && String(req.body.branch_id) !== String(branchId)) {
        throw new ApiError(403, 'You can only manage categories in your branch');
    }
    const fields = categoryFields(req.body, true);
    if (!await Branch.exists({ _id: branchId })) throw new ApiError(404, 'Branch not found');
    if (await ServiceCategory.exists({ branch_id: branchId, name_key: fields.name_key })) throw new ApiError(409, 'Category already exists in this branch');
    const category = await ServiceCategory.create({ ...fields, branch_id: branchId });
    return apiResponse(res, 201, category, 'Service category created');
});

export const updateCategory = asyncHandler(async (req, res) => {
    validId(req.params.id, 'category ID');
    const category = await ServiceCategory.findById(req.params.id);
    if (!category) throw new ApiError(404, 'Category not found');
    assertManager(req.user, category.branch_id);
    if (req.body.branch_id !== undefined && String(req.body.branch_id) !== String(category.branch_id)) throw new ApiError(400, 'Categories cannot be moved between branches');
    const fields = categoryFields(req.body);
    if (fields.name_key && await ServiceCategory.exists({ branch_id: category.branch_id, name_key: fields.name_key, _id: { $ne: category._id } })) {
        throw new ApiError(409, 'Category already exists in this branch');
    }
    Object.assign(category, fields);
    await category.save();
    return apiResponse(res, 200, category, 'Service category updated');
});

export const deactivateCategory = asyncHandler(async (req, res) => {
    validId(req.params.id, 'category ID');
    const category = await ServiceCategory.findById(req.params.id);
    if (!category) throw new ApiError(404, 'Category not found');
    assertManager(req.user, category.branch_id);
    category.is_active = false;
    await category.save();
    return apiResponse(res, 200, null, 'Service category deactivated');
});
