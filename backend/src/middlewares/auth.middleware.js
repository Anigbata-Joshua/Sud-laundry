// Shared foundation.
// Purpose: verify session token, attach current user to the request.

import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { AUTH_COOKIE_NAME } from '../utils/generateToken.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';

const authMiddleware = asyncHandler(async (req, res, next) => {
    let token;

    // Browser clients: httpOnly cookie (can't be read/stolen by JS).
    if (req.cookies?.[AUTH_COOKIE_NAME]) {
        token = req.cookies[AUTH_COOKIE_NAME];
    }
    // Non-browser clients (Postman, mobile, server-to-server): Bearer header.
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new ApiError(401, 'Not authorized, token missing');
    }

    let decoded;

    try {
        decoded = jwt.verify(token, env.jwtSecret);
    } catch (error) {
        throw new ApiError(401, 'Not authorized, token invalid or expired');
    }

    const user = await User.findById(decoded.id).select('-password_hash');

    if (!user) {
        throw new ApiError(401, 'User no longer exists');
    }

    if (!user.is_active) {
        throw new ApiError(403, 'Account is deactivated');
    }

    req.user = {
        id: user._id.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
    };

    // Attach branch context for staff roles
    if (['employee', 'branch_manager', 'front_desk', 'inventory_officer'].includes(user.role)) {
        const employee = await Employee.findOne({ user_id: user._id });

        if (!employee || !employee.branch_id || !employee.is_active) {
        throw new ApiError(403, 'Staff account is not associated with any branch');
        }

        req.user.branch_id = employee.branch_id.toString();
    }
    next();
});

export default authMiddleware;
