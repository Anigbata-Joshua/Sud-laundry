// Owner: Josh
// Purpose:
// Handle immutable inventory stock movements.
//
// Rules:
// - purchase increases product quantity.
// - sale decreases product quantity.
// - usage decreases product quantity and records usage on the order.
// - Stock movements are immutable.
// - Corrections must be made with compensating movements.
// - Product quantity and usage/order updates happen atomically.
// - Inventory is branch-scoped.

import mongoose from 'mongoose';
import StockMovement from '../models/stockMovement.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import Employee from '../models/employee.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';

const SIGN_BY_TYPE = {
    purchase: 1,
    sale: -1,
    usage: -1,
};


// GET /stock-movements
export const getAllStock = asyncHandler(async (req, res) => {
    const filter = {};

    // Admin can view all branches and optionally filter by branch.
    if (req.user.role === 'admin') {
        if (req.query.branch_id) {
            filter.branch_id = req.query.branch_id;
        }
    } else {
        // All other staff are restricted to their branch.
        if (!req.user.branch_id) {
            throw new ApiError(
                403,
                'You are not assigned to a branch'
            );
        }

        filter.branch_id = req.user.branch_id;
    }

    if (req.query.product_id) {
        filter.product_id = req.query.product_id;
    }

    if (req.query.type) {
        if (
            !Object.prototype.hasOwnProperty.call(
                SIGN_BY_TYPE,
                req.query.type
            )
        ) {
            throw new ApiError(
                400,
                `Invalid movement type: ${req.query.type}`
            );
        }

        filter.type = req.query.type;
    }

    const movements = await StockMovement.find(filter)
        .populate('product_id', 'name unit')
        .populate('branch_id', 'name')
        .populate('employee_id')
        .populate('order_id')
        .sort({ created_at: -1 });

    return apiResponse(
        res,
        200,
        movements,
        'Stock movements fetched successfully'
    );
});


// GET /stock-movements/:id
export const getById = asyncHandler(async (req, res) => {
    const movement = await StockMovement.findById(req.params.id)
        .populate('product_id', 'name unit')
        .populate('branch_id', 'name')
        .populate('employee_id')
        .populate('order_id');

    if (!movement) {
        throw new ApiError(
            404,
            'Stock movement not found'
        );
    }

    // Non-admin users can only view their branch.
    if (req.user.role !== 'admin') {
        if (!req.user.branch_id) {
            throw new ApiError(
                403,
                'You are not assigned to a branch'
            );
        }

        if (
            movement.branch_id._id.toString() !==
            req.user.branch_id.toString()
        ) {
            throw new ApiError(
                403,
                'Cannot view inventory movements outside your branch'
            );
        }
    }

    return apiResponse(
        res,
        200,
        movement,
        'Stock movement fetched successfully'
    );
});


// POST /stock-movements
//
// Creates the movement and updates Product.quantity atomically.
export const createStock = asyncHandler(async (req, res) => {
    const {
        product_id,
        type,
        quantity,
        order_id,
        employee_id,
    } = req.body;

    // Only inventory staff can create movements.
    if (
        !['admin', 'branch_manager', 'employee'].includes(
            req.user.role
        )
    ) {
        throw new ApiError(
            403,
            'You do not have permission to create stock movements'
        );
    }

    if (!product_id || !type || quantity === undefined) {
        throw new ApiError(
            400,
            'product_id, type, and quantity are required'
        );
    }

    // Validate movement type.
    if (
        !Object.prototype.hasOwnProperty.call(
            SIGN_BY_TYPE,
            type
        )
    ) {
        throw new ApiError(
            400,
            `Invalid movement type: ${type}`
        );
    }

    // Employees can only record usage.
    if (
        req.user.role === 'employee' &&
        type !== 'usage'
    ) {
        throw new ApiError(
            403,
            'Employees can only record usage movements'
        );
    }

    // Validate quantity.
    if (
        typeof quantity !== 'number' ||
        !Number.isFinite(quantity) ||
        quantity === 0
    ) {
        throw new ApiError(
            400,
            'quantity must be a valid non-zero number'
        );
    }

    // Validate quantity sign.
    const expectedSign = SIGN_BY_TYPE[type];
    const actualSign = quantity > 0 ? 1 : -1;

    if (actualSign !== expectedSign) {
        throw new ApiError(
            400,
            `quantity must be ${
                expectedSign > 0
                    ? 'positive'
                    : 'negative'
            } for type '${type}'`
        );
    }

    // Usage requires an order and employee.
    if (
        type === 'usage' &&
        (!order_id || !employee_id)
    ) {
        throw new ApiError(
            400,
            'order_id and employee_id are required for usage movements'
        );
    }

    // Purchase/sale cannot have usage relationships.
    if (
        type !== 'usage' &&
        (order_id || employee_id)
    ) {
        throw new ApiError(
            400,
            'order_id and employee_id are only allowed for usage movements'
        );
    }

    const session = await mongoose.startSession();

    try {
        let movement;

        await session.withTransaction(async () => {

            // Find product inside transaction.
            const product = await Product.findById(product_id)
                .session(session);

            if (!product) {
                throw new ApiError(
                    404,
                    'Product not found'
                );
            }

            // Inactive products cannot receive movements.
            if (!product.is_active) {
                throw new ApiError(
                    400,
                    'Cannot create a stock movement for an inactive product'
                );
            }

            // Staff must belong to a branch.
            if (
                req.user.role !== 'admin' &&
                !req.user.branch_id
            ) {
                throw new ApiError(
                    403,
                    'You are not assigned to a branch'
                );
            }

            // Branch authorization.
            if (
                req.user.role !== 'admin' &&
                product.branch_id.toString() !==
                    req.user.branch_id.toString()
            ) {
                throw new ApiError(
                    403,
                    'Cannot manage inventory outside your branch'
                );
            }

            const branchId = product.branch_id;

            let employee = null;
            let order = null;

            // -----------------------------
            // USAGE VALIDATION
            // -----------------------------
            if (type === 'usage') {

                employee = await Employee.findById(
                    employee_id
                ).session(session);

                if (!employee) {
                    throw new ApiError(
                        404,
                        'Employee not found'
                    );
                }

                // Employee must belong to product branch.
                if (
                    employee.branch_id.toString() !==
                    branchId.toString()
                ) {
                    throw new ApiError(
                        400,
                        'Employee must belong to the same branch as the product'
                    );
                }

                // Employee can only record usage for themselves.
                if (req.user.role === 'employee') {

                    if (!req.user.id) {
                        throw new ApiError(
                            403,
                            'User identity could not be verified'
                        );
                    }

                    if (
                        employee.user_id.toString() !==
                        req.user.id.toString()
                    ) {
                        throw new ApiError(
                            403,
                            'Employees can only record usage under their own account'
                        );
                    }
                }

                // Verify order.
                order = await Order.findById(
                    order_id
                ).session(session);

                if (!order) {
                    throw new ApiError(
                        404,
                        'Order not found'
                    );
                }

                // Order must belong to product branch.
                if (
                    order.branch_id.toString() !==
                    branchId.toString()
                ) {
                    throw new ApiError(
                        400,
                        'Order must belong to the same branch as the product'
                    );
                }

                // Non-admin users cannot access another branch.
                if (
                    req.user.role !== 'admin' &&
                    order.branch_id.toString() !==
                        req.user.branch_id.toString()
                ) {
                    throw new ApiError(
                        403,
                        'Cannot record usage for an order outside your branch'
                    );
                }
            }

            // -----------------------------
            // UPDATE INVENTORY
            // -----------------------------

            const newQuantity =
                product.quantity + quantity;

            if (newQuantity < 0) {
                throw new ApiError(
                    409,
                    'Insufficient stock for this movement'
                );
            }

            product.quantity = newQuantity;

            await product.save({ session });

            // -----------------------------
            // CREATE IMMUTABLE LEDGER ENTRY
            // -----------------------------

            const createdMovement =
                await StockMovement.create(
                    [
                        {
                            product_id: product._id,
                            type,
                            quantity,
                            branch_id: branchId,
                            employee_id:
                                type === 'usage'
                                    ? employee_id
                                    : undefined,
                            order_id:
                                type === 'usage'
                                    ? order_id
                                    : undefined,
                        },
                    ],
                    { session }
                );

            movement = createdMovement[0];

            // -----------------------------
            // RECORD USAGE ON ORDER
            // -----------------------------

            if (type === 'usage') {

                order.supplies_used.push({
                    product_id: product._id,
                    name: product.name,
                    quantity_used: Math.abs(quantity),
                    employee_id,
                });

                await order.save({ session });
            }
        });

        // Populate after transaction.
        await movement.populate(
            'product_id',
            'name unit'
        );

        await movement.populate(
            'branch_id',
            'name'
        );

        await movement.populate(
            'employee_id'
        );

        await movement.populate(
            'order_id'
        );

        return apiResponse(
            res,
            201,
            movement,
            'Stock movement logged successfully'
        );

    } finally {
        await session.endSession();
    }
});


// PATCH /stock-movements/:id
//
// Stock movements are immutable.
export const updateStock = asyncHandler(async (req, res) => {
    throw new ApiError(
        405,
        'Stock movements cannot be edited — log a compensating movement instead'
    );
});


// DELETE /stock-movements/:id
//
// Stock movements are immutable.
export const removeStock = asyncHandler(async (req, res) => {
    throw new ApiError(
        405,
        'Stock movements cannot be deleted — log a compensating movement instead'
    );
});