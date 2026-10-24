import { Router } from 'express'
import {
  createWorkflow,
  getOrderWorkflows,
  getWorkflows,
  reviewQuality,
  updateStep,
  reassignWorkflow,
  getAttendantsAvailability,
} from '../controllers/processingWorkflow.controller.js'
import authenticate from '../middlewares/auth.middleware.js'

const router = Router()
router.use(authenticate)
router.get('/', getWorkflows)
router.get('/order/:orderId', getOrderWorkflows)
router.get('/order/:orderId/attendants', getAttendantsAvailability)
router.get('/branch/:branchId/attendants', getAttendantsAvailability)
router.post('/', createWorkflow)
router.patch('/:id/steps/:stepId', updateStep)
router.patch('/:id/quality', reviewQuality)
router.post('/:id/reassign', reassignWorkflow)

export default router
