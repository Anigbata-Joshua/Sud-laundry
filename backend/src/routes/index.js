// Shared file — HIGH conflict risk. See guides/ for the rule on editing this file.
// Purpose: mounts every module route under /api/v1.

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import employeeRoutes from './employee.routes.js';
import leaveRequestRoutes from './leaveRequest.routes.js';
import taskRoutes from './task.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

// Auth routes (public)
router.use('/auth', authRoutes);

// Protected routes
router.use('/employees', employeeRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/tasks', taskRoutes);
router.use('/users', userRoutes);

export default router;
