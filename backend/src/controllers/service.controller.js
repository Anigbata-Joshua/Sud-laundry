import Service from '../models/service.model.js'
import asyncHandler from '../utils/asyncHandler.js'
import ApiError from '../utils/apiError.js'
import apiResponse from '../utils/apiResponse.js'

const serviceFields = 'name category price available_branch_ids branch_id'

function normalizeBranches(body) {
  if (Array.isArray(body.available_branch_ids)) return [...new Set(body.available_branch_ids)]
  if (body.branch_id) return [body.branch_id]
  return []
}

export const getAllServices = asyncHandler(async (req, res) => {
  const filter = req.query.branch_id
    ? {
        $or: [{ available_branch_ids: req.query.branch_id }, { branch_id: req.query.branch_id }],
      }
    : {}
  const services = await Service.find(filter)
    .select(serviceFields)
    .populate('available_branch_ids', 'name')
    .populate('branch_id', 'name')
    .sort({ name: 1 })
  return apiResponse(res, 200, services, 'Service list fetched successfully')
})

export const getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id)
    .select(serviceFields)
    .populate('available_branch_ids', 'name')
    .populate('branch_id', 'name')
  if (!service) throw new ApiError(404, 'No service found')
  return apiResponse(res, 200, service, 'Service detail retrieved successfully')
})

export const createService = asyncHandler(async (req, res) => {
  const { name, category, price } = req.body
  if (!name || price === undefined) throw new ApiError(400, 'name and price are required')
  if (await Service.findOne({ name: name.trim() }).collation({ locale: 'en', strength: 2 })) {
    throw new ApiError(409, 'A service with this name already exists')
  }
  const service = await Service.create({
    name,
    category,
    price,
    available_branch_ids: normalizeBranches(req.body),
  })
  await service.populate('available_branch_ids', 'name')
  return apiResponse(res, 201, service, 'Service created successfully')
})

export const updateService = asyncHandler(async (req, res) => {
  const { name, category, price } = req.body
  const service = await Service.findById(req.params.id)
  if (!service) throw new ApiError(404, 'Service not found')

  if (name !== undefined && name.trim().toLowerCase() !== service.name.toLowerCase()) {
    const duplicate = await Service.findOne({ name: name.trim() }).collation({
      locale: 'en',
      strength: 2,
    })
    if (duplicate) throw new ApiError(409, 'A service with this name already exists')
  }

  if (name !== undefined) service.name = name
  if (category !== undefined) service.category = category
  if (price !== undefined) service.price = price
  if (req.body.available_branch_ids !== undefined || req.body.branch_id !== undefined) {
    service.available_branch_ids = normalizeBranches(req.body)
    service.branch_id = undefined
  }
  await service.save()
  await service.populate('available_branch_ids', 'name')
  return apiResponse(res, 200, service, 'Service updated successfully')
})

export const removeService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndDelete(req.params.id)
  if (!service) throw new ApiError(404, 'Service not found')
  return apiResponse(res, 200, service, 'Service deleted successfully')
})
