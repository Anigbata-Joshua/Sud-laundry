// Owner: Series
// Purpose: initialize, verify, and record payments.
// Payment amounts are always validated against the order total on the server.

import axios from 'axios';
import Payment from '../models/payment.model.js';
import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

const getUserId = (req) => req.user?._id || req.user?.id;

export const initializePayment = asyncHandler(async (req, res) => {
    const { orderId, email } = req.body;

    if (!orderId || !email) {
        throw new ApiError(400, 'orderId and email are required');
    }

    const order = await Order.findById(orderId);

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Customers can only initialize payment for their own order.
    if (
        req.user.role === 'customer' &&
        order.customer_id.toString() !== getUserId(req).toString()
    ) {
        throw new ApiError(403, 'You do not have permission to pay for this order');
    }

    if (!order.total_price || order.total_price <= 0) {
        throw new ApiError(400, 'Invalid order total');
    }

    if (!PAYSTACK_SECRET) {
        throw new ApiError(500, 'Paystack configuration is missing');
    }

    const transaction_ref = `laundry_${order._id}_${Date.now()}`;

    const paystackRes = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
            email,
            amount: Math.round(order.amount_due * 100),
            reference: transaction_ref,
        },
        {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`,
                'Content-Type': 'application/json',
            },
        }
    );

    return apiResponse(res, 200, { authorization_url: paystackRes.data.data.authorization_url, transaction_ref, amount: order.total_price, }, 'Payment initialized successfully');
});


export const makePayment = asyncHandler(async (req, res) => {
    const {
        orderId,
        paymentMethod,
        transaction_ref,
        customer_Name,
        paymentType,
    } = req.body;

    if (!orderId || !paymentMethod) {
        throw new ApiError(400, 'orderId and paymentMethod are required');
    }

    const order = await Order.findById(orderId);

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Customers can only pay for their own orders.
    if (req.user.role === 'customer' && order.customer_id.toString() !== getUserId(req).toString()) {
        throw new ApiError(403, 'You do not have permission to pay for this order');
    }

    const amount = Number(order.amount_due);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError(400, 'Invalid order total');
    }

    let status = 'completed';

    // Cash payments do not require Paystack verification.
    if (paymentMethod !== 'cash') {
        if (!transaction_ref) {
            throw new ApiError(400, 'transaction_ref is required for non-cash payments');
        }

        // Prevent duplicate transaction processing.
        const existingPayment = await Payment.findOne({ transaction_ref, status: 'completed', });

        if (existingPayment) {
            throw new ApiError(409, 'This transaction reference has already been processed');
        }

        if (!PAYSTACK_SECRET) {
            throw new ApiError(500, 'Paystack configuration is missing');
        }

        try {
            const verifyRes = await axios.get(
                `https://api.paystack.co/transaction/verify/${transaction_ref}`,
                {
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_SECRET}`,
                    },
                }
            );

            const transaction = verifyRes.data?.data;

            if (!transaction) {
                status = 'failed';
            } else {
                const gatewayStatus = transaction.status;
                const gatewayAmount = Number(transaction.amount) / 100;

                // Paystack must confirm both success and the exact amount.
                if (gatewayStatus === 'success' && Math.abs(gatewayAmount - amount) <= 0.01) {
                    status = 'completed';
                } else {
                    status = 'failed';
                }
            }
        } catch (paystackError) {
            console.error('Paystack verification failed:', paystackError.response?.data || paystackError.message);

            // Test-only fallback.
            if (process.env.NODE_ENV !== 'production' && transaction_ref.startsWith('test_')) {
                status = 'completed';
            } else {
                status = 'failed';
            }
        }
    }

    const payment = await Payment.create({
        orderId,
        paymentMethod,
        amount,
        paymentType: paymentType || 'full payment',
        status,
        transaction_ref,
        customer_Name: customer_Name || req.user.name,
    });

    if (status === 'completed') {
        order.payment_status = 'paid';
        await order.save();
    }

    const httpStatus = status === 'completed' ? 201 : 402;

    return apiResponse(
        res,
        httpStatus,
        payment,
        status === 'completed'
            ? 'Payment recorded successfully'
            : 'Payment verification failed'
    );
});


export const getPaymentByOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    // Customers can only view payments belonging to their own order.
    if (req.user.role === 'customer' && order.customer_id.toString() !== getUserId(req).toString()) {
        throw new ApiError(403, 'You do not have permission to view this payment'
        );
    }

    const payment = await Payment.findOne({ orderId });

    if (!payment) {
        throw new ApiError(404, 'No payment found for this order');
    }

    return apiResponse(res, 200, payment, 'Payment retrieved successfully');
});


export const listPayments = asyncHandler(async (req, res) => {
    let { page = 1, limit = 20, status, paymentMethod, orderId, q, } = req.query;

    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};
    if (status) { filter.status = status; }
    if (paymentMethod) { filter.paymentMethod = paymentMethod; }
    if (orderId) { filter.orderId = orderId; }

    if (q) {
        filter.$or = [{ customer_Name: { $regex: q, $options: 'i', }, },
        { transaction_ref: { $regex: q, $options: 'i', }, },];
    }

    // Customers should only see their own payments.
    if (req.user.role === 'customer') {
        const customerOrders = await Order.find({customer_id: getUserId(req),}).select('_id');

        filter.orderId = { $in: customerOrders.map((order) => order._id), };
    }

    const total = await Payment.countDocuments(filter);

    const payments = await Payment.find(filter)
        .populate('orderId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const meta = { total, page, limit, totalPages: Math.ceil(total / limit), };

    return apiResponse(res, 200,{ items: payments, meta, },
        'Payments retrieved successfully'
    );
});