import Employee from '../models/employee.model.js'
import Order from '../models/order.model.js'
import ProcessingWorkflow from '../models/processingWorkflow.model.js'
import SupplyRequest from '../models/supplyRequest.model.js'
import createNotification from '../services/notification.service.js'
import ApiError from '../utils/apiError.js'
import apiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'
import { STAGE_SERVICE_CATEGORIES } from '../config/serviceSupplies.config.js'

// Stages that require supply requests
const SUPPLY_STAGES = ['washing', 'processing', 'packaging']

// Maximum active orders an attendant can have at a time
const MAX_ACTIVE_ORDERS_PER_EMPLOYEE = 5
const NON_ACTIVE_ORDER_STATUSES = ['ready', 'delivered', 'cancelled']

// Count active orders for an employee
async function countActiveOrdersForEmployee(employeeId) {
  const orderIds = await ProcessingWorkflow.find({ 'steps.employee_id': employeeId }).distinct(
    'order_id',
  )
  if (orderIds.length === 0) return 0
  return Order.countDocuments({
    _id: { $in: orderIds },
    status: { $nin: NON_ACTIVE_ORDER_STATUSES },
  })
}

const workflowPopulate = [
  { path: 'order_id', populate: [{ path: 'customer_id', select: 'name' },{ path: 'branch_id', select: 'name' }],},
  { path: 'branch_id', select: 'name' },
  { path: 'steps.employee_id', populate: { path: 'user_id', select: 'name email' } },
]

async function manageBranchWorkflow(user, branchId) {
  if (!['admin', 'branch_manager'].includes(user.role)) {
    throw new ApiError(403, 'Only admins and branch managers can manage processing workflows')
  }
  if (user.role === 'branch_manager' && user.branch_id !== branchId.toString()) {
    throw new ApiError(403, 'You can only manage workflows for your branch')
  }
}

export const createWorkflow = asyncHandler(async (req, res) => {

  const { order_id, steps } = req.body;
  const order = await Order.findById(order_id);

  if (!order) throw new ApiError(404, 'Order not found');

  await manageBranchWorkflow(req.user, order.branch_id)
  if (!['received', 'processing'].includes(order.status)) {
    throw new ApiError(409, 'The order must be received before processing can begin')
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new ApiError(400, 'Add at least one workflow process')
  }
  const active = await ProcessingWorkflow.exists({ order_id, status: 'active' })
  if (active) throw new ApiError(409, 'This order already has an active processing workflow')

  const employees = await Employee.find({
    _id: { $in: steps.map((step) => step.employee_id) },
    branch_id: order.branch_id,
    is_active: true,
  }).populate('user_id', 'name')
  if (employees.length !== new Set(steps.map((step) => step.employee_id)).size) {
    throw new ApiError(400, 'Every process must use an active employee from the order branch')
  }

  // order categories . This avoids empty supply requests made by manager. 
  const orderCategories = new Set(order.items.map((item) => item.category).filter(Boolean))
  for (const step of steps) {
    const relevantCategories = STAGE_SERVICE_CATEGORIES[step.name]
    if (relevantCategories && !relevantCategories.some((category) => orderCategories.has(category))) {
      throw new ApiError(400, `The "${step.name}" stage doesn't match any service on this order (order has: ${[...orderCategories].join(', ') || 'no categorized services'}). Choose a stage that matches what was actually ordered.`)
    }
  }

  // Workload cap: don't pile more active orders onto an already-loaded attendant
  const uniqueEmployeeIds = [...new Set(steps.map((step) => step.employee_id))]
  for (const employeeId of uniqueEmployeeIds) {
    const activeCount = await countActiveOrdersForEmployee(employeeId)
    if (activeCount >= MAX_ACTIVE_ORDERS_PER_EMPLOYEE) {
      const employee = employees.find((item) => item._id.toString() === employeeId)
      throw new ApiError(409, `${employee?.user_id?.name ?? 'This employee'} already has ${activeCount} active orders (max ${MAX_ACTIVE_ORDERS_PER_EMPLOYEE}) and cannot be assigned more until some are marked ready`)
    }
  }

  // Check if there is an active workflow for order to avoid redundant workflows
  const previous = await ProcessingWorkflow.findOne({ order_id }).sort({ cycle: -1 })
  const workflow = await ProcessingWorkflow.create({
    order_id,
    branch_id: order.branch_id,
    cycle: (previous?.cycle ?? 0) + 1,
    created_by: req.user.id,
    steps: steps.map((step, index) => ({
      name: step.name,
      employee_id: step.employee_id,
      sequence: index + 1,
    })),
  })
  order.status = 'processing'
  await order.save()

  const employeeById = new Map(employees.map((employee) => [employee._id.toString(), employee]))
  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
  await Promise.all(
    workflow.steps.map((step) => {
      const employee = employeeById.get(step.employee_id.toString());

      // Create notification for each step
      return createNotification({
        user_id: employee.user_id._id,
        order_id: order._id,
        type: 'task_assigned',
        message: `You were assigned “${step.name}” for ${reference}.`,
      })
    }),
  )
  await workflow.populate(workflowPopulate)
  return apiResponse(res, 201, workflow, 'Processing workflow created')
})

export const getWorkflows = asyncHandler(async (req, res) => {
  // Customer cannot access internal processing workflows
  if (req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot access internal processing workflows')
  }

  // Create a query object
  const query = {};

  // Employee can only view their own workflows
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ user_id: req.user.id })
    if (!employee) throw new ApiError(404, 'Employee record not found')
    query['steps.employee_id'] = employee._id
  } else if (req.user.role === 'branch_manager') {
    query.branch_id = req.user.branch_id
  } else if (req.query.branch_id) {
    query.branch_id = req.query.branch_id
  }

  // Get workflows and populate them
  const workflows = await ProcessingWorkflow.find(query)
    .populate(workflowPopulate)
    .sort({ createdAt: -1 });
  return apiResponse(res, 200, workflows, 'Processing workflows fetched')
})

// Get workflows for a specific order
export const getOrderWorkflows = asyncHandler(async (req, res) => {
    // Customer cannot access internal processing workflows
  if (req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot access internal processing workflows')
  }

  // Get the order
  const order = await Order.findById(req.params.orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  
  // Branch manager can only view workflows for their branch
  if (req.user.role === 'branch_manager' && req.user.branch_id !== order.branch_id.toString()) {
    throw new ApiError(403, 'You can only view workflows for your branch')
  }

  // Employee can only view workflows for their branch
  if (!order) throw new ApiError(404, 'Order not found')
  if (req.user.role === 'branch_manager' && req.user.branch_id !== order.branch_id.toString()) {
    throw new ApiError(403, 'You can only view workflows for your branch')
  }

  // Employee must be assigned to the order to view it
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ user_id: req.user.id })
    const assigned = employee ? await ProcessingWorkflow.exists({
        order_id: order._id,
        'steps.employee_id': employee._id,
      }) : false
    if (!assigned) throw new ApiError(403, 'You are not assigned to this order')
  }
  
  // Get workflows and populate them
  const workflows = await ProcessingWorkflow.find({ order_id: order._id })
    .populate(workflowPopulate)
    .sort({ cycle: -1 })
  return apiResponse(res, 200, workflows, 'Order workflows fetched')
})


// Update step status
export const updateStep = asyncHandler(async (req, res) => {
  // Get the workflow
  const workflow = await ProcessingWorkflow.findById(req.params.id)
  if (!workflow) throw new ApiError(404, 'Workflow not found')
  
  // Check if workflow is active
  if (workflow.status !== 'active') throw new ApiError(409, 'This workflow is no longer active')
  
  // Get the step
  const step = workflow.steps.id(req.params.stepId)
  if (!step) throw new ApiError(404, 'Workflow process not found')

  // Employee must be assigned to the step
  const employee = await Employee.findOne({ user_id: req.user.id })
  if (!employee || step.employee_id.toString() !== employee._id.toString()) {
    throw new ApiError(403, 'Only the assigned employee can update this process')
  }

  // Check if the previous process is completed
  const previousIncomplete = workflow.steps.some(
    (item) => item.sequence < step.sequence && item.status !== 'completed',
  )
  if (previousIncomplete) throw new ApiError(409, 'The previous process must be completed first')

  // Handle accept action
  if (req.body.action === 'accept' && step.status === 'assigned') {
    // Check if supplies are available
    if (SUPPLY_STAGES.includes(step.name)) {
      const approvedRequest = await SupplyRequest.exists({
        step_id: step._id,
        status: 'approved',
      })
      if (!approvedRequest) {
        throw new ApiError( 409, `Supplies for ${step.name} must be requested and approved by an inventory officer before you can start`)
      }
    }
    step.status = 'accepted'
    step.accepted_at = new Date()

    // Customer countdown starts when the attendant accepts their order
    const order = await Order.findById(workflow.order_id)
    if (!order.processing_started_at) {
      const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`
      await createNotification({
        user_id: order.customer_id,
        order_id: order._id,
        type: 'processing',
        message: `Your order ${reference} has started processing.`,
      })
      order.processing_started_at = new Date()
      await order.save()
    }
  } else if (req.body.action === 'complete' && step.status === 'accepted') {
    step.status = 'completed'
    step.completed_at = new Date()
  } else {
    throw new ApiError(409, 'That action is not valid for the current process status')
  }

  // if all steps are completed, update the workflow status and notify the branch manager
  if (workflow.steps.every((item) => item.status === 'completed')) {
    workflow.status = 'completed'
    const order = await Order.findById(workflow.order_id)
    order.status = 'quality_check'
    await order.save()

    const managers = await Employee.find({
      branch_id: order.branch_id,
      is_active: true,
    }).populate({
      path: 'user_id',
      match: { role: 'branch_manager', is_active: true },
      select: '_id',
    })

    // Create notification for branch manager
    const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`

    await Promise.all(
      managers
        .filter((manager) => manager.user_id)
        .map((manager) =>
          createNotification({
            user_id: manager.user_id._id,
            order_id: order._id,
            type: 'inspecting',
            message: `${reference} has completed processing and is ready for quality check.`,
          }),
        ),
    )
  }
  await workflow.save()
  await workflow.populate(workflowPopulate)
  return apiResponse(res, 200, workflow, 'Workflow process updated')
})

// review quality
export const reviewQuality = asyncHandler(async (req, res) => {
  const workflow = await ProcessingWorkflow.findById(req.params.id)
  if (!workflow) throw new ApiError(404, 'Workflow not found')
  await manageBranchWorkflow(req.user, workflow.branch_id)
  if (workflow.status !== 'completed') throw new ApiError(409, 'Processing is not complete')
  const order = await Order.findById(workflow.order_id)
  if (order.status !== 'quality_check')
    throw new ApiError(409, 'Order is not awaiting quality check')

  // handle pass or fail
  if (req.body.result === 'pass') {
    order.status = 'ready'
  } else if (req.body.result === 'fail') {
    workflow.status = 'qc_failed'
    workflow.qc_notes = req.body.notes || null
    order.status = 'processing'
  } else {
    throw new ApiError(400, 'Quality result must be pass or fail')
  }
  await workflow.save()
  await order.save()
  return apiResponse(res, 200, workflow, `Quality check ${req.body.result}ed`)
})