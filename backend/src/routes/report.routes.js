// Owner: Series
// Purpose: /api/v1/reports routes.


import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import roleMiddleware from '../middlewares/role.middleware.js';
import {
  getRevenueReport,
  getPaymentMethodsReport,
  getRevenueComparisonReport,
  getRevenueTrendReport,
  getTopCustomersReport,
  getOrderVolumeReport,
  getTopServicesReport,
} from '../controllers/report.controller.js';

const router = express.Router();

// Only admins and branch managers can view any reports at all
router.use(authMiddleware, roleMiddleware(['admin', 'branch_manager']));

router.get('/revenue', getRevenueReport);
router.get('/payment-methods', getPaymentMethodsReport);
router.get('/revenue-comparison', getRevenueComparisonReport);
router.get('/revenue-trend', getRevenueTrendReport);
router.get('/top-customers', getTopCustomersReport);
router.get('/order-volume', getOrderVolumeReport);
router.get('/top-services', getTopServicesReport);

export default router;