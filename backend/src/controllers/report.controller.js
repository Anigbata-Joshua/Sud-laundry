import ApiError from "../utils/apiError.js";
import apiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  getBranchLeaderboard,
  getOrderVolume,
  getPaymentMethodBreakdown,
  getRevenue,
  getRevenueComparison,
  getRevenueOverTime,
  getTopCustomers,
  getTopServices,
} from "../services/report.service.js";

const scopedParams = (req) => {
  if (req.user.role === "branch_manager" && !req.user.branch_id) {
    throw new ApiError(403, "Branch manager is not assigned to a branch");
  }
  return {
    branch_id:
      req.user.role === "branch_manager"
        ? req.user.branch_id
        : req.query.branch_id,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  };
};

const report = (handler, message) =>
  asyncHandler(async (req, res) => {
    try {
      return apiResponse(res, 200, await handler(scopedParams(req)), message);
    } catch (error) {
      if (/date|requires/i.test(error.message))
        throw new ApiError(400, error.message);
      throw error;
    }
  });

export const getRevenueReport = report(
  getRevenue,
  "Revenue report retrieved successfully",
);
export const getPaymentMethodsReport = report(
  getPaymentMethodBreakdown,
  "Payment methods report retrieved successfully",
);
export const getRevenueTrendReport = report(
  getRevenueOverTime,
  "Revenue trend report retrieved successfully",
);
export const getTopCustomersReport = report(
  getTopCustomers,
  "Top customers report retrieved successfully",
);
export const getOrderVolumeReport = report(
  getOrderVolume,
  "Order volume report retrieved successfully",
);
export const getTopServicesReport = report(
  getTopServices,
  "Top services report retrieved successfully",
);

export const getRevenueComparisonReport = asyncHandler(async (req, res) => {
  try {
    const scope = scopedParams(req);
    const result = await getRevenueComparison({
      branch_id: scope.branch_id,
      currentRange: {
        startDate: req.query.currentStart,
        endDate: req.query.currentEnd,
      },
      previousRange: {
        startDate: req.query.previousStart,
        endDate: req.query.previousEnd,
      },
    });
    return apiResponse(
      res,
      200,
      result,
      "Revenue comparison report retrieved successfully",
    );
  } catch (error) {
    if (/date|requires/i.test(error.message))
      throw new ApiError(400, error.message);
    throw error;
  }
});

export const getBranchLeaderboardReport = asyncHandler(async (req, res) => {
  try {
    const result = await getBranchLeaderboard({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    return apiResponse(
      res,
      200,
      result,
      "Branch leaderboard retrieved successfully",
    );
  } catch (error) {
    if (/date|requires/i.test(error.message))
      throw new ApiError(400, error.message);
    throw error;
  }
});
