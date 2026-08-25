// Owner: Josh
// Purpose: log stock movements; usage entries atomically update both the
// related product's quantity and the related order's supplies_used array.
// Movements are immutable once created — to correct a mistake, log a new
// compensating movement rather than editing/deleting history.

import mongoose from 'mongoose';
import StockMovement from '../models/stockMovement.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';

const SIGN_BY_TYPE = {
  purchase: 1,
  sale: -1,
  usage: -1,
};

// GET /stock-movements — optionally filter by ?product_id= and/or ?type=
export const getAllStock = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.product_id) filter.product_id = req.query.product_id;
  if (req.query.type) filter.type = req.query.type;

  const movements = await StockMovement.find(filter).sort({ created_at: -1 });
  apiResponse(res, 200, movements, 'Stock movements fetched successfully');
});

// GET /stock-movements/:id
export const getById = asyncHandler(async (req, res) => {
  const movement = await StockMovement.findById(req.params.id);
  if (!movement) throw new ApiError(404, 'Stock movement not found');
  apiResponse(res, 200, movement, 'Stock movement fetched successfully');
});

// POST /stock-movements — logs a movement, atomically updates Product.quantity,
// and for type 'usage', also updates the related order's supplies_used array.
export const createStock = asyncHandler(async (req, res) => {
  const { product_id, type, quantity, order_id, employee_id } = req.body;

  if (!product_id || !type || quantity === undefined) {
    throw new ApiError(400, 'product_id, type, and quantity are required');
  }
  if (!SIGN_BY_TYPE[type]) {
    throw new ApiError(400, `Invalid type: ${type}`);
  }
  if (typeof quantity !== 'number' || quantity === 0) {
    throw new ApiError(400, 'quantity must be a non-zero number');
  }

  const expectedSign = SIGN_BY_TYPE[type];
  const actualSign = quantity > 0 ? 1 : -1;
  if (actualSign !== expectedSign) {
    throw new ApiError(
      400,
      `quantity must be ${expectedSign > 0 ? 'positive' : 'negative'} for type '${type}'`
    );
  }

  if (type === 'usage' && (!order_id || !employee_id)) {
    throw new ApiError(400, 'order_id and employee_id are required for usage movements');
  }

  const session = await mongoose.startSession();
  try {
    let movement;
    await session.withTransaction(async () => {
      const product = await Product.findById(product_id).session(session);
      if (!product) throw new ApiError(404, 'Product not found');

      const newQuantity = product.quantity + quantity;
      if (newQuantity < 0) {
        throw new ApiError(409, 'Insufficient stock for this movement');
      }

      product.quantity = newQuantity;
      await product.save({ session });

      const created = await StockMovement.create([{ product_id, type, quantity }], { session });
      movement = created[0];

      if (type === 'usage') {
        const order = await Order.findById(order_id).session(session);
        if (!order) throw new ApiError(404, 'Order not found');

        order.supplies_used.push({
          product_id,
          name: product.name,
          quantity_used: Math.abs(quantity),
          employee_id,
        });
        await order.save({ session });
      }
    });

    apiResponse(res, 201, movement, 'Stock movement logged successfully');
  } finally {
    session.endSession();
  }
});

// Movements are immutable — no update or delete. Log a compensating movement instead.
export const updateStock = asyncHandler(async (req, res) => {
  throw new ApiError(
    405,
    'Stock movements cannot be edited — log a new compensating movement instead'
  );
});

export const removeStock = asyncHandler(async (req, res) => {
  throw new ApiError(
    405,
    'Stock movements cannot be deleted — log a new compensating movement instead'
  );
});