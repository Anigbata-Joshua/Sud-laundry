import { Router } from 'express'
import {
  createWorkflow,
  getOrderWorkflows,
  getWorkflows,
  reviewQuality,
  updateStep,
} from '../controllers/processingWorkflow.controller.js'
import authenticate from '../middlewares/auth.middleware.js'

const router = Router()
router.use(authenticate)
router.get('/', getWorkflows)
router.get('/order/:orderId', getOrderWorkflows)
router.post('/', createWorkflow)
router.patch('/:id/steps/:stepId', updateStep)
router.patch('/:id/quality', reviewQuality)

export default router
