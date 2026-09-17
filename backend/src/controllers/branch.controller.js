// Owner: Josh
// Purpose:
// Branch management.

// - Branch listing is publicly readable.
// - Branch creation is admin-only through route authorization.
// - Admin can update/delete branches.
// - Branch managers can update only their assigned branch.
// - A branch cannot be deleted while it has employees or orders.
// - Branch listing uses caching.

import Branch from '../models/branch.model.js';
import Order from '../models/order.model.js';
import Employee from '../models/employee.model.js';
import Product from '../models/product.model.js';
import Payment from '../models/payment.model.js';
import SupplyRequest from '../models/supplyRequest.model.js';
import StockMovement from '../models/stockMovement.model.js';
import ProcessingWorkflow from '../models/processingWorkflow.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { withCache, deleteCached } from '../services/cache.service.js';

// GET /branches
// Public branch listing.
// Only expose fields required by the frontend/public API.
export const getAllBranches = asyncHandler(async (req, res) => {
    const branches = await withCache('branches:all', async () => {
        return await Branch.find().select('name address phone').sort({ name: 1 });
    });
    apiResponse(res, 200, branches, 'Branches retrieved successfully');
});

// GET /branches/:id
export const getBranchById = asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id).select('name address phone');
    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }
    apiResponse(res, 200, branch, 'Branch fetched successfully');
});

// GET /branches/:id/stats
// Comprehensive branch analytics for admin and branch manager
export const getBranchStats = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.user.role === 'branch_manager' && req.user.branch_id.toString() !== id.toString()) {
        throw new ApiError(403, 'You do not have permission to view analytics for this branch');
    }

    const branch = await Branch.findById(id).select('name address phone');
    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
        employees,
        orders,
        todayOrders,
        payments,
        products,
        supplyRequests,
        recentMovements,
        workflows,
    ] = await Promise.all([
        Employee.find({ branch_id: id })
            .populate('user_id', 'name email phone role is_active')
            .lean(),
        Order.find({ branch_id: id })
            .select('status total_price amount_due payment_status createdAt customer_id items delivery_time processing_started_at')
            .populate('customer_id', 'name')
            .sort({ createdAt: -1 })
            .lean(),
        Order.find({ branch_id: id, createdAt: { $gte: todayStart } })
            .select('status total_price amount_due payment_status')
            .lean(),
        Payment.find({ branch_id: id, status: 'completed' })
            .select('amount net_amount paymentMethod transaction_type createdAt')
            .lean(),
        Product.find({ branch_id: id, is_active: true })
            .select('name quantity unit price reorder_point')
            .lean(),
        SupplyRequest.find({ branch_id: id })
            .populate('requested_by', 'job_title')
            .populate({ path: 'requested_by', populate: { path: 'user_id', select: 'name' } })
            .sort({ createdAt: -1 })
            .lean(),
        StockMovement.find({ branch_id: id })
            .populate('product_id', 'name unit')
            .populate({ path: 'employee_id', populate: { path: 'user_id', select: 'name' } })
            .sort({ created_at: -1 })
            .limit(10)
            .lean(),
        ProcessingWorkflow.find({ branch_id: id })
            .select('status steps order_id createdAt')
            .lean(),
    ]);

    // Staff Breakdown by Role
    const staffByRole = {
        total: employees.length,
        active: employees.filter((e) => e.is_active && e.user_id?.is_active !== false).length,
        frontDesk: employees.filter((e) => e.user_id?.role === 'front_desk').length,
        inventoryOfficers: employees.filter((e) => e.user_id?.role === 'inventory_officer').length,
        attendants: employees.filter((e) => e.user_id?.role === 'employee').length,
        branchManagers: employees.filter((e) => e.user_id?.role === 'branch_manager').length,
        admins: employees.filter((e) => e.user_id?.role === 'admin').length,
    };

    // Calculate Completed Processing Tasks per Employee to find Top Employee / Hardest Working Staff
    const completedTasksByEmployeeId = new Map();
    for (const wf of workflows) {
        if (Array.isArray(wf.steps)) {
            for (const step of wf.steps) {
                if (step.status === 'completed' && step.employee_id) {
                    const empIdStr = step.employee_id.toString();
                    completedTasksByEmployeeId.set(empIdStr, (completedTasksByEmployeeId.get(empIdStr) || 0) + 1);
                }
            }
        }
    }

    const employeeRankings = employees.map((emp) => {
        const completedCount = completedTasksByEmployeeId.get(emp._id.toString()) || 0;
        return {
            ...emp,
            completedTasksCount: completedCount,
        };
    }).sort((a, b) => b.completedTasksCount - a.completedTasksCount);

    const topEmployee = employeeRankings.length > 0 ? employeeRankings[0] : null;

    // Order metrics
    const totalOrders = orders.length;
    const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const readyOrders = orders.filter((o) => o.status === 'ready');
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const overdueOrders = activeOrders.filter((o) => o.delivery_time && new Date(o.delivery_time) < new Date());

    const orderStatusCounts = {
        placed: orders.filter((o) => o.status === 'placed').length,
        received: orders.filter((o) => o.status === 'received').length,
        processing: orders.filter((o) => o.status === 'processing').length,
        quality_check: orders.filter((o) => o.status === 'quality_check').length,
        ready: readyOrders.length,
        delivered: deliveredOrders.length,
        cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };

    // Financial & Payment metrics
    const totalRevenue = payments
        .filter((p) => p.transaction_type === 'payment')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0) -
        payments
            .filter((p) => p.transaction_type === 'refund')
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const todayRevenue = payments
        .filter((p) => new Date(p.createdAt) >= todayStart && p.transaction_type === 'payment')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const paymentMethodsBreakdown = {
        card: payments.filter((p) => p.paymentMethod === 'card' && p.transaction_type === 'payment').reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        cash: payments.filter((p) => p.paymentMethod === 'cash' && p.transaction_type === 'payment').reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        transfer: payments.filter((p) => p.paymentMethod === 'transfer' && p.transaction_type === 'payment').reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    };

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Inventory & Supply Metrics
    const lowStockProducts = products.filter((p) => Number(p.quantity) <= Number(p.reorder_point));
    const pendingSupplyRequests = supplyRequests.filter((r) => r.status === 'pending');

    // Dynamic Health / Performance Scoring System (0-100)
    // Evaluates:
    // 1. Overdue orders (past promised delivery time)
    // 2. Critical inventory shortages (below reorder threshold)
    // 3. Supply request backlogs awaiting approval
    // 4. Attendant staffing availability for active orders
    const reasons = [];
    let performanceScore = 100;

    if (overdueOrders.length > 0) {
        performanceScore -= overdueOrders.length * 15;
        reasons.push(`${overdueOrders.length} order${overdueOrders.length > 1 ? 's are' : ' is'} overdue past promised delivery time`);
    }

    if (lowStockProducts.length > 0) {
        performanceScore -= lowStockProducts.length * 10;
        reasons.push(`${lowStockProducts.length} product${lowStockProducts.length > 1 ? 's are' : ' is'} low in stock (below reorder point)`);
    }

    if (pendingSupplyRequests.length > 0) {
        performanceScore -= pendingSupplyRequests.length * 5;
        reasons.push(`${pendingSupplyRequests.length} supply request${pendingSupplyRequests.length > 1 ? 's are' : ' is'} pending approval`);
    }

    if (staffByRole.attendants === 0 && activeOrders.length > 0) {
        performanceScore -= 20;
        reasons.push('No active processing attendants assigned to handle active orders');
    }

    if (reasons.length === 0) {
        reasons.push('All orders on schedule');
        reasons.push('Inventory levels healthy');
        reasons.push('Branch operations operating smoothly');
    }

    performanceScore = Math.max(15, Math.min(100, performanceScore));

    let healthRating = 'Operational';
    if (performanceScore >= 80) {
        healthRating = 'High Performing';
    } else if (performanceScore < 80) {
        healthRating = 'Needs Attention';
    }

    const payload = {
        branch,
        staff: {
            breakdown: staffByRole,
            list: employeeRankings,
            topEmployee,
        },
        orders: {
            total: totalOrders,
            activeCount: activeOrders.length,
            readyCount: readyOrders.length,
            deliveredCount: deliveredOrders.length,
            overdueCount: overdueOrders.length,
            todayCount: todayOrders.length,
            statusCounts: orderStatusCounts,
            recent: orders.slice(0, 8),
        },
        financials: {
            totalRevenue,
            todayRevenue,
            averageOrderValue: avgOrderValue,
            paymentMethods: paymentMethodsBreakdown,
            transactionCount: payments.length,
        },
        inventory: {
            totalProducts: products.length,
            lowStockCount: lowStockProducts.length,
            lowStockItems: lowStockProducts,
            pendingRequestsCount: pendingSupplyRequests.length,
            pendingRequests: pendingSupplyRequests.slice(0, 5),
            recentMovements,
        },
        workflows: {
            activeCount: workflows.filter((w) => w.status === 'active').length,
            totalCount: workflows.length,
        },
        health: {
            rating: healthRating,
            score: performanceScore,
            reasons,
        },
    };

    apiResponse(res, 200, payload, 'Branch statistics retrieved successfully');
});

// POST /branches
// Route should be protected by admin authorization.
export const createBranch = asyncHandler(async (req, res) => {
    const { name, address, phone } = req.body;
    
    const existingBranch = await Branch.findOne({ name });
    if (existingBranch) {
        throw new ApiError(409, 'A branch with this name already exists');
    }
    const branch = await Branch.create({ name, address, phone, });

    await deleteCached('branches:all');

    apiResponse(res, 201, branch, 'Branch created successfully');
});

// PUT /branches/:id
// Admin can update any branch.
// Branch manager can only update their own branch.
export const updateBranch = asyncHandler(async (req, res) => {
    const {
        name,
        address,
        phone,
    } = req.body;

    if (req.user.role === 'branch_manager' && req.user.branch_id.toString() !== req.params.id.toString()) {
        throw new ApiError(403, 'Cannot update a branch you are not assigned to');
    }

    const updates = {};

    if (name !== undefined) {
        updates.name = name;
    }

    if (address !== undefined) {
        updates.address = address;
    }

    if (phone !== undefined) {
        updates.phone = phone;
    }

    // If changing the branch name, prevent duplicates.
    if (name !== undefined) {
        const existingBranch = await Branch.findOne({ name, _id: { $ne: req.params.id } });
        if (existingBranch) {
            throw new ApiError(409, 'A branch with this name already exists');
        }
    }

    const branch = await Branch.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Branch data has changed.
    await deleteCached('branches:all');

    apiResponse(res, 200, branch, 'Branch updated successfully');
});

// DELETE /branches/:id
// A branch cannot be deleted if it has employees or orders.
export const deleteBranch = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent deletion if employees are still assigned.
    const employeeCount = await Employee.countDocuments({
        branch_id: id,
    });

    if (employeeCount > 0) {
        throw new ApiError(409, 'Cannot delete branch with active registered employees');
    }

    // Prevent deletion if historical orders exist.
    const orderCount = await Order.countDocuments({ branch_id: id });

    if (orderCount > 0) {
        throw new ApiError(409, 'Cannot delete branch with active order records');
    }

    const branch = await Branch.findByIdAndDelete(id);

    if (!branch) {
        throw new ApiError(404, 'Branch not found');
    }

    // Branch list has changed.
    await deleteCached('branches:all');

    apiResponse(res, 200, branch, 'Branch deleted successfully');
});