// Owner: Josh
// Purpose:
// Handle inventory stock movements.
// Rules:
// - purchase increases product quantity.
// - sale decreases product quantity.
// - usage decreases product quantity and records the usage on the order.
// - Stock movements are immutable.
// - Corrections must be made with a compensating movement.
// - Product quantity and usage/order updates must happen atomically.

import mongoose from 'mongoose';
import StockMovement from '../models/stockMovement.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';

const SIGN_BY_TYPE = { purchase: 1, sale: -1, usage: -1 };

// GET /stock-movements
// Optional filters:
// ?product_id=...
// ?type=purchase|sale|usage
export const getAllStock = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.product_id) {
    filter.product_id = req.query.product_id;
  }

  if (req.query.type) {
    if (!Object.prototype.hasOwnProperty.call(SIGN_BY_TYPE, req.query.type)) {
      throw new ApiError(400, `Invalid movement type: ${req.query.type}`);
    }

    filter.type = req.query.type;
  }

  const movements = await StockMovement.find(filter).sort({ created_at: -1 });

  apiResponse( res, 200, movements, 'Stock movements fetched successfully' );
});

// GET /stock-movements/:id
export const getById = asyncHandler(async (req, res) => {
  const movement = await StockMovement.findById(req.params.id);

  if (!movement) {
    throw new ApiError(404, 'Stock movement not found');
  }

  apiResponse( res, 200, movement, 'Stock movement fetched successfully' );
});

// POST /stock-movements
// Creates the movement and updates Product.quantity atomically.
export const createStock = asyncHandler(async (req, res) => {
  const { product_id, type, quantity, order_id, employee_id, } = req.body;

  if (!product_id || !type || quantity === undefined) {
    throw new ApiError( 400, 'product_id, type, and quantity are required');
  }

  if (!Object.prototype.hasOwnProperty.call(SIGN_BY_TYPE, type)) {
    throw new ApiError(400, `Invalid movement type: ${type}`);
  }

  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new ApiError( 400, 'quantity must be a valid number');
  }

  if (quantity === 0) {
    throw new ApiError( 400, 'quantity must be a non-zero number');
  }

  const expectedSign = SIGN_BY_TYPE[type];
  const actualSign = quantity > 0 ? 1 : -1;

  if (actualSign !== expectedSign) {
    throw new ApiError( 400, `quantity must be ${expectedSign > 0 ? 'positive' : 'negative' } for type '${type}'`);
  }

  if (type === 'usage' && (!order_id || !employee_id)) {
    throw new ApiError( 400, 'order_id and employee_id are required for usage movements' );
  }

  const session = await mongoose.startSession();

  try {
    let movement;

    await session.withTransaction(async () => {
      const product = await Product.findById(product_id).session(session);

      if (!product) {
        throw new ApiError(404, 'Product not found');
      }

      const newQuantity = product.quantity + quantity;

      if (newQuantity < 0) {
        throw new ApiError( 409, 'Insufficient stock for this movement' );
      }

      product.quantity = newQuantity;

      await product.save({ session });

      const createdMovement = await StockMovement.create(
        [{ product_id, type, quantity, },], { session }
      );

      movement = createdMovement[0];

      if (type === 'usage') {
        const order = await Order.findById(order_id).session(session);

        if (!order) {
          throw new ApiError(404, 'Order not found');
        }

        order.supplies_used.push({
          product_id,
          name: product.name,
          quantity_used: Math.abs(quantity),
          employee_id,
        });

        await order.save({ session });
      }
    });

    apiResponse( res, 201, movement, 'Stock movement logged successfully' );
  } finally {
    await session.endSession();
  }
});

// Stock movements are immutable.
// Do not edit historical inventory records.
export const updateStock = asyncHandler(async (req, res) => {
  throw new ApiError( 405, 'Stock movements cannot be edited — log a new compensating movement instead');
});

// Stock movements are immutable.
// Do not delete historical inventory records.
export const removeStock = asyncHandler(async (req, res) => {
  throw new ApiError( 405, 'Stock movements cannot be deleted — log a new compensating movement instead');
});