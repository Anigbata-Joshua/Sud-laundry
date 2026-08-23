// Shared foundation.
// Purpose: role and branch-scope checks (RBAC).

import ApiError from '../utils/apiError.js';

export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'User not authenticated'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ApiError(403, 'Insufficient permissions'));
        }

        next();
    };
};

export const branchScoped = (req, res, next) => {
    if (!req.user) {
        return next(new ApiError(401, 'User not authenticated'));
    }

    if (req.user.role === 'admin') {
        // Admins can access all branches
        next();
    } else if (req.user.branchId) {
        // Other users can only access their own branch
        req.branchId = req.user.branchId;
        next();
    } else {
        return next(new ApiError(403, 'No branch assigned'));
    }
};

export default { authorize, branchScoped };
