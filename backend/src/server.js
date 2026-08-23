// Shared foundation.
// Purpose: server entry point — connects DB then starts listening.

import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start listening
        app.listen(env.port, () => {
            console.log(`✓ Server running on http://localhost:${env.port}`);
        });
    } catch (error) {
        console.error('✗ Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
