// Shared foundation.
// Purpose: verify session token, attach current user to the request.

import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import { env } from '../config/env.js';

export const authenticate = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            throw new ApiError(401, 'No token provided');
        }

        const decoded = jwt.verify(token, env.jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return next(new ApiError(401, 'Invalid token'));
        }
        if (error instanceof jwt.TokenExpiredError) {
            return next(new ApiError(401, 'Token expired'));
        }
        next(error);
    }
};

export default authenticate;
