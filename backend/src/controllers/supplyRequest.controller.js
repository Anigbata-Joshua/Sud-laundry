// Owner: Josh
// Purpose: attendant -> inventory officer supply approval flow.
// Stock is only ever deducted from approveRequest() — never automatically.

import Employee from '../models/employee.model.js'
import mongoose from 'mongoose'
import Order from '../models/order.model.js'
import ProcessingWorkflow from '../models/processingWorkflow.model.js'
import SupplyRequest from '../models/supplyRequest.model.js'
import createNotification from '../services/notification.service.js'
import ApiError from '../utils/apiError.js'
import apiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'
import {
  calculateSuppliesForStep,
  resolveSuppliesToProducts,
  disburseApprovedSupplies,
} from '../services/inventoryConsumption.service.js'

// Stages that actually consume supplies. 'intake', 'quality_check',
// 'delivery_ready' don't need a request.
const SUPPLY_STAGES = ['washing', 'processing', 'packaging']

const requestPopulate = [
  {
    path: 'order_id',
    select: 'items branch_id customer_id',
    populate: { path: 'customer_id', select: 'name' },
  },
  { path: 'branch_id', select: 'name' },
  { path: 'requested_by', populate: { path: 'user_id', select: 'name email' } },
  { path: 'reviewed_by', populate: { path: 'user_id', select: 'name email' } },
]

async function getEmployeeForUser(userId) {
  const employee = await Employee.findOne({ user_id: userId, is_active: true })
  if (!employee) throw new ApiError(404, 'Employee record not found')
  return employee
}

// POST /supply-requests
export const createRequest = asyncHandler(async (req, res) => {
  const { workflow_id, step_id } = req.body
  if (!workflow_id || !step_id) {
    throw new ApiError(400, 'workflow_id and step_id are required')
  }

  const workflow = await ProcessingWorkflow.findById(workflow_id)
  if (!workflow) throw new ApiError(404, 'Workflow not found')

  const step = workflow.steps.id(step_id)
  if (!step) throw new ApiError(404, 'Workflow step not found')

  const employee = await getEmployeeForUser(req.user.id)
  if (String(workflow.branch_id) !== String(employee.branch_id) || String(step.employee_id) !== String(employee._id)) {
    throw new ApiError(403, 'Only the assigned employee can request supplies for this step')
  }

  if (!SUPPLY_STAGES.includes(step.name)) {
    throw new ApiError(400, `The "${step.name}" stage does not require a supply request`)
  }

  if (step.status !== 'assigned') {
    throw new ApiError(409, 'Supplies can only be requested before accepting this step')
  }

  const existing = await SupplyRequest.findOne({ step_id, status: 'pending' })
  if (existing) {
    throw new ApiError(409, 'A supply request is already pending for this step')
  }

  const order = await Order.findById(workflow.order_id)
  if (!order) throw new ApiError(404, 'Order not found')

  const calculated = calculateSuppliesForStep({ order, stepName: step.name })
  const resolved = await resolveSuppliesToProducts({
    branch_id: workflow.branch_id,
    supplies: calculated,
  })

  const request = await SupplyRequest.create({
    order_id: order._id,
    workflow_id: workflow._id,
    step_id,
    branch_id: workflow.branch_id,
    requested_by: employee._id,
    calculated_items: resolved.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
    })),
  })

  const officers = await Employee.find({
    branch_id: workflow.branch_id,
    is_active: true,
  }).populate({
    path: 'user_id',
    match: { role: { $in: ['inventory_officer', 'inventory_manager'] }, is_active: true },
    select: '_id',
  })

  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`
  await Promise.all(
    officers
      .filter((officer) => officer.user_id)
      .map((officer) =>
        createNotification({
          user_id: officer.user_id._id,
          order_id: order._id,
          type: 'supply_requested',
          message: `New supply request for ${reference} (${step.name}) awaiting your review.`,
        }),
      ),
  )

  await request.populate(requestPopulate)
  return apiResponse(res, 201, request, 'Supply request created')
})

// GET /supply-requests — inventory officer's queue (or admin/branch_manager oversight)
export const listRequests = asyncHandler(async (req, res) => {
  if (!['admin', 'branch_manager', 'inventory_officer', 'inventory_manager'].includes(req.user.role)) {
    throw new ApiError(403, 'You do not have permission to view supply requests')
  }

  const filter = {}
  if (req.user.role !== 'admin') {
    if (!req.user.branch_id) throw new ApiError(403, 'You are not assigned to a branch')
    filter.branch_id = req.user.branch_id
  } else if (req.query.branch_id) {
    filter.branch_id = req.query.branch_id
  }
  if (req.query.status) {
    if (!['pending', 'approved', 'rejected'].includes(req.query.status)) throw new ApiError(400, 'Invalid request status')
    filter.status = req.query.status
  }

  const requests = await SupplyRequest.find(filter)
    .populate(requestPopulate)
    .sort({ createdAt: -1 })

  return apiResponse(res, 200, requests, 'Supply requests fetched')
})

// GET /supply-requests/order/:orderId
export const getOrderRequests = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) throw new ApiError(404, 'Order not found')

  if (
    ['branch_manager', 'inventory_officer', 'inventory_manager'].includes(req.user.role) &&
    req.user.branch_id !== order.branch_id.toString()
  ) {
    throw new ApiError(403, 'You can only view requests for your branch')
  }
  if (req.user.role === 'employee' || req.user.role === 'front_desk') {
    throw new ApiError(403, 'You do not have permission to view supply requests')
  }

  const requests = await SupplyRequest.find({ order_id: order._id })
    .populate(requestPopulate)
    .sort({ createdAt: -1 })

  return apiResponse(res, 200, requests, 'Order supply requests fetched')
})

async function assertOfficerScope(user, branchId) {
  if (!['admin', 'inventory_officer', 'inventory_manager'].includes(user.role)) {
    throw new ApiError(403, 'Only admins and inventory staff can review supply requests')
  }
  if (['inventory_officer', 'inventory_manager'].includes(user.role) && user.branch_id !== branchId.toString()) {
    throw new ApiError(403, 'You can only review requests for your branch')
  }
}

// PATCH /supply-requests/:id/approve
export const approveRequest = asyncHandler(async (req, res) => {
  const request = await SupplyRequest.findById(req.params.id)
  if (!request) throw new ApiError(404, 'Supply request not found')
  if (request.status !== 'pending') {
    throw new ApiError(409, 'This request has already been reviewed')
  }

  await assertOfficerScope(req.user, request.branch_id)

  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Provide at least one approved item')
  }
  const productIds = new Set()
  for (const item of items) {
    if (!item || typeof item.product_id !== 'string' || !mongoose.isObjectIdOrHexString(item.product_id) || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new ApiError(400, 'Each item needs a valid product_id and positive quantity')
    }
    const productId = item.product_id.toLowerCase()
    if (productIds.has(productId)) throw new ApiError(400, 'Each product may only appear once in an approval')
    productIds.add(productId)
  }

  const order = await Order.findById(request.order_id)
  if (!order) throw new ApiError(404, 'Order not found')

  const officer = await getEmployeeForUser(req.user.id)

  request.approved_items = items.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name ?? '',
    quantity: item.quantity,
    unit: item.unit,
  }))
  request.status = 'approved'
  request.reviewed_by = officer._id
  request.reviewed_at = new Date()

  // Disburse happens against the officer's final decision, atomically,
  // before the request itself is saved as approved.
  await disburseApprovedSupplies({ order, supplyRequest: request })

  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`
  const attendant = await Employee.findById(request.requested_by).populate('user_id', '_id')
  if (attendant?.user_id) {
    await createNotification({
      user_id: attendant.user_id._id,
      order_id: order._id,
      type: 'supply_approved',
      message: `Your supply request for ${reference} was approved. You can start now.`,
    })
  }

  await request.populate(requestPopulate)
  return apiResponse(res, 200, request, 'Supply request approved')
})

// PATCH /supply-requests/:id/reject
export const rejectRequest = asyncHandler(async (req, res) => {
  const request = await SupplyRequest.findById(req.params.id)
  if (!request) throw new ApiError(404, 'Supply request not found')
  if (request.status !== 'pending') {
    throw new ApiError(409, 'This request has already been reviewed')
  }

  await assertOfficerScope(req.user, request.branch_id)

  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : ''
  if (!reason) throw new ApiError(400, 'A rejection reason is required')

  const officer = await getEmployeeForUser(req.user.id)

  request.status = 'rejected'
  request.reviewed_by = officer._id
  request.reviewed_at = new Date()
  request.rejection_reason = reason
  const rejected = await SupplyRequest.findOneAndUpdate(
    { _id: request._id, status: 'pending' },
    { $set: { status: 'rejected', reviewed_by: officer._id, reviewed_at: request.reviewed_at, rejection_reason: reason } },
    { new: true, runValidators: true },
  )
  if (!rejected) throw new ApiError(409, 'This request has already been reviewed')

  const attendant = await Employee.findById(request.requested_by).populate('user_id', '_id')
  const order = await Order.findById(request.order_id)
  if (attendant?.user_id && order) {
    const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`
    await createNotification({
      user_id: attendant.user_id._id,
      order_id: order._id,
      type: 'supply_rejected',
      message: `Your supply request for ${reference} was rejected: ${reason}`,
    })
  }

  await request.populate(requestPopulate)
  return apiResponse(res, 200, request, 'Supply request rejected')
})
