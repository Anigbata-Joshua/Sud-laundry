// Owner: Jasmine
// Purpose: register, login, forgot-password, reset-password logic.

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import generateToken from '../utils/generateToken.js';
import { env } from '../config/env.js';
import sendMail from '../services/email.service.js';

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

    // Retrieve branch_id if user is employee or branch_manager to include in JWT
    let branch_id = undefined;
    if (['employee', 'branch_manager'].includes(user.role)) {
        const employee = await Employee.findOne({ user_id: user._id });
        if (employee) {
            branch_id = employee.branch_id.toString();
        }
    }

    // Generate token
    const token = generateToken(user._id, branch_id ? { branch_id } : {});

    // Return response
    const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        branch_id: branch_id ?? null,
    };

    return apiResponse(res, 200, { user: userResponse, token }, 'Login successful');
});

export const forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, 'Invalid email address or password provided');
    }

    // Generate cryptographically secure token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token and store with 1-hour expiry
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Call mock email service to output URL to console for testing
    const resetUrl = `${env.frontendURI}/reset-password?token=${resetToken}`;
    const emailMessage = `You requested a password reset. Please perform a POST/PATCH request or use this URL: ${resetUrl}`;

    await sendMail({
        to: user.email,
        subject: 'Laundry App - Password Reset Request',
        text: emailMessage
    });

    return apiResponse(res, 200, {}, 'Password reset link sent to email');
});

export const resetPassword = asyncHandler(async (req, res, next) => {
    const token = req.body?.token || req.query?.token;
    const { password } = req.body;

    if (!token || !password) {
        throw new ApiError(400, 'Token and new password are required');
    }

    // Hash the query token to compare with database value
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching active token
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, 'Password reset token is invalid or has expired');
    }

    // Hash and update the password
    user.password_hash = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return apiResponse(res, 200, {}, 'Password reset successful');
});
