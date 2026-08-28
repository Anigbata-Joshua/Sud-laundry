// Owner: series
// Purpose: record and verify payments, update order.payment_status.

import Payment from '../models/payment.model.js';
import Order from '../models/order.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import axios from 'axios';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export const initializePayment = asyncHandler(async (req, res) => {
    const { orderId, amount, email } = req.body;

    if (!orderId || !amount || !email) {
        throw new apiError(400, 'orderId, amount and email are required');
    }

    const order = await Order.findById(orderId);
    if (!order) {
        throw new apiError(404, 'Order not found');
    }

    const transaction_ref = `laundry_${orderId}_${Date.now()}`;

    const paystackRes = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
            email,
            amount: amount * 100, // Paystack expects kobo, not naira
            reference: transaction_ref,
        },
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    return apiResponse(res, 200, {
        authorization_url: paystackRes.data.data.authorization_url,
        transaction_ref,
    }, 'Payment initialized');
});

export const makePayment = asyncHandler(async (req, res) => {
    const { orderId, paymentMethod, amount, transaction_ref, customer_Name, paymentType } = req.body;

    if (!orderId || !paymentMethod || !amount) {
        throw new apiError(400, 'orderId, paymentMethod and amount are required');
    }

    const order = await Order.findById(orderId);
    if (!order) {
        throw new apiError(404, 'Order not found');
    }

    // Security Check: Customers can only pay for their own orders
    if (req.user.role === 'customer' && order.customer_id.toString() !== req.user.id) {
        throw new apiError(403, 'You do not have permission to pay for this order');
    }

    // Security Check: Match transaction amount against order total_price
    if (Math.abs(order.total_price - amount) > 0.01) {
        throw new apiError(400, `Payment amount mismatch: Order total is ${order.total_price}, but received ${amount}`);
    }

    let status = 'completed'; // cash defaults to completed immediately

    if (paymentMethod !== 'cash') {
        if (!transaction_ref) {
            throw new apiError(400, 'transaction_ref is required for non-cash payments');
        }

        // Security Check: Prevent processing identical transaction reference twice
        const existingPayment = await Payment.findOne({ transaction_ref, status: 'completed' });
        if (existingPayment) {
            throw new apiError(409, 'This transaction reference has already been processed');
        }

        try {
            const verifyRes = await axios.get(
                `https://api.paystack.co/transaction/verify/${transaction_ref}`,
                { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
            );

            const gatewayStatus = verifyRes.data?.data?.status; // 'success' | 'failed' | 'abandoned'
            const gatewayAmount = verifyRes.data?.data?.amount / 100; // Paystack amount is in kobo

            if (gatewayStatus === 'success') {
                if (Math.abs(gatewayAmount - amount) > 0.01) {
                    status = 'failed';
                    console.error(`Paystack amount mismatch: Gateway reports ${gatewayAmount}, but expected ${amount}`);
                } else {
                    status = 'completed';
                }
            } else {
                status = 'failed';
            }
        } catch (paystackError) {
            console.error('Paystack verification request failed:', paystackError.message);
            // Graceful fallback for local development testing
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
    return apiResponse(res, httpStatus, payment, status === 'completed' ? 'Payment recorded successfully' : 'Payment verification failed');
});

export const getPaymentByOrder = asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({ orderId: req.params.orderId });
    if (!payment) {
        throw new apiError(404, 'No payment found for this order');
    }
    return apiResponse(res, 200, payment, 'Payment retrieved successfully');
});

export const listPayments = asyncHandler(async (req, res) => {
    // pagination and query support
    let { page = 1, limit = 20, status, paymentMethod, orderId, q } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 20;

    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (orderId) filter.orderId = orderId;
    if (q) {
        filter.$or = [
            { customer_Name: { $regex: q, $options: 'i' } },
            { transaction_ref: { $regex: q, $options: 'i' } },
        ];
    }

    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
        .populate('orderId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
    return apiResponse(res, 200, { items: payments, meta }, 'Payments retrieved successfully');
});
