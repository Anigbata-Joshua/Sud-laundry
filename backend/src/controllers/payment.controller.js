/* global process */
import axios from 'axios'
import mongoose from 'mongoose'
import Employee from '../models/employee.model.js'
import Order from '../models/order.model.js'
import Payment from '../models/payment.model.js'
import User from '../models/user.model.js'
import createNotification from '../services/notification.service.js'
import ApiError from '../utils/apiError.js'
import apiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

async function getOrderBalance(orderId) {
  const normalizedOrderId =
    typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId
  const [totals] = await Payment.aggregate([
    { $match: { orderId: normalizedOrderId, status: 'completed' } },
    {
      $group: {
        _id: null,
        paid: {
          $sum: {
            $cond: [{ $eq: ['$transaction_type', 'refund'] }, 0, '$amount'],
          },
        },
        refunded: {
          $sum: {
            $cond: [{ $eq: ['$transaction_type', 'refund'] }, '$amount', 0],
          },
        },
      },
    },
  ])
  const paid = totals?.paid ?? 0
  const refunded = totals?.refunded ?? 0
  return { paid, refunded, netPaid: paid - refunded }
}

async function updateOrderPaymentStatus(order) {
  const balance = await getOrderBalance(order._id)
  if (balance.netPaid <= 0 && balance.refunded > 0) order.payment_status = 'refunded'
  else if (balance.netPaid <= 0) order.payment_status = 'unpaid'
  else if (balance.netPaid < order.total_price) order.payment_status = 'part_payment'
  else order.payment_status = 'paid'
  await order.save()
  return balance
}

async function notifyOverpayment(order, overpaidBy) {
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
  const { orderId, amount, email } = req.body
  if (!orderId || !amount || !email) {
    throw new ApiError(400, 'orderId, amount and email are required')
  }
  const order = await Order.findById(orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  const transaction_ref = `laundry_${orderId}_${Date.now()}`
  const paystackResponse = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    { email, amount: Number(amount) * 100, reference: transaction_ref },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
  )
  return apiResponse(
    res,
    200,
    {
      authorization_url: paystackResponse.data.data.authorization_url,
      transaction_ref,
    },
    'Payment initialized',
  )
})

export const makePayment = asyncHandler(async (req, res) => {
  const { orderId, paymentMethod, transaction_ref } = req.body
  const amount = Number(req.body.amount)
  if (!orderId || !paymentMethod || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'orderId, paymentMethod and a positive amount are required')
  }
  const order = await Order.findById(orderId).populate('customer_id', 'name')
  if (!order) throw new ApiError(404, 'Order not found')
  if (req.user.role === 'customer' && order.customer_id._id.toString() !== req.user.id) {
    throw new ApiError(403, 'You can only pay for your own orders')
  }
  if (
    ['branch_manager', 'employee'].includes(req.user.role) &&
    order.branch_id.toString() !== req.user.branch_id
  ) {
    throw new ApiError(403, 'You can only record payments for your branch')
  }

  let status = 'completed'
  if (paymentMethod !== 'cash') {
    if (!transaction_ref) {
      throw new ApiError(400, 'transaction_ref is required for non-cash payments')
    }
    const verifyResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${transaction_ref}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    )
    status = verifyResponse.data?.data?.status === 'success' ? 'completed' : 'failed'
  }

  const before = await getOrderBalance(order._id)
  const projectedNet = before.netPaid + (status === 'completed' ? amount : 0)
  const paymentType =
    projectedNet > order.total_price
      ? 'overpayment'
      : projectedNet >= order.total_price
        ? 'full payment'
        : 'part payment'
  const payment = await Payment.create({
    orderId: order._id,
    branch_id: order.branch_id,
    amount,
    net_amount: status === 'completed' ? amount : 0,
    paymentMethod,
    paymentType,
    status,
    transaction_ref,
    customer_Name: order.customer_id?.name ?? req.body.customer_Name,
    transaction_type: 'payment',
    created_by: req.user.id,
  })

  if (status === 'completed') {
    const balance = await updateOrderPaymentStatus(order)
    if (balance.netPaid > order.total_price) {
      await notifyOverpayment(order, balance.netPaid - order.total_price)
    }
  }
  const httpStatus = status === 'completed' ? 201 : 402
  return apiResponse(
    res,
    httpStatus,
    payment,
    status === 'completed' ? 'Payment recorded successfully' : 'Payment failed',
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
  const branchId = original.branch_id ?? order.branch_id
  if (req.user.role === 'branch_manager' && branchId.toString() !== req.user.branch_id) {
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
  if (amount > original.amount - (refunded?.amount ?? 0)) {
    throw new ApiError(409, 'Refund amount exceeds the refundable payment balance')
  }

  const refund = await Payment.create({
    orderId: original.orderId,
    branch_id: branchId,
    amount,
    net_amount: -amount,
    paymentMethod: original.paymentMethod,
    transaction_ref: `refund_${original._id}_${Date.now()}`,
    customer_Name: original.customer_Name,
    status: 'completed',
    paymentType: 'part payment',
    transaction_type: 'refund',
    refunded_payment_id: original._id,
    refund_reason: reason,
    created_by: req.user.id,
  })
  await updateOrderPaymentStatus(order)
  return apiResponse(res, 201, refund, 'Refund recorded successfully')
})

export const getPaymentByOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  if (req.user.role === 'customer' && order.customer_id.toString() !== req.user.id) {
    throw new ApiError(403, 'You can only view payments for your own orders')
  }
  if (
    ['branch_manager', 'employee'].includes(req.user.role) &&
    order.branch_id.toString() !== req.user.branch_id
  ) {
    throw new ApiError(403, 'You can only view payments from your branch')
  }
  const payments = await Payment.find({ orderId: req.params.orderId })
    .populate('created_by', 'name role')
    .sort({ createdAt: -1 })
  const balance = await getOrderBalance(req.params.orderId)
  return apiResponse(res, 200, { payments, balance }, 'Order payments retrieved successfully')
})

export const listPayments = asyncHandler(async (req, res) => {
  let { page = 1, limit = 100, status, paymentMethod, orderId, q } = req.query
  page = parseInt(page, 10) || 1
  limit = Math.min(parseInt(limit, 10) || 100, 200)
  const filter = {}
  if (req.user.role === 'branch_manager') {
    const branchOrders = await Order.find({ branch_id: req.user.branch_id }).select('_id')
    filter.orderId = { $in: branchOrders.map((order) => order._id) }
  }
  if (status) filter.status = status
  if (paymentMethod) filter.paymentMethod = paymentMethod
  if (orderId) {
    if (
      req.user.role === 'branch_manager' &&
      !filter.orderId.$in.some((id) => id.toString() === orderId)
    ) {
      throw new ApiError(403, 'You can only view payments from your branch')
    }
    filter.orderId = orderId
  }
  if (q) {
    filter.$or = [
      { customer_Name: { $regex: q, $options: 'i' } },
      { transaction_ref: { $regex: q, $options: 'i' } },
    ]
  }
  const total = await Payment.countDocuments(filter)
  const payments = await Payment.find(filter)
    .populate({
      path: 'orderId',
      populate: [
        { path: 'branch_id', select: 'name' },
        { path: 'customer_id', select: 'name' },
      ],
    })
    .populate('created_by', 'name role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
  return apiResponse(
    res,
    200,
    { items: payments, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    'Payments retrieved successfully',
  )
})
