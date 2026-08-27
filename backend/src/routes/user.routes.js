// Owner: Jasmine
// Purpose: /api/v1/users routes.

import { Router } from 'express';
import {
    getAllUsers,
    getUserById,
    deactivateUser,
    reactivateUser,
} from '../controllers/user.controller.js';
import  authenticate  from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/create', getAllUsers);
router.get('/:id/get/one', getUserById);
router.put('/:id/deactivate', deactivateUser);
router.put('/:id/reactivate', reactivateUser);

export default router;
