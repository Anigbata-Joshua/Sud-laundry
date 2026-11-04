// Owner: Josh
// Purpose: /api/v1/products routes.
import express from 'express';
import * as productController from '../controllers/product.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// All product/inventory routes require staff or admin — never public, never customer.
router.use(authenticate, authorize('admin', 'branch_manager', 'employee', 'inventory_officer', 'front_desk'));

router.get('/', productController.getAllProducts);
// Needs-attention route must be registered BEFORE /:id
router.get('/needs-attention', productController.getProductsNeedingAttention);
router.get('/:id', productController.getProductById);
router.post('/', authorize('admin', 'branch_manager', 'inventory_officer'), productController.createProduct);
router.patch('/:id', authorize('admin', 'branch_manager', 'inventory_officer'), productController.updateProduct);
router.delete('/:id', authorize('admin', 'branch_manager', 'inventory_officer'), productController.deleteProduct);

export default router;
