// Owner: Series
// Purpose: /api/v1/suppliers routes.


import express from 'express';
import {authMiddleware, roleMiddleware} from '../middlewares/auth.middleware.js';

import {  createSupplier,  getSuppliers,  getSupplierById,  updateSupplier,  deleteSupplier,} from '../controllers/supplier.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import roleMiddleware from '../middlewares/role.middleware.js';

const router = express.Router();

router.use(authMiddleware, roleMiddleware(['admin'])); // everything below is admin-only

router.post('/', createSupplier);
router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;