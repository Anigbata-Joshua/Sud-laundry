import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/db.js';
import app from './app.js';
import logger from './utils/logger.js';
import './jobs/lowStockCheck.job.js';

// Server entry point

// Global Uncaught Error Listeners
const handleFatalError = async (err, type) => {
    logger.error(`❌ ${type}! Shutting down gracefully...`, { error: err.message, stack: err.stack });
    try {
        await closeDatabase();
    } catch (dbErr) {
        logger.error('Failed to close DB on crash:', { error: dbErr.message });
    }
    process.exit(1);
};

process.on('uncaughtException', (err) => handleFatalError(err, 'UNCAUGHT EXCEPTION'));
process.on('unhandledRejection', (err) => handleFatalError(err, 'UNHANDLED REJECTION'));

// Connect to database
await connectDatabase();

const PORT = env.port;
const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`📦 Environment: ${env.nodeEnv}`);
    logger.info(`🌐 Frontend URI: ${env.frontendURI}`);
    logger.info(`📧 Email service: ${env.useMockEmail ? 'MOCK' : 'Resend'} (from: ${env.resendFromDomain})`);
    if (env.corsOrigins.length > 0) {
        logger.info(`🔗 CORS Origins: ${env.corsOrigins.join(', ')}`);
    }
});

// Graceful shutdown — handles both a local Ctrl+C (SIGINT) and a
// hosting platform's stop/restart signal (SIGTERM).
const gracefulShutdown = async (signal) => {
    logger.info(`🛑 Received ${signal}. Shutting down gracefully...`);
    try {
        await closeDatabase();
    } catch (dbErr) {
        logger.error('Error closing database during shutdown:', { error: dbErr.message });
    }
    server.close(() => {
        logger.info('✅ Server closed');
        process.exit(0);
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));