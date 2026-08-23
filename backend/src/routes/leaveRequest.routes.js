// Owner: Jasmine
// Purpose: /api/v1/leave-requests routes.

import { Router } from 'express';
import {
    submitLeaveRequest,
    getLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
} from '../controllers/leaveRequest.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/', submitLeaveRequest);
router.get('/', getLeaveRequests);
router.put('/:id/approve', approveLeaveRequest);
router.put('/:id/reject', rejectLeaveRequest);

export default router;
