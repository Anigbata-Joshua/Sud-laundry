// Shared foundation.
// Purpose: validate request bodies against a schema before reaching a controller.

import ApiError from '../utils/apiError.js';

export const validate = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.body);
            req.body = validated;
            next();
        } catch (error) {
            const message = error.errors?.[0]?.message || error.message;
            next(new ApiError(400, message));
        }
    };
};

export default validate;
