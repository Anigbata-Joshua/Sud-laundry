
import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import StockMovement from '../models/stockMovement.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import createNotification from './notification.service.js';
import { SERVICE_SUPPLIES_RECIPE, DEFAULT_PACKAGING_PER_UNIT, STAGE_SERVICE_CATEGORIES, getTier } from '../config/serviceSupplies.config.js';

// calculate the amount of supply need for an order
export function calculateSuppliesForStep({ order, stepName }) {
    const totals = new Map(); // productName -> { quantity, unit }

    const addAmount = (productName, quantity, unit) => {
        const existing = totals.get(productName);
        if (existing) {
            existing.quantity += quantity;
        } else {
            totals.set(productName, { quantity, unit });
        }
    };

    const relevantCategories = STAGE_SERVICE_CATEGORIES[stepName];

    for (const item of order.items ?? []) {
        // Only count a service's supplies against the stage it actually
        // belongs to — otherwise a multi-service order double-counts the
        // same supplies once per step.
        if (relevantCategories && !relevantCategories.includes(item.category)) continue;

        const recipe = SERVICE_SUPPLIES_RECIPE[item.name];
        if (!recipe) continue; // service has no supply requirement
        if (recipe.perUnit) {
            for (const supply of recipe.perUnit) {
                addAmount(supply.productName, supply.quantity * item.quantity, supply.unit);
            }
            continue;
        }

        const tier = getTier(item.quantity);
        const tierSupplies = recipe[tier];
        if (!tierSupplies) continue;

        for (const supply of tierSupplies) {
            addAmount(supply.productName, supply.quantity, supply.unit);
        }
    }
    
    if (stepName === 'packaging') {
        // Only real garments need packaging materials — add-ons (Perfume,
        // Special Packaging, Stain Removal) aren't separate physical items.
        const totalGarments = (order.items ?? [])
            .filter((item) => item.type === 'service')
            .reduce((sum, item) => sum + item.quantity, 0);
        for (const supply of DEFAULT_PACKAGING_PER_UNIT) {
            addAmount(supply.productName, supply.quantity * totalGarments, supply.unit);
        }
    }

    return Array.from(totals.entries()).map(([productName, { quantity, unit }]) => ({
        productName,
        quantity,
        unit,
    }));
}

/**
 * Resolves calculated productNames to real Product documents at the branch,
 * so the officer sees actual product_ids (and current stock) to review,
 * not just names.
 */
export async function resolveSuppliesToProducts({ branch_id, supplies }) {
    const resolved = [];
    for (const supply of supplies) {
        const product = await Product.findOne({
            branch_id,
            name: { $regex: new RegExp(`^${supply.productName}$`, 'i') },
            is_active: true,
        });

        resolved.push({
            product_id: product?._id ?? null,
            product_name: supply.productName,
            quantity: supply.quantity,
            unit: supply.unit,
            available: product ? product.quantity : null,
            found: Boolean(product),
        });
    }
    return resolved;
}

/**
 * Deducts stock for an APPROVED supply request. This is the only place
 * stock is actually decremented for order fulfillment — atomic per product,
 * with an immutable ledger entry per item and low-stock alerts dispatched
 * after the transaction commits.
 */
export async function disburseApprovedSupplies({ order, supplyRequest }) {
    const session = await mongoose.startSession();
    const lowStockAlerts = [];

    try {
        await session.withTransaction(async () => {
            for (const line of supplyRequest.approved_items) {
                const product = await Product.findById(line.product_id).session(session);
                if (!product) {
                    throw new Error(`Product not found: ${line.product_id}`);
                }

                if (product.quantity < line.quantity) {
                    throw new Error(
                        `Insufficient stock for "${product.name}": have ${product.quantity} ${product.unit || 'units'}, tried to disburse ${line.quantity}`,
                    );
                }

                product.quantity -= line.quantity;
                await product.save({ session });

                await StockMovement.create(
                    [
                        {
                            product_id: product._id,
                            branch_id: supplyRequest.branch_id,
                            employee_id: supplyRequest.requested_by,
                            order_id: order._id,
                            type: 'usage',
                            quantity: -line.quantity,
                            notes: `Approved by inventory officer for Order #${order._id
                                .toString()
                                .slice(-6)} (request ${supplyRequest._id})`,
                        },
                    ],
                    { session },
                );

                order.supplies_used.push({
                    product_id: product._id,
                    name: product.name,
                    quantity_used: line.quantity,
                    employee_id: supplyRequest.requested_by,
                    used_at: new Date(),
                });

                if (product.reorder_point > 0 && product.quantity <= product.reorder_point) {
                    lowStockAlerts.push({
                        productName: product.name,
                        remaining: product.quantity,
                        reorderPoint: product.reorder_point,
                        unit: product.unit || 'units',
                        branchId: supplyRequest.branch_id,
                    });
                }
            }

            await order.save({ session });
        });
    } finally {
        await session.endSession();
    }

    for (const alert of lowStockAlerts) {
        await notifyBranchManagersOfLowStock(alert);
    }
}

export const notifyBranchManagersOfLowStock = async ({
    productName,
    remaining,
    reorderPoint,
    unit = 'units',
    branchId,
}) => {
    try {
        const branchEmployees = await Employee.find({
            branch_id: branchId,
            is_active: true,
        }).select('user_id');

        if (!branchEmployees.length) return;

        const userIds = branchEmployees.map((emp) => emp.user_id);

        const managers = await User.find({
            _id: { $in: userIds },
            role: 'branch_manager',
            is_active: true,
        }).select('_id');

        const alertMessage = `⚠️ Low Stock Alert: Product "${productName}" has only ${remaining} ${unit} left at your branch (Reorder point: ${reorderPoint} ${unit}). Please restock.`;

        for (const manager of managers) {
            await createNotification({
                user_id: manager._id,
                type: 'other',
                message: alertMessage,
            });
        }
    } catch (err) {
        console.error('Failed to notify branch managers of low stock:', err.message);
    }
};

export default {
    calculateSuppliesForStep,
    resolveSuppliesToProducts,
    disburseApprovedSupplies,
    notifyBranchManagersOfLowStock,
};