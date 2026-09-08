// Owner: Josh
// Purpose: /api/v1/stock-movements routes.
import express from 'express';
import * as stockMovementController from '../controllers/stockMovement.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Staff/admin only — inventory movements are never customer-facing.
router.use(authenticate, authorize('admin', 'branch_manager', 'employee', 'inventory_officer'));

router.get('/', stockMovementController.getAllStock);
router.get('/:id', stockMovementController.getById);
router.post('/', stockMovementController.createStock);
router.patch('/:id', stockMovementController.updateStock);
router.delete('/:id', stockMovementController.removeStock);

export default router;