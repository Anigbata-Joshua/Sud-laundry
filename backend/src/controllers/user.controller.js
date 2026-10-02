// Owner: Jasmine
// Purpose: admin-level user management (view, deactivate accounts).

import User from '../models/user.model.js'
import ApiError from '../utils/apiError.js'
import apiResponse from '../utils/apiResponse.js'
import asyncHandler from '../utils/asyncHandler.js'
import { getUserBranchId } from '../utils/getUserBranchId.js'

export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password_hash')
  if (!user) throw new ApiError(404, 'User not found')
  const branch_id = await getUserBranchId(user)
  return apiResponse(res, 200, { ...user.toObject(), branch_id }, 'Profile retrieved successfully')
})

export const getAllUsers = asyncHandler(async (req, res) => {
  const currentUser = req.user

  // Only admins can view all users
  if (currentUser.role !== 'admin') {
    throw new ApiError(403, 'Only admins can view user list')
  }

  const users = await User.find({}).select('-password_hash').sort({ createdAt: -1 })

  return apiResponse(res, 200, users, 'Users retrieved successfully')
})

export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const currentUser = req.user

  // Only admins can view user details
  if (currentUser.role !== 'admin') {
    throw new ApiError(403, 'Only admins can view user details')
  }

  const user = await User.findById(id).select('-password_hash')
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  return apiResponse(res, 200, user, 'User retrieved successfully')
})

export const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params
  const currentUser = req.user

  // Only admins can deactivate users
  if (currentUser.role !== 'admin') {
    throw new ApiError(403, 'Only admins can deactivate users')
  }

  const user = await User.findById(id)
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  // Prevent deactivating self
  if (user._id.toString() === currentUser.id) {
    throw new ApiError(400, 'You cannot deactivate your own account')
  }

  user.is_active = false
  await user.save()

  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  }

  return apiResponse(res, 200, userResponse, 'User deactivated successfully')
})

export const reactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params
  const currentUser = req.user

  // Only admins can reactivate users
  if (currentUser.role !== 'admin') {
    throw new ApiError(403, 'Only admins can reactivate users')
  }

  const user = await User.findById(id)
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  user.is_active = true
  await user.save()

  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  }

  return apiResponse(res, 200, userResponse, 'User reactivated successfully')
})

export const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, email, phone, address } = req.body

  if (name !== undefined && name.trim().length < 2) {
    throw new ApiError(400, 'Name must contain at least 2 characters')
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase()
    const emailOwner = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.user.id },
    })
    if (emailOwner) throw new ApiError(409, 'Email is already in use')
  }

  const updates = {}
  if (name !== undefined) updates.name = name.trim()
  if (email !== undefined) updates.email = email.trim().toLowerCase()
  if (phone !== undefined) updates.phone = phone.trim() || null
  if (address !== undefined) updates.address = address.trim() || null

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  }).select('-password_hash')

  if (!user) throw new ApiError(404, 'User not found')

  const branch_id = await getUserBranchId(user)
  return apiResponse(res, 200, { ...user.toObject(), branch_id }, 'Profile updated successfully')
})
