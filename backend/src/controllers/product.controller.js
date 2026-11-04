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
// - Initial stock can be provided on creation by admin or inventory_officer.
// - Product deletion is handled as deactivation to preserve history.

import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Branch from '../models/branch.model.js';
import StockMovement from '../models/stockMovement.model.js';
import Employee from '../models/employee.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';

export const CORE_RECIPE_SUPPLIES = [
    { name: 'Laundry Detergent', unit: 'scoop', default_reorder_point: 20 },
    { name: 'Fabric Softener', unit: 'cap', default_reorder_point: 10 },
    { name: 'Ironing Starch', unit: 'spray', default_reorder_point: 10 },
    { name: 'Dry Cleaning Solvent', unit: 'unit', default_reorder_point: 10 },
    { name: 'Packaging Nylon', unit: 'pieces', default_reorder_point: 20 },
    { name: 'Hanger', unit: 'pieces', default_reorder_point: 20 },
];

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

// GET /products/needs-attention
// Lists products at or below their reorder point and products required by recipes that the branch does not have.
export const getProductsNeedingAttention = asyncHandler(async (req, res) => {
    let branch_id;
    if (req.user.role === 'admin') {
        branch_id = req.query.branch_id || req.user.branch_id;
        if (!branch_id) {
            const firstBranch = await Branch.findOne().sort({ createdAt: 1 });
            if (firstBranch) branch_id = firstBranch._id.toString();
        }
    } else {
        if (!req.user.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }
        branch_id = req.user.branch_id.toString();
    }

    if (!branch_id || !mongoose.Types.ObjectId.isValid(branch_id)) {
        throw new ApiError(400, 'Valid branch_id is required');
    }

    const branch = await Branch.findById(branch_id);
    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // 1. Fetch all active products at this branch
    const products = await Product.find({ branch_id, is_active: true }).sort({ name: 1 });

    const items = [];

    // Low stock products: quantity <= reorder_point
    for (const product of products) {
        const reserved = product.reserved_quantity || 0;
        const available = Math.max(0, product.quantity - reserved);
        const isLow = product.quantity <= product.reorder_point || available <= product.reorder_point;
        if (isLow) {
            items.push({
                _id: product._id,
                product_id: product._id,
                name: product.name,
                description: product.description,
                unit: product.unit,
                price: product.price,
                quantity: product.quantity,
                reserved_quantity: reserved,
                available_quantity: available,
                reorder_point: product.reorder_point,
                branch_id: product.branch_id,
                is_missing: false,
                reason: product.quantity <= product.reorder_point ? 'low_stock' : 'low_available',
                status: 'low_stock',
            });
        }
    }

    // 2. Recipe required supplies that the branch does NOT have
    for (const supply of CORE_RECIPE_SUPPLIES) {
        const found = products.find(
            (p) => p.name.trim().toLowerCase() === supply.name.trim().toLowerCase(),
        );
        if (!found) {
            items.push({
                _id: null,
                product_id: null,
                name: supply.name,
                description: `Core recipe supply required for processing`,
                unit: supply.unit,
                price: 0,
                quantity: 0,
                reserved_quantity: 0,
                available_quantity: 0,
                reorder_point: supply.default_reorder_point,
                branch_id,
                is_missing: true,
                reason: 'missing_recipe_supply',
                status: 'missing',
            });
        }
    }

    return apiResponse(
        res,
        200,
        {
            branch: { _id: branch._id, name: branch.name },
            items,
            total: items.length,
            low_stock_count: items.filter((i) => !i.is_missing).length,
            missing_count: items.filter((i) => i.is_missing).length,
        },
        'Needs attention inventory fetched successfully',
    );
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
// Admin can specify the branch. Branch manager and inventory officer are restricted to their own branch.
// Initial stock can be provided by admin or inventory_officer, creating an initial stock movement.
export const createProduct = asyncHandler(async (req, res) => {
    const { name, description, price, unit = 'pieces', reorder_point = 0, initial_stock } = req.body;

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
    if (['branch_manager', 'inventory_officer'].includes(req.user.role)) {
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
    if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
        throw new ApiError(400, 'price must be a valid non-negative number');
    }

    // Initial stock handling
    const initialStockNum = initial_stock !== undefined && initial_stock !== null && initial_stock !== ''
        ? Number(initial_stock)
        : 0;

    if (!Number.isFinite(initialStockNum) || initialStockNum < 0) {
        throw new ApiError(400, 'initial_stock must be a valid non-negative number');
    }

    if (initialStockNum > 0 && !['admin', 'inventory_officer'].includes(req.user.role)) {
        throw new ApiError(403, 'Only admins and inventory officers can set initial stock');
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

    const product = await Product.create({
        branch_id,
        name: name.trim(),
        description: description?.trim(),
        price,
        unit: unit.trim(),
        quantity: initialStockNum,
        reorder_point,
        is_active: true,
    });

    if (initialStockNum > 0) {
        let employeeId = null;
        if (req.user.role === 'inventory_officer') {
            const emp = await Employee.findOne({ user_id: req.user.id });
            employeeId = emp?._id;
        }
        await StockMovement.create({
            product_id: product._id,
            branch_id,
            employee_id: employeeId,
            type: 'purchase',
            quantity: initialStockNum,
            notes: 'Initial stock on product creation',
        });
    }

    return apiResponse(res, 201, product, 'Product created successfully');
});

// PATCH /products/:id
// Admin can update any product. Branch manager and inventory officer can only update products in their branch.
// IMPORTANT: quantity cannot be changed here directly. Use POST /stock-movements for inventory changes.
export const updateProduct = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new ApiError(400, 'Invalid product ID');
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Branch manager and inventory officer can only update products in their branch.
    if (['branch_manager', 'inventory_officer'].includes(req.user.role)) {
        if (!req.user.branch_id) {
            throw new ApiError(403, 'You are not assigned to any branch');
        }

        if (product.branch_id.toString() !== req.user.branch_id.toString()) {
            throw new ApiError(403, 'Cannot update inventory outside your branch');
        }
    }

    const { name, description, price, unit, quantity, reorder_point, is_active } = req.body;

    // Quantity must NOT be directly modified.
    if (quantity !== undefined) {
        throw new ApiError(400, 'Product quantity cannot be changed directly. Use a stock movement instead.');
    }

    // Validate name.
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            throw new ApiError(400, 'Name must be a valid non-empty string');
        }

        const trimmedName = name.trim();

        const duplicate = await Product.findOne({
            branch_id: product.branch_id,
            name: trimmedName,
            _id: { $ne: product._id },
        });

        if (duplicate) {
            throw new ApiError(409, 'A product with this name already exists at this branch');
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
            throw new ApiError(400, 'Unit must be a valid non-empty string');
        }

        product.unit = unit.trim();
    }

    // Reorder point.
    if (reorder_point !== undefined) {
        if (typeof reorder_point !== 'number' || !Number.isFinite(reorder_point) || reorder_point < 0) {
            throw new ApiError(400, 'reorder_point must be a valid non-negative number');
        }

        product.reorder_point = reorder_point;
    }

    // Activation/deactivation.
    if (is_active !== undefined) {
        if (typeof is_active !== 'boolean') {
            throw new ApiError(400, 'is_active must be a boolean');
        }

        product.is_active = is_active;
    }

    await product.save();

    return apiResponse(res, 200, product, 'Product updated successfully');
});

// DELETE /products/:id
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
            throw new ApiError(403, 'You are not assigned to any branch');
        }

        if (product.branch_id.toString() !== req.user.branch_id.toString()) {
            throw new ApiError(403, 'Cannot delete inventory outside your branch');
        }
    }

    product.is_active = false;

    await product.save();

    return apiResponse(res, 200, null, 'Product deactivated successfully');
});
