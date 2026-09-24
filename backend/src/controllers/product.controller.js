// Owner: Josh
// Purpose:
// Product (inventory) CRUD — branch-scoped.
//
// Rules:
// - Admin can manage products across all branches.
// - Branch managers can manage products in their own branch.
// - Branch managers cannot move products between branches.
// - Employees can only view products belonging to their branch.
// - Product quantity changes happen through stock movements.
// - Product deletion is handled as deactivation to preserve history.

import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Branch from '../models/branch.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';


// GET /products
// Admin can optionally filter by branch.
// Staff only see products belonging to their branch.
export const getAllProducts = asyncHandler(async (req, res) => {
    const filter = {};

    if (req.user.role === 'admin') {
        if (req.query.branch_id) {
            if (!mongoose.Types.ObjectId.isValid(req.query.branch_id)) {
                throw new ApiError(400, 'Invalid branch_id');
            }

            filter.branch_id = req.query.branch_id;
        }
    } else {
        if (!req.user.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }

        filter.branch_id = req.user.branch_id;
    }

    // Only active products by default.
    if (req.query.include_inactive !== 'true') {
        filter.is_active = true;
    }

    // Search by name (case-insensitive partial match).
    if (req.query.q) {
        filter.name = { $regex: req.query.q, $options: 'i' };
    }

    const products = await Product.find(filter)
        .populate('branch_id', 'name')
        .sort({ name: 1 });

    return apiResponse(res, 200, products, 'Products fetched successfully');
});


// GET /products/:id
export const getProductById = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new ApiError(400, 'Invalid product ID');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Staff cannot access products from another branch.
    if (req.user.role !== 'admin') {
        if (!req.user.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }

        if (
            product.branch_id.toString() !==
            req.user.branch_id.toString()
        ) {
            throw new ApiError(
                403,
                'Cannot view inventory outside your branch'
            );
        }
    }

    // Inactive products are hidden unless explicitly requested.
    if (
        !product.is_active &&
        req.query.include_inactive !== 'true'
    ) {
        throw new ApiError(404, 'Product not found');
    }

    return apiResponse(
        res,
        200,
        product,
        'Product fetched successfully'
    );
});


// POST /products
// Admin can specify the branch. Branch manager is automatically restricted to their own branch.
// Inventory always starts at zero. Stock must be added through POST /stock-movements.
export const createProduct = asyncHandler(async (req, res) => {
    const { name, description, price, unit = 'pieces', reorder_point = 0, } = req.body;

    let { branch_id } = req.body;

    // Validate name.
    if (typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'Name must be a valid non-empty string');
    }

    // Validate unit.
    if (typeof unit !== 'string' || !unit.trim()) {
        throw new ApiError(400, 'Unit must be a valid non-empty string');
    }

    // Branch manager and inventory officer are restricted to their own branch.
    if (['branch_manager', 'inventory_officer', 'inventory_manager'].includes(req.user.role)) {
        if (!req.user.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }

        branch_id = req.user.branch_id;
    }

    if (!branch_id) {
        throw new ApiError(400, 'branch_id is required');
    }

    // Validate branch ID.
    if (!mongoose.Types.ObjectId.isValid(branch_id)) {
        throw new ApiError(400, 'Invalid branch_id');
    }

    // Validate reorder point.
    if (typeof reorder_point !== 'number' || !Number.isFinite(reorder_point) || reorder_point < 0) {
        throw new ApiError(400, 'reorder_point must be a valid non-negative number');
    }

    // Validate price.
    if (price !== undefined &&(typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
        throw new ApiError(400, 'price must be a valid non-negative number');
    }

    // Verify branch exists.
    const branch = await Branch.findById(branch_id);

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Prevent duplicate product names within branch.
    const existingProduct = await Product.findOne({
        branch_id,
        name: name.trim(),
    });

    if (existingProduct) {
        throw new ApiError(409, 'A product with this name already exists at this branch');
    }

    // Product always starts with zero inventory.
    const product = await Product.create({
        branch_id,
        name: name.trim(),
        description: description?.trim(),
        price,
        unit: unit.trim(),
        quantity: 0,
        reorder_point,
        is_active: true,
    });

    return apiResponse(res,201,product, 'Product created successfully');
});


// PATCH /products/:id
// Admin can update any product.Branch manager can only update products in their branch.
// IMPORTANT:quantity cannot be changed here.Use POST /stock-movements for inventory changes.
export const updateProduct = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new ApiError(400, 'Invalid product ID');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Branch manager and inventory officer can only update products in their branch.
    if (['branch_manager', 'inventory_officer', 'inventory_manager'].includes(req.user.role)) {
        if (!req.user.branch_id) {
            throw new ApiError(403,'You are not assigned to any branch');
        }

        if (product.branch_id.toString() !== req.user.branch_id.toString()){
            throw new ApiError(403,'Cannot update inventory outside your branch');
        }
    }

    const { name,description,price,unit,quantity,reorder_point, is_active } = req.body;

    // Quantity must NOT be directly modified.
    if (quantity !== undefined) {
        throw new ApiError(400,'Product quantity cannot be changed directly. Use a stock movement instead.');
    }

    // Validate name.
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new ApiError(400,'Name must be a valid non-empty string');
        }

        const trimmedName = name.trim();

        const duplicate = await Product.findOne({
            branch_id: product.branch_id,
            name: trimmedName,
            _id: { $ne: product._id },
        });

        if (duplicate) {
            throw new ApiError(409,'A product with this name already exists at this branch');
        }

        product.name = trimmedName;
    }

    // Description.
    if (description !== undefined) {
        if (description !== null && typeof description !== 'string') {
            throw new ApiError(400, 'Description must be a string or null');
        }

        product.description = typeof description === 'string' ? description.trim() : null;
    }

    // Price.
    if (price !== undefined) {
        if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
            throw new ApiError(400, 'price must be a valid non-negative number');
        }

        product.price = price;
    }

    // Unit.
    if (unit !== undefined) {
        if (typeof unit !== 'string' || !unit.trim()) {
            throw new ApiError(400,'Unit must be a valid non-empty string');
        }

        product.unit = unit.trim();
    }

    // Reorder point.
    if (reorder_point !== undefined) {
        if (typeof reorder_point !== 'number' || !Number.isFinite(reorder_point) || reorder_point < 0) {
            throw new ApiError(400,'reorder_point must be a valid non-negative number');
        }

        product.reorder_point = reorder_point;
    }

    // Activation/deactivation.
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            throw new ApiError(400,'is_active must be a boolean');
        }

        product.is_active = is_active;
    }

    await product.save();

    return apiResponse(res, 200, product, 'Product updated successfully');
});


// DELETE /products/:id
//
// Soft delete/deactivate instead of physically deleting.
// This preserves historical stock movement records.
export const deleteProduct = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new ApiError(400, 'Invalid product ID');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Branch manager can only deactivate products in their branch.
    if (req.user.role !== 'admin') {
        if (!req.user.branch_id) {
            throw new ApiError(403,'You are not assigned to any branch');
        }

        if (product.branch_id.toString() !==req.user.branch_id.toString()) {
            throw new ApiError(403,'Cannot delete inventory outside your branch');
        }
    }

    product.is_active = false;

    await product.save();

    return apiResponse(res, 200, null, 'Product deactivated successfully');
});