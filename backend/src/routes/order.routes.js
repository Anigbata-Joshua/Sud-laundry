// Owner: Josh
// Purpose: /api/v1/orders routes.
import express from 'express';
import * as orderController from '../controllers/order.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();
// Public pricing config (e.g. express surcharge percent for order placement)
router.get('/pricing-config', orderController.getPricingConfig);

// All subsequent order routes require a logged-in user — no public access.
router.use(authenticate);

// Customer — own history, must come before /:id so 'me' isn't parsed as an ObjectId
router.get('/me', orderController.getMyOrders);

// Customer — place an order
router.post('/', orderController.createOrder);

// Staff/admin — branch-scoped list (admin sees all branches)
router.get( '/', authorize('admin', 'branch_manager', 'employee', 'front_desk'), orderController.getAllOrders);

// Shared — customer (own order) or staff/admin (branch-scoped), checked inside the controller
router.get('/:id', orderController.getOrderById);
router.patch('/:id/pickup', authorize('customer', 'admin', 'branch_manager', 'front_desk'), orderController.confirmPickup);
router.patch('/:id/send-out', authorize('admin', 'branch_manager', 'front_desk'), orderController.sendOutOrder);

// Shared — customer cancellation or staff/admin update, both branch/ownership-checked inside the controller
router.patch('/:id', orderController.updateOrder);

// Staff/admin only — force-cancel an order that's already 'placed' or 'processing'
router.patch( '/:id/force-cancel', authorize('admin', 'branch_manager'), orderController.forceCancelOrder);

export default router
