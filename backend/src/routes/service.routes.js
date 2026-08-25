// Owner: Josh
// Purpose: /api/v1/services routes.
import express from 'express';
import * as serviceController from '../controllers/service.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', authenticate, authorize('admin'), serviceController.createService);
router.put('/:id', authenticate, authorize('admin'), serviceController.updateService);
router.delete('/:id', authenticate, authorize('admin'), serviceController.removeService);

export default router;