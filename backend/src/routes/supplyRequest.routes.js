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
router.get('/', authorize('admin', 'branch_manager', 'inventory_officer'), listRequests)
router.get('/order/:orderId', authorize('admin', 'branch_manager', 'inventory_officer'), getOrderRequests)
router.patch('/:id/approve', authorize('admin', 'inventory_officer'), approveRequest)
router.patch('/:id/reject', authorize('admin', 'inventory_officer'), rejectRequest)

export default router