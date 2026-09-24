import express from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import * as controller from '../controllers/serviceCategory.controller.js';

const router = express.Router();
router.get('/', controller.listCategories);
router.use(authenticate, authorize('admin', 'branch_manager'));
router.post('/', controller.createCategory);
router.patch('/:id', controller.updateCategory);
router.delete('/:id', controller.deactivateCategory);
export default router;
