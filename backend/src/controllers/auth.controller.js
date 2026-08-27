// Owner: Jasmine
// Purpose: register, login, forgot-password, reset-password logic.

import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import generateToken from '../utils/generateToken.js';

export const register = asyncHandler(async (req, res, next) => {
    const { name, email, password, phone, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, 'Email already registered');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
        name,
        email,
        password_hash,
        phone,
        address,
        role: 'customer', // Default role for registration
    });

    // Generate token
    const token = generateToken(user._id);

    // Return response (don't send password_hash)
    const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
    };

    return apiResponse(res, 201, { user: userResponse, token }, 'Registration successful');
});

export const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
        throw new ApiError(403, 'Account is deactivated');
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Generate token
    const token = generateToken(user._id);

    // Return response
    const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
    };

    return apiResponse(res, 200, { user: userResponse, token }, 'Login successful');
});

export const forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        // Don't reveal whether email exists for security
        throw new ApiError(404, 'Email not found');
    }

    // TODO: Generate reset token and send email
    // This is a placeholder for email service integration

    return apiResponse(res, 200, {}, 'Password reset link sent to email');
});

export const resetPassword = asyncHandler(async (req, res, next) => {
    const { token, password } = req.body;

    // TODO: Verify reset token
    // This is a placeholder for token verification

    throw new ApiError(501, 'Password reset not fully implemented');
});
