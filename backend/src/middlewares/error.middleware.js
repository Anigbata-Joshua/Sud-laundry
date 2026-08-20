// Shared foundation.
// Purpose: centralized error handler, returns consistent error responses.

import ApiError from '../utils/apiError.js';

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Log the error for developers (could expand to actual logging library later)
    console.error(`[Error] ${statusCode} - ${message}`);
    if (statusCode === 500) {
        console.error(err.stack);
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

export default errorHandler;
