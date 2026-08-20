// Shared foundation.
// Purpose: Express app setup — middleware pipeline and route mounting.

import express from 'express';
import errorHandler from './middlewares/error.middleware.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const app = express();

app.use(express.json());

app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(errorHandler);

export default app;