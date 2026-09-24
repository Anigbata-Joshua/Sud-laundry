// Owner: Josh
// Purpose:
// Scheduled daily low-stock check.
//
// Rules:
// - Only active products are checked.
// - Products are considered low-stock when quantity <= reorder_point.
// - Products with reorder_point = 0 are ignored.
// - Branch managers receive alerts for products in their branch.
// - Low-stock checks run once daily at Nigeria local midnight.
// - This job does not modify inventory.

import cron from 'node-cron';
import Product from '../models/product.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import createNotification from '../services/notification.service.js';
import logger from '../utils/logger.js';


// Run once every day at midnight in Nigeria.
const LOW_STOCK_CRON = '0 0 * * *';


// Check all branches for low-stock products.
export const checkLowStock = async () => {
    try {
        logger.info('🔄 Running daily low-stock inventory check...');

        // Find active products that have a configured reorder point
        // and are at or below that point.
        const lowStockProducts = await Product.find({
            is_active: true,
            reorder_point: { $gt: 0 },
            $expr: { $lte: ['$quantity', '$reorder_point'], },
        }).select('branch_id name quantity reorder_point unit');

        if (lowStockProducts.length === 0) {
            logger.info('✅ No low-stock products found.');
            return;
        }

        logger.warn(`⚠️ Found ${lowStockProducts.length} low-stock product(s).`);


        // Get the unique branches affected by low-stock products.
        const branchIds = [...new Set(lowStockProducts.map(product => product.branch_id.toString()))];


        // Find active employees in these branches
        const employees = await Employee.find({
            branch_id: { $in: branchIds },
            is_active: true,
        }).select('user_id branch_id');

        if (employees.length === 0) {
            logger.warn('⚠️ Low-stock products found, but no employees assigned to branches.');
            return;
        }

        const employeeUserIds = employees.map(e => e.user_id);

        // Find active users who are branch managers
        const managers = await User.find({
            _id: { $in: employeeUserIds },
            role: { $in: ['branch_manager', 'inventory_manager', 'inventory_officer'] },
            is_active: true,
        }).select('_id');

        if (managers.length === 0) {
            logger.warn('⚠️ Low-stock products found, but no active branch managers were found.');
            return;
        }

        const managerIdSet = new Set(managers.map(m => m._id.toString()));

        // Group managers by branch.
        const managersByBranch = new Map();

        for (const emp of employees) {
            if (managerIdSet.has(emp.user_id.toString())) {
                const branchId = emp.branch_id.toString();

                if (!managersByBranch.has(branchId)) {
                    managersByBranch.set(branchId, []);
                }

                managersByBranch.get(branchId).push({ _id: emp.user_id });
            }
        }


        // Send each branch manager the alerts for their branch.
        for (const product of lowStockProducts) {
            const branchId = product.branch_id.toString();

            const branchManagers = managersByBranch.get(branchId) || [];

            if (branchManagers.length === 0) {
                logger.warn(`⚠️ No active manager found for branch ${branchId} — ${product.name}`);
                continue;
            }


            const alertMessage =
                `Low stock alert: "${product.name}" has ` +
                `${product.quantity} ${product.unit} remaining. ` +
                `Reorder point: ${product.reorder_point} ${product.unit}.`;


            for (const manager of branchManagers) {
                await createNotification({
                    user_id: manager._id,
                    type: 'other',
                    message: alertMessage,
                });
            }
        }


        logger.info('✅ Low-stock checks and notifications completed.');

    } catch (error) {
        logger.error('❌ Error during low-stock check:', { error: error.message });
    }
};


// Schedule the daily job.
//
// Africa/Lagos ensures midnight means Nigerian midnight,
// regardless of the server's timezone.
cron.schedule(LOW_STOCK_CRON, checkLowStock, {
    timezone: 'Africa/Lagos',
});