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

// Admin, Branch Manager, and Front Desk can query users (non-admins scoped to customers)
router.get('/', authorize('admin', 'branch_manager', 'front_desk'), getAllUsers)

// Admin-only user management routes
router.use(authorize('admin'))

router.post('/', createUser)
router.get('/:id/customer-report', getCustomerReport)
router.get('/:id', getUserById)
router.patch('/:id', updateUser)
router.delete('/:id', deleteUser)
router.patch('/:id/deactivate', deactivateUser)
router.patch('/:id/reactivate', reactivateUser)

export default router
