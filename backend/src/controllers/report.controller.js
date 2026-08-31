// Owner: Series
// Purpose: initialize, verify, and record payments.
// Payment amounts are always validated against the order total on the server.
import Order from '../models/order.model.js';
import Payment from '../models/payment.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
const getBranchFilter = (req) => {
    if (req.user.role === 'branch_manager') {
        if (!req.user.branch_id) {
            throw new ApiError(403, 'Branch manager is not assigned to a branch');
        }
        return { branch_id: req.user.branch_id };
    }

    return {};
};


// Revenue
export const getRevenueReport = asyncHandler(async (req, res) => {
    const filter = getBranchFilter(req);
    const result = await Order.aggregate([
        { $match: { ...filter, payment_status: 'paid', }, },
        { $group: { _id: 0, totalRevenue: { $sum: '$amount_due' }, totalOrders: { $sum: 1 }, }, },
        { $project: { _id: 0, totalRevenue: 1, totalOrders: 1, }, },
    ]);

    const report = result[0] || { totalRevenue: 0, totalOrders: 0 };
    return apiResponse(res, 200, report, 'Revenue report retrieved successfully');
});


// Payment methods
export const getPaymentMethodsReport = asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);

    const orders = await Order.find(branchFilter).select('_id');

    const orderIds = orders.map(order => order._id);

    const result = await Payment.aggregate([
        { $match: { orderId: { $in: orderIds }, status: 'completed', }, },
        { $group: { _id: '$paymentMethod', totalAmount: { $sum: '$amount' }, transactionCount: { $sum: 1 }, }, },
        { $sort: { totalAmount: -1 }, },
    ]);

    return apiResponse(res, 200, result, 'Payment methods report retrieved successfully');
});


// Revenue comparison
export const getRevenueComparisonReport = asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);

    const result = await Order.aggregate([
        { $match: { ...branchFilter, payment_status: 'paid', }, },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, }, revenue: { $sum: '$amount_due' }, orders: { $sum: 1 }, }, },
        { $sort: { '_id.year': 1, '_id.month': 1, }, },
    ]);

    return apiResponse(res, 200, result, 'Revenue comparison report retrieved successfully');
});


// Revenue trend
export const getRevenueTrendReport = asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);

    const result = await Order.aggregate([
        { $match: { ...branchFilter, payment_status: 'paid', }, },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' }, }, revenue: { $sum: '$amount_due' }, orders: { $sum: 1 }, }, },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, }, },
    ]);

    return apiResponse(res, 200, result, 'Revenue trend report retrieved successfully');
});


// Top customers
export const getTopCustomersReport = asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);

    const result = await Order.aggregate([
        { $match: { ...branchFilter, payment_status: 'paid', }, },
        { $group: { _id: '$customer_id', totalSpent: { $sum: '$amount_due' }, orderCount: { $sum: 1 }, }, },
        { $sort: { totalSpent: -1, } },
        { $limit: 10, },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'customer', }, },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true, }, },
        { $project: { _id: 1, name: '$customer.name', email: '$customer.email', totalSpent: 1, orderCount: 1, }, },
    ]);

    return apiResponse(res, 200, result, 'Top customers report retrieved successfully');
});


// Order volume
export const getOrderVolumeReport = asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);

    const result = await Order.aggregate([
        { $match: branchFilter, },
        { $group: { _id: '$status', count: { $sum: 1 }, }, },
        { $sort: { count: -1, }, },
    ]);

    return apiResponse(res, 200, result, 'Order volume report retrieved successfully');
});


// Top services
export const getTopServicesReport = asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);

    const result = await Order.aggregate([
        { $match: branchFilter, },
        { $unwind: '$items', },
        { $group: { _id: '$items.service_id', name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' }, }, },
        { $sort: { quantity: -1, }, },
        { $limit: 10, },
    ]);

    return apiResponse(res, 200, result,
        'Top services report retrieved successfully'
    );
});