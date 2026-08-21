// Shared foundation.
// Purpose: verify session token, attach current user to the request.

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const authMiddleware = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new ApiError(401, 'Not authorized, token missing');
    }

    try {
        const decoded = jwt.verify(token, env.jwtSecret);
        // Attach user info (id, role, branch_id) from token payload to request object
        req.user = {
            id: decoded.id,
            role: decoded.role,
            branch_id: decoded.branch_id
        };
        next();
    } catch (error) {
        throw new ApiError(401, 'Not authorized, token invalid or expired');
    }
});

export default authMiddleware;
