import Employee from '../models/employee.model.js'
import Order from '../models/order.model.js'
import ProcessingWorkflow from '../models/processingWorkflow.model.js'
import createNotification from '../services/notification.service.js'
import ApiError from '../utils/apiError.js'
import apiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'

const workflowPopulate = [
  {
    path: 'order_id',
    populate: [
      { path: 'customer_id', select: 'name' },
      { path: 'branch_id', select: 'name' },
    ],
  },
  { path: 'branch_id', select: 'name' },
  { path: 'steps.employee_id', populate: { path: 'user_id', select: 'name email' } },
]

async function assertManagerScope(user, branchId) {
  if (!['admin', 'branch_manager'].includes(user.role)) {
    throw new ApiError(403, 'Only admins and branch managers can manage processing workflows')
  }
  if (user.role === 'branch_manager' && user.branch_id !== branchId.toString()) {
    throw new ApiError(403, 'You can only manage workflows for your branch')
  }
}

export const createWorkflow = asyncHandler(async (req, res) => {
  const { order_id, steps } = req.body
  const order = await Order.findById(order_id)
  if (!order) throw new ApiError(404, 'Order not found')
  await assertManagerScope(req.user, order.branch_id)
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
  const reference = `ORD-${order._id.toString().slice(-6).toUpperCase()}`
  await Promise.all(
    workflow.steps.map((step) => {
      const employee = employeeById.get(step.employee_id.toString())
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
  if (req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot access internal processing workflows')
  }
  const query = {}
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ user_id: req.user.id })
    if (!employee) throw new ApiError(404, 'Employee record not found')
    query['steps.employee_id'] = employee._id
  } else if (req.user.role === 'branch_manager') {
    query.branch_id = req.user.branch_id
  }
  const workflows = await ProcessingWorkflow.find(query)
    .populate(workflowPopulate)
    .sort({ createdAt: -1 })
  return apiResponse(res, 200, workflows, 'Processing workflows fetched')
})

export const getOrderWorkflows = asyncHandler(async (req, res) => {
  if (req.user.role === 'customer') {
    throw new ApiError(403, 'Customers cannot access internal processing workflows')
  }
  const order = await Order.findById(req.params.orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  if (req.user.role === 'branch_manager' && req.user.branch_id !== order.branch_id.toString()) {
    throw new ApiError(403, 'You can only view workflows for your branch')
  }
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ user_id: req.user.id })
    const assigned = employee
      ? await ProcessingWorkflow.exists({
          order_id: order._id,
          'steps.employee_id': employee._id,
        })
      : false
    if (!assigned) throw new ApiError(403, 'You are not assigned to this order')
  }
  const workflows = await ProcessingWorkflow.find({ order_id: order._id })
    .populate(workflowPopulate)
    .sort({ cycle: -1 })
  return apiResponse(res, 200, workflows, 'Order workflows fetched')
})

export const updateStep = asyncHandler(async (req, res) => {
  const workflow = await ProcessingWorkflow.findById(req.params.id)
  if (!workflow) throw new ApiError(404, 'Workflow not found')
  if (workflow.status !== 'active') throw new ApiError(409, 'This workflow is no longer active')
  const step = workflow.steps.id(req.params.stepId)
  if (!step) throw new ApiError(404, 'Workflow process not found')

  const employee = await Employee.findOne({ user_id: req.user.id })
  if (!employee || step.employee_id.toString() !== employee._id.toString()) {
    throw new ApiError(403, 'Only the assigned employee can update this process')
  }
  const previousIncomplete = workflow.steps.some(
    (item) => item.sequence < step.sequence && item.status !== 'completed',
  )
  if (previousIncomplete) throw new ApiError(409, 'The previous process must be completed first')

  if (req.body.action === 'accept' && step.status === 'assigned') {
    step.status = 'accepted'
    step.accepted_at = new Date()
  } else if (req.body.action === 'complete' && step.status === 'accepted') {
    step.status = 'completed'
    step.completed_at = new Date()
  } else {
    throw new ApiError(409, 'That action is not valid for the current process status')
  }

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

export const reviewQuality = asyncHandler(async (req, res) => {
  const workflow = await ProcessingWorkflow.findById(req.params.id)
  if (!workflow) throw new ApiError(404, 'Workflow not found')
  await assertManagerScope(req.user, workflow.branch_id)
  if (workflow.status !== 'completed') throw new ApiError(409, 'Processing is not complete')
  const order = await Order.findById(workflow.order_id)
  if (order.status !== 'quality_check')
    throw new ApiError(409, 'Order is not awaiting quality check')

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
