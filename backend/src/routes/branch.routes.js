// Owner: Josh
// Purpose: /api/v1/branches routes.
import express from 'express';
import * as branchController from '../controllers/branch.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize, enforceBranchScope  } from '../middlewares/role.middleware.js';

const router = express.Router();

router.get('/', branchController.getAllBranches);
router.get('/:id', branchController.getBranchById);
router.post('/', authenticate, authorize('admin'), branchController.createBranch);
router.delete('/:id', authenticate, authorize('admin'), branchController.deleteBranch);
router.put( '/:id', authenticate, authorize('admin', 'branch_manager'), enforceBranchScope , branchController.updateBranch );

export default router;