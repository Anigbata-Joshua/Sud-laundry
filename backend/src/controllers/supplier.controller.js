// Owner: Series
//
// Purpose:
// Supplier reference CRUD.
// Suppliers are shared company records and are not branch-scoped.

import asyncHandler from '../utils/asyncHandler.js';
import Supplier from '../models/supplier.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';


// POST /suppliers
// Create a supplier.
export const createSupplier = asyncHandler(async (req, res) => {
    const {
        name,
        contact,
    } = req.body;

    // Validate name.
    if (typeof name !== 'string' ||!name.trim()) {
        throw new ApiError(400,'Supplier name is required');
    }

    // Validate contact.
    if (!contact || typeof contact !== 'object') {
        throw new ApiError(400,'Supplier contact information is required');
    }

    if (typeof contact.phone !== 'string' ||!contact.phone.trim()) {
        throw new ApiError(400,'Supplier phone number is required');
    }

    // Prevent duplicate supplier names.
    const existingSupplier = await Supplier.findOne({ name: name.trim(),});

    if (existingSupplier) {
        throw new ApiError( 409,'A supplier with this name already exists');
    }

    const supplier = await Supplier.create({
        name: name.trim(),

        contact: {
            phone: contact.phone.trim(),
            email: contact.email?.trim().toLowerCase() || null,
            address: contact.address?.trim() || null,
        },

        is_active: true,
    });

    return apiResponse(res,201,supplier,'Supplier created successfully');
});


// GET /suppliers
//
// Supports:
// ?page=1
// ?limit=20
// ?is_active=true
// ?q=search
export const getSuppliers = asyncHandler(async (req, res) => {
    let { page = 1, limit = 20,is_active, q,} = req.query;

    page = Math.max( parseInt(page, 10) || 1, 1 );

    // Prevent excessively large queries.
    limit = Math.min(
        Math.max(parseInt(limit, 10) || 20, 1),
        100
    );

    const filter = {};

    // Active/inactive filter.
    if (is_active !== undefined) {
        if (is_active !== 'true' && is_active !== 'false') {
            throw new ApiError( 400,'is_active must be true or false');
        }

        filter.is_active = is_active === 'true';
    }

    // Supplier search.
    if (q?.trim()) {
        const search = q.trim();

        filter.$or = [
            {  name: { $regex: search,$options: 'i',},},
            {  'contact.phone': { $regex: search,$options: 'i',},},
            {  'contact.email': { $regex: search,$options: 'i',},},
            {  'contact.address': { $regex: search,$options: 'i',},
            },
        ];
    }

    const total = await Supplier.countDocuments(filter);

    const suppliers = await Supplier.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const meta = { total,page,limit,totalPages: Math.ceil(total / limit),};

    return apiResponse( res,200,{items: suppliers,meta,},'Suppliers retrieved successfully');
});


// GET /suppliers/:id
export const getSupplierById = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(
        req.params.id
    );

    if (!supplier) {
        throw new ApiError(  404,'Supplier not found');
    }

    return apiResponse(  res,200,supplier,'Supplier retrieved successfully');
});


// PATCH /suppliers/:id
export const updateSupplier = asyncHandler(async (req, res) => {
    const { name, contact, is_active,} = req.body;

    const supplier = await Supplier.findById( req.params.id );

    if (!supplier) {
        throw new ApiError( 404,'Supplier not found');
    }

    // Name.
    if (name !== undefined) {
        if ( typeof name !== 'string' ||!name.trim() ) {
            throw new ApiError(  400, 'Supplier name cannot be empty');
        }

        const duplicate = await Supplier.findOne({
            name: name.trim(),
            _id: { $ne: supplier._id },
        });

        if (duplicate) {
            throw new ApiError( 409,'A supplier with this name already exists' );
        }

        supplier.name = name.trim();
    }

    // Contact.
    if (contact !== undefined) {
        if ( !contact ||typeof contact !== 'object' ) {
            throw new ApiError(  400, 'Contact must be a valid object');
        }

        if (contact.phone !== undefined) {
            if (typeof contact.phone !== 'string' || !contact.phone.trim() ) {
                throw new ApiError(  400,'Supplier phone number cannot be empty');
            }

            supplier.contact.phone = contact.phone.trim();
        }

        if (contact.email !== undefined) {
            supplier.contact.email =
                contact.email?.trim().toLowerCase() || null;
        }

        if (contact.address !== undefined) {
            supplier.contact.address =
                contact.address?.trim() || null;
        }
    }

    // Active status.
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            throw new ApiError(  400,'is_active must be a boolean');
        }

        supplier.is_active = is_active;
    }

    await supplier.save();

    return apiResponse(  res,200,supplier,'Supplier updated successfully');
});


// DELETE /suppliers/:id
//
// Soft delete/deactivation preserves historical purchases.
export const deleteSupplier = asyncHandler(async (req, res) => {
    const supplier = await Supplier.findById(
        req.params.id
    );

    if (!supplier) {
        throw new ApiError(  404,'Supplier not found');
    }

    supplier.is_active = false;

    await supplier.save();

    return apiResponse(  res,200,null,'Supplier deactivated successfully'
    );                                                                                                                                                                     
});