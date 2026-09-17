// Shared foundation.
// Purpose: centralized error handler, returns consistent error responses.

import { env } from '../config/env.js';
import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Structured error logging
    logger.error(`[API Error] ${req.method} ${req.originalUrl || req.url} -> Status ${statusCode}: ${err.message}`, {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode,
        stack: err.stack,
    });

    // Mongoose bad ObjectId (e.g. malformed :id in a route param)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // Mongoose validation errors (schema `required`, `enum`, etc.)
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map((val) => val.message).join(', ');
    }

    // Mongoose duplicate key error (e.g. unique email)
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue)[0];
        message = `Duplicate value for field: ${field}`;
    }

    res.status(statusCode).json({
        success: false,
        message,
        // Only expose the stack trace in development, never in production
        ...(env.isProduction ? {} : { stack: err.stack }),
    });
};

export default errorHandler;
