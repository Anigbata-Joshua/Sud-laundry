// Owner: Series
// Purpose: /api/v1/reports routes.

import express from "express";
import authenticate from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import {
  getRevenueReport,
  getPaymentMethodsReport,
  getRevenueComparisonReport,
  getRevenueTrendReport,
  getTopCustomersReport,
  getOrderVolumeReport,
  getTopServicesReport,
  getBranchLeaderboardReport,
} from "../controllers/report.controller.js";

const router = express.Router();

// Only admins and branch managers can view any reports at all
router.use(authenticate, authorize("admin", "branch_manager"));

router.get("/revenue", getRevenueReport);
router.get("/payment-methods", getPaymentMethodsReport);
router.get("/revenue-comparison", getRevenueComparisonReport);
router.get("/revenue-trend", getRevenueTrendReport);
router.get("/top-customers", getTopCustomersReport);
router.get("/order-volume", getOrderVolumeReport);
router.get("/top-services", getTopServicesReport);
router.get(
  "/branch-leaderboard",
  authorize("admin"),
  getBranchLeaderboardReport,
);

export default router;
