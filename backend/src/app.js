// Shared foundation.
// Purpose: Express app setup — middleware pipeline and route mounting.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import { apiLimiter } from './middlewares/rateLimiter.middleware.js';
import errorHandler from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import leaveRequestRoutes from './routes/leaveRequest.routes.js';
import taskRoutes from './routes/task.routes.js';
import userRoutes from './routes/user.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import brancheRoutes from './routes/branch.routes.js';
import serviceRoutes from './routes/service.routes.js';
import orderRoutes from './routes/order.routes.js';
import productRoutes from './routes/product.routes.js';

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/leave-requests', leaveRequestRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/branches', brancheRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/products', productRoutes);
// TODO: mount stockMovementRoutes once stockMovement.routes.js exists

// Global Error Handler
app.use(errorHandler);

export default app;