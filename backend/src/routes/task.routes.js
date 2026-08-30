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

router.post('/', createTask);
router.get('/', getEmployeeTasks);
router.get('/:id', getTaskById);
router.patch('/:id', updateTaskStatus);

export default router;
