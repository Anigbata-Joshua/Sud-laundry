// Owner: Jasmine
// Purpose: /api/v1/employees routes.

import { Router } from 'express';
import {
    createEmployee,
    getEmployees,
    getEmployeeById,
    deleteEmployee,
    updateEmployee,
} from '../controllers/employee.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { enforceBranchScope } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

router.post('/', createEmployee);
router.get('/', getEmployees);
router.get('/:id', getEmployeeById);
router.patch('/:id', updateEmployee);

router.delete('/:id', deleteEmployee);
export default router;
