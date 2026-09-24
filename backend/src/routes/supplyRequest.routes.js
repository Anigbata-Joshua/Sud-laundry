// Owner: Josh
// Purpose: /api/v1/supply-requests routes.

import express from 'express'
import authenticate from '../middlewares/auth.middleware.js'
import { authorize } from '../middlewares/role.middleware.js'
import {
  createRequest,
  listRequests,
  getOrderRequests,
  approveRequest,
  rejectRequest,
} from '../controllers/supplyRequest.controller.js'

const router = express.Router()

router.use(authenticate)

router.post('/', authorize('employee'), createRequest)
router.get('/', authorize('admin', 'branch_manager', 'inventory_officer', 'inventory_manager'), listRequests)
router.get('/order/:orderId', authorize('admin', 'branch_manager', 'inventory_officer', 'inventory_manager'), getOrderRequests)
router.patch('/:id/approve', authorize('admin', 'inventory_officer', 'inventory_manager'), approveRequest)
router.patch('/:id/reject', authorize('admin', 'inventory_officer', 'inventory_manager'), rejectRequest)

export default router