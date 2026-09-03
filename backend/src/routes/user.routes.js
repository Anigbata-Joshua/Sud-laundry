// Owner: Jasmine
// Purpose: /api/v1/users routes.

import { Router } from 'express'
import {
  getAllUsers,
  getUserById,
  deactivateUser,
  reactivateUser,
  getMyProfile,
  updateMyProfile,
} from '../controllers/user.controller.js'
import {
  createUser,
  deleteUser,
  getCustomerReport,
  updateUser,
} from '../controllers/adminUser.controller.js'
import authenticate from '../middlewares/auth.middleware.js'
import { authorize } from '../middlewares/role.middleware.js'

const router = Router()

router.use(authenticate)
router.get('/me', getMyProfile)
router.patch('/me', updateMyProfile)
router.use(authorize('admin'))

router.get('/', getAllUsers)
router.post('/', createUser)
router.get('/:id/customer-report', getCustomerReport)
router.get('/:id', getUserById)
router.patch('/:id', updateUser)
router.delete('/:id', deleteUser)
router.patch('/:id/deactivate', deactivateUser)
router.patch('/:id/reactivate', reactivateUser)

export default router
