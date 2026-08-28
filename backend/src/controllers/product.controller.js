// Owner: Josh
// Purpose:
// Product (inventory) CRUD — branch-scoped.
//
// Rules:
// - Admin can manage products across all branches.
// - Branch managers can only manage products in their own branch.
// - Branch managers cannot move products between branches.
// - Employees can only view products belonging to their branch.
// - Product quantity changes should preferably be handled through
//   stock movements rather than direct quantity edits.

import Product from '../models/product.model.js';
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
            filter.branch_id = req.query.branch_id;
        }
    } else {
        filter.branch_id = req.user.branch_id;
    }

    const products = await Product.find(filter).sort({ name: 1 });

    apiResponse(res, 200, products, 'Products fetched successfully');
});

// GET /products/:id
export const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Staff cannot access products from another branch.
    if (req.user.role !== 'admin' && product.branch_id.toString() !== req.user.branch_id.toString()) {
        throw new ApiError(403, 'Cannot view inventory outside your branch'
        );
    }

    apiResponse(res, 200, product, 'Product fetched successfully');
});

// POST /products
//
// Admin can specify the branch.
// Branch manager is automatically restricted to their own branch.
export const createProduct = asyncHandler(async (req, res) => {
    const { name, description, price, quantity, reorder_point, } = req.body;

    let { branch_id } = req.body;

    if (!name) {
        throw new ApiError(400, 'Name is required');
    }

    if (req.user.role === 'branch_manager') {
        branch_id = req.user.branch_id;
    }

    if (!branch_id) {
        throw new ApiError(400, 'branch_id is required');
    }

    // Prevent duplicate product names within the same branch.
    const existingProduct = await Product.findOne({ branch_id, name, });

    if (existingProduct) {
        throw new ApiError(409, 'A product with this name already exists at this branch');
    }

    const product = await Product.create({
        branch_id,
        name,
        description,
        price,
        quantity,
        reorder_point,
    });

    apiResponse(res, 201, product, 'Product created successfully');
});

// PATCH /products/:id
//
// Admin can update any product.
// Branch manager can only update products in their branch.
//
// branch_id cannot be changed here.
export const updateProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    if ( req.user.role === 'branch_manager' && product.branch_id.toString() !== req.user.branch_id.toString() ) {
        throw new ApiError(403, 'Cannot update inventory outside your branch' );
    }

    const { name, description, price, quantity, reorder_point, } = req.body;

    const updates = {};

    if (name !== undefined) {
        updates.name = name;
    }

    if (description !== undefined) {
        updates.description = description;
    }

    if (price !== undefined) {
        updates.price = price;
    }

    if (quantity !== undefined) {
        updates.quantity = quantity;
    }

    if (reorder_point !== undefined) {
        updates.reorder_point = reorder_point;
    }

    Object.assign(product, updates);

    await product.save();

    apiResponse( res, 200, product, 'Product updated successfully' );
});

// DELETE /products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    if ( req.user.role === 'branch_manager' && product.branch_id.toString() !== req.user.branch_id.toString() ) {
        throw new ApiError(403, 'Cannot delete inventory outside your branch');
    }

    await product.deleteOne();

    apiResponse(res, 200, null, 'Product deleted successfully');
});