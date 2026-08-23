// Owner: Jasmine
// Purpose: /api/v1/employees routes.

import { Router } from 'express';
import {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
} from '../controllers/employee.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { branchScoped } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);
router.use(branchScoped);

router.post('/create', createEmployee);
router.get('/get/all', getEmployees);
router.get('/:id/get/one', getEmployeeById);
router.put('/:id/update', updateEmployee);

export default router;
