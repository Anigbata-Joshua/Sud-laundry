// Owner: Series
// Purpose: /api/v1/payments routes.

import express from 'express'
import authenticate from '../middlewares/auth.middleware.js'
import { authorize } from '../middlewares/role.middleware.js'
import {
  initializePayment,
  makePayment,
  getPaymentByOrder,
  listPayments,
  refundPayment,
} from '../controllers/payment.controller.js'

const router = express.Router()

router.post('/initialize', authenticate, initializePayment)
router.post('/', authenticate, makePayment)
router.post('/:id/refund', authenticate, refundPayment)
router.get('/order/:orderId', authenticate, getPaymentByOrder)
router.get('/', authenticate, authorize('admin', 'branch_manager'), listPayments)

export default router
