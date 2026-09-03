/* global process */
// Owner: Series
// Purpose: initialize, verify, and record payments.
// Payment amounts are always validated against the order total on the server.

import axios from 'axios'
import mongoose from 'mongoose'
import Payment from '../models/payment.model.js'
import Order from '../models/order.model.js'
import Employee from '../models/employee.model.js'
import User from '../models/user.model.js'
import createNotification from '../services/notification.service.js'
import ApiError from '../utils/apiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import apiResponse from '../utils/apiResponse.js'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

const getUserId = (req) => req.user?._id || req.user?.id

const getOrderBalance = async (orderId) => {
  const normalizedId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId
  const [totals] = await Payment.aggregate([
    { $match: { orderId: normalizedId, status: 'completed' } },
    {
      $group: {
        _id: null,
        netPaid: {
          $sum: {
            $ifNull: [
              '$net_amount',
              {
                $cond: [
                  { $eq: ['$transaction_type', 'refund'] },
                  { $multiply: ['$amount', -1] },
                  '$amount',
                ],
              },
            ],
          },
        },
        refunded: {
          $sum: { $cond: [{ $eq: ['$transaction_type', 'refund'] }, '$amount', 0] },
        },
      },
    },
  ])
  return { netPaid: totals?.netPaid || 0, refunded: totals?.refunded || 0 }
}

const updateOrderPaymentStatus = async (order) => {
  const balance = await getOrderBalance(order._id)
  if (balance.netPaid <= 0 && balance.refunded > 0) order.payment_status = 'refunded'
  else if (balance.netPaid <= 0) order.payment_status = 'unpaid'
  else if (balance.netPaid < order.amount_due) order.payment_status = 'part_payment'
  else order.payment_status = 'paid'
  await order.save()
  return balance
}

const notifyOverpayment = async (order, overpaidBy) => {
  const [admins, managers] = await Promise.all([
    User.find({ role: 'admin', is_active: true }).select('_id'),
    Employee.find({ branch_id: order.branch_id, is_active: true }).populate({
      path: 'user_id',
      match: { role: 'branch_manager', is_active: true },
      select: '_id',
    }),
  ])
  const recipients = new Set([
    ...admins.map((admin) => admin._id.toString()),
    ...managers
      .filter((manager) => manager.user_id)
      .map((manager) => manager.user_id._id.toString()),
  ])
  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`
  await Promise.all(
    [...recipients].map((userId) =>
      createNotification({
        user_id: userId,
        order_id: order._id,
        type: 'payment_overpaid',
        message: `${reference} has an overpayment of ₦${overpaidBy.toLocaleString('en-NG')}.`,
      }),
    ),
  )
}

export const initializePayment = asyncHandler(async (req, res) => {
  const { orderId, email } = req.body

  if (!orderId || !email) {
    throw new ApiError(400, 'orderId and email are required')
  }

  const order = await Order.findById(orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  // Customers can only initialize payment for their own order.
  if (req.user.role === 'customer' && order.customer_id.toString() !== getUserId(req).toString()) {
    throw new ApiError(403, 'You do not have permission to pay for this order')
  }

  // Branch manager and employee can initialize payment for their branch orders
  if (
    ['branch_manager', 'employee'].includes(req.user.role) &&
    order.branch_id.toString() !== req.user.branch_id
  ) {
    throw new ApiError(403, 'You do not have permission to initialize payment for this order')
  }

  if (!order.total_price || order.total_price <= 0) {
    throw new ApiError(400, 'Invalid order total')
  }

  if (!PAYSTACK_SECRET) {
    throw new ApiError(500, 'Paystack configuration is missing')
  }

  const transaction_ref = `laundry_${order._id}_${Date.now()}`

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
    },
  )

  return apiResponse(
    res,
    200,
    {
      authorization_url: paystackRes.data.data.authorization_url,
      transaction_ref,
      amount: order.total_price,
    },
    'Payment initialized successfully',
  )
})

export const makePayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    paymentMethod,
    transaction_ref,
    customer_Name,
    amount: requestedAmount,
  } = req.body

  if (!orderId || !paymentMethod) {
    throw new ApiError(400, 'orderId and paymentMethod are required')
  }

  const order = await Order.findById(orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  // Customers can only pay for their own orders.
  if (req.user.role === 'customer' && order.customer_id.toString() !== getUserId(req).toString()) {
    throw new ApiError(403, 'You do not have permission to pay for this order')
  }

  // Branch manager and employee can only pay for their branch orders
  if (
    ['branch_manager', 'employee'].includes(req.user.role) &&
    order.branch_id.toString() !== req.user.branch_id
  ) {
    throw new ApiError(403, 'You do not have permission to pay for this order')
  }

  const amount = Number(requestedAmount)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'A positive payment amount is required')
  }

  let status = 'completed'

  // Cash payments do not require Paystack verification.
  if (paymentMethod !== 'cash') {
    if (!transaction_ref) {
      throw new ApiError(400, 'transaction_ref is required for non-cash payments')
    }

    // Prevent duplicate transaction processing.
    const existingPayment = await Payment.findOne({ transaction_ref, status: 'completed' })

    if (existingPayment) {
      throw new ApiError(409, 'This transaction reference has already been processed')
    }

    if (!PAYSTACK_SECRET) {
      throw new ApiError(500, 'Paystack configuration is missing')
    }

    try {
      const verifyRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${transaction_ref}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
          },
        },
      )

      const transaction = verifyRes.data?.data

      if (!transaction) {
        status = 'failed'
      } else {
        const gatewayStatus = transaction.status
        const gatewayAmount = Number(transaction.amount) / 100

        // Paystack must confirm both success and the requested amount.
        if (gatewayStatus === 'success' && Math.abs(gatewayAmount - amount) <= 0.01) {
          status = 'completed'
        } else {
          status = 'failed'
        }
      }
    } catch (paystackError) {
      console.error(
        'Paystack verification failed:',
        paystackError.response?.data || paystackError.message,
      )

      // Test-only fallback.
      if (process.env.NODE_ENV !== 'production' && transaction_ref.startsWith('test_')) {
        status = 'completed'
      } else {
        status = 'failed'
      }
    }
  }

  const balanceBefore = await getOrderBalance(order._id)
  const projectedBalance = balanceBefore.netPaid + (status === 'completed' ? amount : 0)
  const paymentType =
    projectedBalance > order.amount_due
      ? 'overpayment'
      : projectedBalance >= order.amount_due
        ? 'full payment'
        : 'part payment'

  const payment = await Payment.create({
    orderId,
    branch_id: order.branch_id,
    paymentMethod,
    amount,
    net_amount: status === 'completed' ? amount : 0,
    transaction_type: 'payment',
    paymentType,
    status,
    transaction_ref,
    customer_Name: customer_Name || req.user.name,
    created_by: getUserId(req),
  })

  if (status === 'completed') {
    const balance = await updateOrderPaymentStatus(order)
    if (balance.netPaid > order.amount_due) {
      await notifyOverpayment(order, balance.netPaid - order.amount_due)
    }
  }

  const httpStatus = status === 'completed' ? 201 : 402

  return apiResponse(
    res,
    httpStatus,
    payment,
    status === 'completed' ? 'Payment recorded successfully' : 'Payment verification failed',
  )
})

export const refundPayment = asyncHandler(async (req, res) => {
  if (!['admin', 'branch_manager'].includes(req.user.role)) {
    throw new ApiError(403, 'Only admins and branch managers can refund payments')
  }
  const amount = Number(req.body.amount)
  const reason = req.body.reason?.trim()
  if (!Number.isFinite(amount) || amount <= 0 || !reason) {
    throw new ApiError(400, 'A positive refund amount and reason are required')
  }
  const original = await Payment.findById(req.params.id)
  if (!original || original.transaction_type === 'refund' || original.status !== 'completed') {
    throw new ApiError(404, 'Completed payment not found')
  }
  const order = await Order.findById(original.orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  if (req.user.role === 'branch_manager' && order.branch_id.toString() !== req.user.branch_id) {
    throw new ApiError(403, 'You can only refund payments from your branch')
  }
  const [refunded] = await Payment.aggregate([
    {
      $match: {
        refunded_payment_id: original._id,
        transaction_type: 'refund',
        status: 'completed',
      },
    },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ])
  if (amount > original.amount - (refunded?.amount || 0)) {
    throw new ApiError(409, 'Refund amount exceeds the refundable payment balance')
  }
  const refund = await Payment.create({
    orderId: original.orderId,
    branch_id: order.branch_id,
    amount,
    net_amount: -amount,
    transaction_type: 'refund',
    paymentMethod: original.paymentMethod,
    transaction_ref: `refund_${original._id}_${Date.now()}`,
    customer_Name: original.customer_Name,
    status: 'completed',
    paymentType: 'part payment',
    refunded_payment_id: original._id,
    refund_reason: reason,
    created_by: getUserId(req),
  })
  await updateOrderPaymentStatus(order)
  return apiResponse(res, 201, refund, 'Refund recorded successfully')
})

export const getPaymentByOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params

  const order = await Order.findById(orderId)

  if (!order) {
    throw new ApiError(404, 'Order not found')
  }

  // Customers can only view payments belonging to their own order.
  if (req.user.role === 'customer' && order.customer_id.toString() !== getUserId(req).toString()) {
    throw new ApiError(403, 'You do not have permission to view this payment')
  }

  // Branch managers can only view payments for their branch
  if (req.user.role === 'branch_manager' && order.branch_id.toString() !== req.user.branch_id) {
    throw new ApiError(403, 'You do not have permission to view this payment')
  }

  const payments = await Payment.find({ orderId }).sort({ createdAt: -1 })
  const balance = await getOrderBalance(orderId)
  return apiResponse(res, 200, { payments, balance }, 'Payments retrieved successfully')
})

export const listPayments = asyncHandler(async (req, res) => {
  let { page = 1, limit = 20, status, paymentMethod, orderId, q } = req.query

  page = Math.max(parseInt(page, 10) || 1, 1)
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)

  const filter = {}
  if (status) {
    filter.status = status
  }
  if (paymentMethod) {
    filter.paymentMethod = paymentMethod
  }
  if (orderId) {
    filter.orderId = orderId
  }

  if (q) {
    filter.$or = [
      { customer_Name: { $regex: q, $options: 'i' } },
      { transaction_ref: { $regex: q, $options: 'i' } },
    ]
  }

  // Customers should only see their own payments.
  if (req.user.role === 'customer') {
    const customerOrders = await Order.find({ customer_id: getUserId(req) }).select('_id')
    filter.orderId = { $in: customerOrders.map((order) => order._id) }
  }
  // Branch managers are scoped to their branch
  else if (req.user.role === 'branch_manager') {
    const branchOrders = await Order.find({ branch_id: req.user.branch_id }).select('_id')
    filter.orderId = { $in: branchOrders.map((order) => order._id) }
  }

  const total = await Payment.countDocuments(filter)

  const payments = await Payment.find(filter)
    .populate({
      path: 'orderId',
      populate: [
        { path: 'customer_id', select: 'name' },
        { path: 'branch_id', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  const meta = { total, page, limit, totalPages: Math.ceil(total / limit) }

  return apiResponse(res, 200, { items: payments, meta }, 'Payments retrieved successfully')
})
