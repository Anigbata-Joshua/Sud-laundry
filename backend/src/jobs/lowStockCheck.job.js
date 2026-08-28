// Owner: Josh
// Purpose: scheduled job — daily low-stock check, notifies branch managers.

import cron from 'node-cron';
import Product from '../models/product.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import createNotification from '../services/notification.service.js';

// Run once a day at midnight: '0 0 * * *'
// For testing/development, we can trigger it programmatically or via cron schedule
export const checkLowStock = async () => {
    try {
        console.log('🔄 Running daily low-stock inventory check...');
        
        // Find all products that are at or below their reorder point
        // and have a positive reorder point defined (to avoid checking disabled items)
        const lowStockProducts = await Product.find({
            $expr: { $lte: ['$quantity', '$reorder_point'] },
            reorder_point: { $gt: 0 }
        });

        if (lowStockProducts.length === 0) {
            console.log('✅ No low stock items found.');
            return;
        }

        console.log(`⚠️ Found ${lowStockProducts.length} low-stock items. Dispatching alerts...`);

        for (const product of lowStockProducts) {
            // Find all employees assigned to the product's branch
            const employees = await Employee.find({ branch_id: product.branch_id });
            const employeeUserIds = employees.map(emp => emp.user_id);

            // Find users who are branch_managers or admins for this branch
            const managers = await User.find({
                _id: { $in: employeeUserIds },
                role: 'branch_manager',
                is_active: true
            });

            const alertMessage = `Low stock alert: Product "${product.name}" has only ${product.quantity} units left (Reorder point: ${product.reorder_point}).`;

            // Notify each manager
            for (const manager of managers) {
                await createNotification({
                    user_id: manager._id,
                    type: 'other',
                    message: alertMessage
                });
            }
        }
        console.log('✅ Low stock checks and notifications complete.');
    } catch (error) {
        console.error('❌ Error during low stock check job:', error.message);
    }
};

// Daily cron task
cron.schedule('0 0 * * *', checkLowStock);
