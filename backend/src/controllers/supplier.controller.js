// Owner: Series
// Purpose: supplier reference CRUD.
// Suppliers are shared company records and are not branch-scoped.

import asyncHandler from '../utils/asyncHandler.js';
import Supplier from '../models/supplier.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';


/**
 * POST /suppliers
 * Create a supplier.
 */
export const createSupplier = asyncHandler(async (req, res) => {
    const { name, contact, items_supplied } = req.body;

    if (!name || !contact || !items_supplied) {
        throw new ApiError(400, 'name, contact, and items_supplied are required');
    }

    let contactObj;
    if (typeof contact === 'string') {
        if (!contact.trim()) {
            throw new ApiError(400, 'Supplier contact phone cannot be empty');
        }
        contactObj = { phone: contact.trim() };
    } else if (typeof contact === 'object' && contact !== null) {
        if (!contact.phone || !contact.phone.trim()) {
            throw new ApiError(400, 'Supplier contact phone is required');
        }
        contactObj = {
            phone: contact.phone.trim(),
            email: contact.email?.trim() || undefined,
            address: contact.address?.trim() || undefined,
        };
    } else {
        throw new ApiError(400, 'Invalid contact format');
    }

    const existingSupplier = await Supplier.findOne({ name: name.trim() });

    if (existingSupplier) {
        throw new ApiError(409, 'A supplier with this name already exists');
    }

    const supplier = await Supplier.create({
        name: name.trim(),
        contact: contactObj,
        items_supplied: Array.isArray(items_supplied) ? items_supplied : [items_supplied],
    });

    return apiResponse(res, 201, supplier, 'Supplier created successfully');
});


/**
 * GET /suppliers
 * Get suppliers with pagination, filtering, and search.
 */
export const getSuppliers = asyncHandler(async (req, res) => {
    let { page = 1, limit = 20, is_active, q } = req.query;

    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};

    if (typeof is_active !== 'undefined') {
        if (is_active !== 'true' && is_active !== 'false') {
            throw new ApiError(400, 'is_active must be true or false');
        }

        filter.is_active = is_active === 'true';
    }

    if (q?.trim()) {
        const search = q.trim();

        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { 'contact.phone': { $regex: search, $options: 'i' } },
            { 'contact.email': { $regex: search, $options: 'i' } },
            { 'contact.address': { $regex: search, $options: 'i' } },
            { items_supplied: { $regex: search, $options: 'i' } },
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


/**
 * GET /suppliers/:id
 * Get one supplier.
 */
export const getSupplierById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
        throw new ApiError(404, 'Supplier not found');
    }

    return apiResponse(res, 200, supplier, 'Supplier retrieved successfully');
});


/**
 * PATCH /suppliers/:id
 * Update supplier information.
 */
export const updateSupplier = asyncHandler(async (req, res) => {
    const { name, contact, items_supplied, is_active } = req.body;

    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
        throw new ApiError(404, 'Supplier not found');
    }

    const updates = {};

    if (name !== undefined) {
        if (!name.trim()) {
            throw new ApiError(400, 'Supplier name cannot be empty');
        }
        updates.name = name.trim();
    }

    if (contact !== undefined) {
        if (typeof contact === 'string') {
            if (!contact.trim()) {
                throw new ApiError(400, 'Supplier contact phone cannot be empty');
            }
            updates.contact = {
                ...supplier.contact.toObject(),
                phone: contact.trim(),
            };
        } else if (typeof contact === 'object' && contact !== null) {
            updates.contact = {
                phone: contact.phone ? contact.phone.trim() : supplier.contact.phone,
                email: contact.email !== undefined ? contact.email?.trim() : supplier.contact.email,
                address: contact.address !== undefined ? contact.address?.trim() : supplier.contact.address,
            };
        }
    }

    if (items_supplied !== undefined) {
        if (!items_supplied) {
            throw new ApiError(400, 'items_supplied cannot be empty');
        }
        updates.items_supplied = Array.isArray(items_supplied) ? items_supplied : [items_supplied];
    }

    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            throw new ApiError(400, 'is_active must be a boolean');
        }
        updates.is_active = is_active;
    }

    if (updates.name) {
        const duplicate = await Supplier.findOne({ name: updates.name, _id: { $ne: req.params.id } });
        if (duplicate) {
            throw new ApiError(409, 'A supplier with this name already exists');
        }
    }

    Object.assign(supplier, updates);
    await supplier.save();

    return apiResponse(res, 200, supplier, 'Supplier updated successfully');
});


/**
 * DELETE /suppliers/:id
 * Soft delete / deactivate a supplier to preserve inventory ledger history.
 */
export const deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
        throw new ApiError(404, 'Supplier not found');
    }

    supplier.is_active = false;
    await supplier.save();

    return apiResponse(res, 200, null, 'Supplier deactivated successfully');
});