// Owner: Josh
// Purpose: Real-time inventory consumption engine during order processing stages,
// with atomic ledger logging and automatic low-stock notifications to Branch Managers.

import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import StockMovement from '../models/stockMovement.model.js';
import Order from '../models/order.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import createNotification from './notification.service.js';
import { STAGE_SUPPLIES_RECIPE } from '../config/stageSupplies.config.js';

/**
 * Automatically deducts required inventory supplies when an order stage is completed.
 * Executes atomically within a MongoDB session transaction.
 */
export const deductSuppliesForStage = async ({ order_id, stage, employee_id, branch_id }) => {
    const requiredSupplies = STAGE_SUPPLIES_RECIPE[stage];
    if (!requiredSupplies || requiredSupplies.length === 0) {
        return;
    }

    if (!order_id || !branch_id) {
        return;
    }

    const session = await mongoose.startSession();
    const lowStockAlerts = [];

    try {
        await session.withTransaction(async () => {
            const order = await Order.findById(order_id).session(session);
            if (!order) {
                throw new Error(`Order not found: ${order_id}`);
            }

            for (const item of requiredSupplies) {
                // Find matching active product at the given branch
                const product = await Product.findOne({
                    branch_id,
                    name: { $regex: new RegExp(`^${item.productName}$`, 'i') },
                    is_active: true,
                }).session(session);

                if (!product) {
                    console.warn(`[Inventory] Product "${item.productName}" not found at branch ${branch_id}. Skipping automatic deduction.`);
                    continue;
                }

                const qtyToDeduct = item.defaultQuantity || 1;
                product.quantity = Math.max(0, product.quantity - qtyToDeduct);
                await product.save({ session });

                // 1. Create immutable audit ledger entry
                await StockMovement.create(
                    [
                        {
                            product_id: product._id,
                            branch_id,
                            employee_id: employee_id || undefined,
                            order_id,
                            type: 'usage',
                            quantity: -qtyToDeduct,
                            notes: `Auto-consumed during "${stage}" stage for Order #${order._id.toString().slice(-6)}`,
                        },
                    ],
                    { session }
                );

                // 2. Record on order's audit record
                order.supplies_used.push({
                    product_id: product._id,
                    name: product.name,
                    quantity_used: qtyToDeduct,
                    employee_id: employee_id || undefined,
                    used_at: new Date(),
                });

                // 3. Check for low-stock threshold breach
                if (product.reorder_point > 0 && product.quantity <= product.reorder_point) {
                    lowStockAlerts.push({
                        productName: product.name,
                        remaining: product.quantity,
                        reorderPoint: product.reorder_point,
                        unit: product.unit || 'units',
                        branchId: branch_id,
                    });
                }
            }

            await order.save({ session });
        });
    } catch (error) {
        console.error('❌ Failed to deduct supplies for stage:', error.message);
    } finally {
        await session.endSession();
    }

    // Dispatch real-time low-stock alerts to Branch Managers
    for (const alert of lowStockAlerts) {
        await notifyBranchManagersOfLowStock(alert);
    }
};

/**
 * Dispatches an in-app notification to all active Branch Managers assigned to a branch
 * when product inventory falls at or below its reorder point.
 */
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

        if (!branchEmployees.length) {
            return;
        }

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
    deductSuppliesForStage,
    notifyBranchManagersOfLowStock,
};
