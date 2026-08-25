// Shared foundation.
// Purpose: validate request bodies against a schema before reaching a controller.

import ApiError from '../utils/apiError.js';

/**
 * Validates the incoming request using a Zod schema.
 * Supports validating structured schemas containing { body, query, params }
 * or simple schemas applied directly to req.body.
 */
const validate = (schema) => (req, res, next) => {
    try {
        if (schema.shape && (schema.shape.body || schema.shape.query || schema.shape.params)) {
            const parsed = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            if (parsed.body) req.body = parsed.body;
            if (parsed.query) req.query = parsed.query;
            if (parsed.params) req.params = parsed.params;
        } else {
            req.body = schema.parse(req.body);
        }
        next();
    } catch (error) {
        if (error.errors) {
            const errorMessage = error.errors
                .map((err) => `${err.path.join('.')}: ${err.message}`)
                .join(', ');
            return next(new ApiError(400, errorMessage));
        }
        return next(new ApiError(400, error.message || 'Validation error'));
    }
};

export default validate;
