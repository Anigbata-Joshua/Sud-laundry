// Shared foundation.
// Purpose: role and branch-scope checks (RBAC).

import ApiError from '../utils/apiError.js';

/**
 * Authorize only specific user roles to access an endpoint.
 * Example: authorizeRoles('admin', 'branch_manager')
 */
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Authentication required'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ApiError(403, `Access denied: Role '${req.user.role}' is not authorized`));
        }
        next();
    };
};

export const authorize = authorizeRoles;

/**
 * Enforce branch-scoping logic for Branch Managers and Employees.
 * Admins bypass this. Users without a branch_id (unless Admin) are denied access.
 */
export const enforceBranchScope = (req, res, next) => {
    if (!req.user) {
        return next(new ApiError(401, 'Authentication required'));
    }

    // Admins have access to all branches
    if (req.user.role === 'admin') {
        return next();
    }

    // Non-admins must have a branch assignment
    if (!req.user.branch_id) {
        return next(new ApiError(403, 'Access denied: User is not assigned to any branch'));
    }

    next();
};
