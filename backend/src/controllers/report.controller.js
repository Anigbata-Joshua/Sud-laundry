// Owner: Series
// Purpose: reporting endpoints, branch-scoped for managers, company-wide for admin.


import { Parser } from 'json2csv';
import asyncHandler from '../utils/asyncHandler.js';
import apiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import {
    getRevenue,
    getPaymentMethodBreakdown,
    getRevenueComparison,
    getRevenueOverTime,
    getTopCustomers,
    getOrderVolume,
    getTopServices,
} from '../services/report.service.js';



const exportRevenueCSV = asyncHandler(async (req, res) => {
    const data = await getRevenueOverTime({ /* branch scoping applied here */ });
    const csv = new Parser().parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('revenue-report.csv');
    res.send(csv);
});



export const resolveBranchScope = (req) => {
    if (req.user.role === 'admin') {
        return req.query.branch_id || undefined;
    }
    if (req.user.role === 'branch_manager') {
        // Always their own branch — ignore any branch_id they might try to pass in query
        return req.user.branch_id;
    }
    throw new apiError(403, 'You do not have permission to view reports');
};

export const getRevenueReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { startDate, endDate } = req.query;

    const data = await getRevenue({ branch_id, startDate, endDate });
    apiResponse(res, 200, data, 'Revenue report retrieved successfully');
});

export const getPaymentMethodsReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { startDate, endDate } = req.query;

    const data = await getPaymentMethodBreakdown({ branch_id, startDate, endDate });
    apiResponse(res, 200, data, 'Payment method breakdown retrieved successfully');
});

export const getRevenueComparisonReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { currentStart, currentEnd, previousStart, previousEnd } = req.query;

    if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
        throw new apiError(400, 'currentStart, currentEnd, previousStart, previousEnd are all required');
    }

    const data = await getRevenueComparison({
        branch_id,
        currentRange: { startDate: currentStart, endDate: currentEnd },
        previousRange: { startDate: previousStart, endDate: previousEnd },
    });
    apiResponse(res, 200, data, 'Revenue comparison retrieved successfully');
});

export const getRevenueTrendReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { startDate, endDate } = req.query;

    const data = await getRevenueOverTime({ branch_id, startDate, endDate });
    apiResponse(res, 200, data, 'Revenue trend retrieved successfully');
});

export const getTopCustomersReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { startDate, endDate, limit } = req.query;

    const data = await getTopCustomers({ branch_id, startDate, endDate, limit: limit ? Number(limit) : undefined });
    apiResponse(res, 200, data, 'Top customers retrieved successfully');
});

export const getOrderVolumeReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { startDate, endDate } = req.query;

    const data = await getOrderVolume({ branch_id, startDate, endDate });
    apiResponse(res, 200, data, 'Order volume retrieved successfully');
});

export const getTopServicesReport = asyncHandler(async (req, res) => {
    const branch_id = resolveBranchScope(req);
    const { startDate, endDate, limit } = req.query;

    const data = await getTopServices({ branch_id, startDate, endDate, limit: limit ? Number(limit) : undefined });
    apiResponse(res, 200, data, 'Top services retrieved successfully');
});