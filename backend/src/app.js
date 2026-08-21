// Shared foundation.
// Purpose: Express app setup — middleware pipeline and route mounting.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import { apiLimiter } from './middlewares/rateLimiter.middleware.js';
import errorHandler from './middlewares/error.middleware.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const app = express();

// Security & core middleware
app.use(helmet());
app.use(cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : env.frontendURI,
    credentials: true,
}));
app.use(express.json());

// Health check — placed BEFORE rate limiters so monitoring/uptime pings
// can never be blocked by rate limiting, regardless of frequency.
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Laundry App API is running!',
        environment: env.nodeEnv,
        isProduction: env.isProduction,
    });
});

// General rate limiter — applies broadly across the whole API
app.use('/api', apiLimiter);

// Routes
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;