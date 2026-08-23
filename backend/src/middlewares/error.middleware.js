// Shared foundation.
// Purpose: centralized error handler, returns consistent error responses.

import ApiError from '../utils/apiError.js';

export const errorHandler = (error, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (error instanceof ApiError) {
        statusCode = error.statusCode;
        message = error.message;
    } else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = error.message;
    }

    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
};

export default errorHandler;
