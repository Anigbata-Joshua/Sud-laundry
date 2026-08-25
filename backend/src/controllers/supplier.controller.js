// Owner: Series
// Purpose: simple CRUD for supplier reference records.

import asyncHandler from '../utils/asyncHandler.js';
import Supplier from '../models/supplier.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';

export const createSupplier = asyncHandler(async (req, res) => {
    const { name, contact, items_supplied } = req.body;
    if (!name || !contact || !items_supplied) {
        throw new ApiError(400, 'Please provide all required fields: name, contact, items_supplied');
    }
    const supplier = await Supplier.create({
        name,
        contact,
        items_supplied,
    });
    return apiResponse(res, 201, supplier, 'Supplier created successfully');
});

export const getSuppliers = asyncHandler(async (req, res) => {
    // pagination and query support
    let { page = 1, limit = 20, is_active, q } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;

    const filter = {};
    if (typeof is_active !== 'undefined') filter.is_active = is_active === 'true';
    if (q) {
        filter.$or = [
            { name: { $regex: q, $options: 'i' } },
            { contact: { $regex: q, $options: 'i' } },
            { items_supplied: { $regex: q, $options: 'i' } },
        ];
    }

    const total = await Supplier.countDocuments(filter);
    const suppliers = await Supplier.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
    return apiResponse(res, 200, { items: suppliers, meta }, 'Suppliers retrieved successfully');
});

export const getSupplierById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
             throw new ApiError(404, 'Supplier not found');
    }
    return apiResponse(res, 200, supplier, 'Supplier retrieved successfully');
});

export const updateSupplier = asyncHandler(async (req, res) => {
    const { name, contact, items_supplied, is_active } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
             throw new ApiError(404, 'Supplier not found');
    }
    const updatedSupplier = await Supplier.findByIdAndUpdate(
        req.params.id,
        { name, contact, items_supplied, is_active },
        { new: true }
    );
    return apiResponse(res, 200, updatedSupplier, 'Supplier updated successfully')
});

export const deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
             throw new ApiError(404, 'Supplier not found');
    }

    await Supplier.findByIdAndDelete(req.params.id);

    return apiResponse(res, 200, null, 'Supplier deleted successfully');
});
