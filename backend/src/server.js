// Shared foundation.
// Purpose: server entry point — connects DB then starts listening.
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import errorHandler from './middlewares/errorHandler.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';

dotenv.config();

const app = express();
app.use(express.json());

connectDB();

app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3573;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});