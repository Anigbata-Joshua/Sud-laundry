import { Router } from 'express'
import {
  deactivateUser,
  getAllUsers,
  getUserById,
  reactivateUser,
  updateMyProfile,
  getMyProfile,
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
router.get('/create', getAllUsers)
router.post('/', createUser)
router.get('/:id/customer-report', getCustomerReport)
router.get('/:id/get/one', getUserById)
router.patch('/:id', updateUser)
router.delete('/:id', deleteUser)
router.put('/:id/deactivate', deactivateUser)
router.put('/:id/reactivate', reactivateUser)

export default router
