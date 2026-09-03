// src/services/report.service.js
// Owner: series
// Purpose: aggregation logic for revenue, order volume, top services, and

// #SERIES!!! read the notes again after everyone has finished their parts so you can change plachodler names and ID

import mongoose from 'mongoose'
import Order from '../models/order.model.js'
import Payment from '../models/payment.model.js'

// ---- shared helpers ----

/**
 * Validates that startDate/endDate (if provided) are real dates and in order.
 * Throws a plain Error — the controller should catch this and turn it into
 * a proper apiError(400, ...) response.
 */
const validateDateRange = (startDate, endDate) => {
  if (startDate && isNaN(Date.parse(startDate))) {
    throw new Error('Invalid startDate')
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    throw new Error('Invalid endDate')
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new Error('startDate must be before endDate')
  }
}

const buildDateMatch = (startDate, endDate) => {
  if (!startDate && !endDate) return {}
  const createdAt = {}
  if (startDate) createdAt.$gte = new Date(startDate)
  if (endDate) createdAt.$lte = new Date(endDate)
  return { createdAt }
}

// ---- 1. revenue (+ average  value order) ----

export const getRevenue = async ({ branch_id, startDate, endDate } = {}) => {
  validateDateRange(startDate, endDate)

  const match = { status: 'completed', ...buildDateMatch(startDate, endDate) }
  const pipeline = [{ $match: match }]

  if (branch_id) {
    pipeline.push(
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $match: { 'order.branch_id': new mongoose.Types.ObjectId(branch_id) } },
    )
  }

  pipeline.push({
    $group: {
      _id: null,
      totalRevenue: { $sum: { $ifNull: ['$net_amount', '$amount'] } },
      count: { $sum: 1 },
    },
  })

  const result = await Payment.aggregate(pipeline)
  const { totalRevenue = 0, count = 0 } = result[0] || {}
  const averageOrderValue = count > 0 ? totalRevenue / count : 0

  return { totalRevenue, count, averageOrderValue }
}

// ---- 2. payment method breakdown ----

export const getPaymentMethodBreakdown = async ({ branch_id, startDate, endDate } = {}) => {
  validateDateRange(startDate, endDate)

  const match = { status: 'completed', ...buildDateMatch(startDate, endDate) }
  const pipeline = [{ $match: match }]

  if (branch_id) {
    pipeline.push(
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $match: { 'order.branch_id': new mongoose.Types.ObjectId(branch_id) } },
    )
  }

  pipeline.push(
    {
      $group: {
        _id: '$paymentMethod',
        revenue: { $sum: { $ifNull: ['$net_amount', '$amount'] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
  )

  return await Payment.aggregate(pipeline)
}

// ---- 3. period-over-period comparison ----

//   Compares revenue between two explicit date ranges (e.g. this month vs last month).
//   Caller decides what the two ranges actually are. can be used to get history also

export const getRevenueComparison = async ({ branch_id, currentRange, previousRange }) => {
  if (!currentRange || !previousRange) {
    throw new Error('getRevenueComparison requires both currentRange and previousRange')
  }

  const [current, previous] = await Promise.all([
    getRevenue({ branch_id, startDate: currentRange.startDate, endDate: currentRange.endDate }),
    getRevenue({ branch_id, startDate: previousRange.startDate, endDate: previousRange.endDate }),
  ])

  const change =
    previous.totalRevenue > 0
      ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
      : null // avoid divide-by-zero; null means "no prior data to compare"

  return { current, previous, percentChange: change }
}

// ---- 4. revenue/orders over time (daily buckets) ----

export const getRevenueOverTime = async ({ branch_id, startDate, endDate } = {}) => {
  validateDateRange(startDate, endDate)

  const match = { status: 'completed', ...buildDateMatch(startDate, endDate) }
  const pipeline = [{ $match: match }]

  if (branch_id) {
    pipeline.push(
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $match: { 'order.branch_id': new mongoose.Types.ObjectId(branch_id) } },
    )
  }

  pipeline.push(
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: { $ifNull: ['$net_amount', '$amount'] } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  )

  return await Payment.aggregate(pipeline)
}

// ---- 7. top customers by spend ----

export const getTopCustomers = async ({ branch_id, startDate, endDate, limit = 5 } = {}) => {
  validateDateRange(startDate, endDate)

  const match = { status: 'completed', ...buildDateMatch(startDate, endDate) }
  const pipeline = [{ $match: match }]

  pipeline.push(
    {
      $lookup: {
        from: 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $unwind: '$order' },
  )

  if (branch_id) {
    pipeline.push({
      $match: { 'order.branch_id': new mongoose.Types.ObjectId(branch_id) },
    })
  }

  pipeline.push(
    {
      $group: {
        _id: '$order.customer_id',
        totalSpent: { $sum: { $ifNull: ['$net_amount', '$amount'] } },
        orders: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: '$customer' },
    {
      $project: {
        _id: 1,
        totalSpent: 1,
        orders: 1,
        customerName: '$customer.name',
        customerEmail: '$customer.email',
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
  )

  return await Payment.aggregate(pipeline)
}

// ---- 6 & 9 (order volume / top services — unchanged from before) ----

export const getOrderVolume = async ({ branch_id, startDate, endDate } = {}) => {
  validateDateRange(startDate, endDate)
  const match = buildDateMatch(startDate, endDate)
  if (branch_id) match.branch_id = new mongoose.Types.ObjectId(branch_id)

  const result = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])

  return result
}

export const getTopServices = async ({ branch_id, startDate, endDate, limit = 5 } = {}) => {
  validateDateRange(startDate, endDate)
  const match = buildDateMatch(startDate, endDate)
  if (branch_id) match.branch_id = new mongoose.Types.ObjectId(branch_id)

  const result = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.service_id',
        name: { $first: '$items.name' },
        count: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ])

  return result
}
