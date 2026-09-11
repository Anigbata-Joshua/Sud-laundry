import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/db.js';
import app from './app.js';
import './jobs/lowStockCheck.job.js';

// Global Uncaught Error Listeners
const handleFatalError = async (err, type) => {
    console.error(`❌ ${type}! Shutting down gracefully...`, err);
    try {
        await closeDatabase();
    } catch (dbErr) {
        console.error('Failed to close DB on crash:', dbErr.message);
    }
    process.exit(1);
};

process.on('uncaughtException', (err) => handleFatalError(err, 'UNCAUGHT EXCEPTION'));
process.on('unhandledRejection', (err) => handleFatalError(err, 'UNHANDLED REJECTION'));

// Connect to database
await connectDatabase();

const PORT = env.port;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${env.nodeEnv}`);
    console.log(`🌐 Frontend URI: ${env.frontendURI}`);
    console.log(`📧 Email service: ${env.useMockEmail ? 'MOCK' : 'Resend'} (from: ${env.resendFromDomain})`);
    if (env.corsOrigins.length > 0) {
        console.log(`🔗 CORS Origins: ${env.corsOrigins.join(', ')}`);
    }
});

// Graceful shutdown — handles both a local Ctrl+C (SIGINT) and a
// hosting platform's stop/restart signal (SIGTERM).
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    try {
        await closeDatabase();
    } catch (dbErr) {
        console.error('Error closing database during shutdown:', dbErr.message);
    }
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));