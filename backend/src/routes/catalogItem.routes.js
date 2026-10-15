// Owner: Josh
// Purpose: /api/v1/catalog-items routes.

import express from 'express';
import * as catalogItemController from '../controllers/catalogItem.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Public listing and detail
router.get('/', catalogItemController.getCatalogItems);
router.get('/:id', catalogItemController.getCatalogItemById);

// Admin-only copy across branches
router.post('/copy-from-branch', authenticate, authorize('admin'), catalogItemController.copyFromBranch);

// Management CRUD (admin or branch_manager)
router.post('/', authenticate, authorize('admin', 'branch_manager'), catalogItemController.createCatalogItem);
router.patch('/:id', authenticate, authorize('admin', 'branch_manager'), catalogItemController.updateCatalogItem);
router.delete('/:id', authenticate, authorize('admin', 'branch_manager'), catalogItemController.deleteCatalogItem);

export default router;
