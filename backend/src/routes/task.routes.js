// Owner: Jasmine
// Purpose: /api/v1/tasks routes.

import { Router } from 'express';
import {
    createTask,
    getEmployeeTasks,
    getTaskById,
    updateTaskStatus,
} from '../controllers/task.controller.js';
import  authenticate  from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/create', createTask);
router.get('/get/all', getEmployeeTasks);
router.get('/:id/get/one', getTaskById);
router.put('/:id/update', updateTaskStatus);

export default router;
