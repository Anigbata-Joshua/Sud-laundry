import express from 'express';
import * as branchController from '../controllers/branch.controller.js';
import authenticate from '../middlewares/auth.middleware.js';
import { authorize, enforceBranchScope  } from '../middlewares/role.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createBranchSchema, updateBranchSchema } from '../validators/branch.validator.js';

const router = express.Router();

router.get('/', branchController.getAllBranches);
router.get('/:id', branchController.getBranchById);
router.post('/', authenticate, authorize('admin'), validate(createBranchSchema), branchController.createBranch);
router.delete('/:id', authenticate, authorize('admin'), branchController.deleteBranch);
router.put( '/:id', authenticate, authorize('admin', 'branch_manager'), enforceBranchScope, validate(updateBranchSchema), branchController.updateBranch );

export default router;