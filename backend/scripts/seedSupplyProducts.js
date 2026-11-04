// Owner: Josh
// Purpose: Seed the inventory products required by config/serviceSupplies.config.js
// Idempotently seeds all core recipe supply products with stock.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Product from '../src/models/product.model.js';
import Branch from '../src/models/branch.model.js';
import logger from '../src/utils/logger.js';

dotenv.config();

export const CORE_RECIPE_PRODUCTS = [
    { name: 'Laundry Detergent', unit: 'scoop', quantity: 100, reorder_point: 20 },
    { name: 'Fabric Softener', unit: 'cap', quantity: 50, reorder_point: 10 },
    { name: 'Ironing Starch', unit: 'spray', quantity: 50, reorder_point: 10 },
    { name: 'Dry Cleaning Solvent', unit: 'unit', quantity: 50, reorder_point: 10 },
    { name: 'Packaging Nylon', unit: 'pieces', quantity: 100, reorder_point: 20 },
    { name: 'Hanger', unit: 'pieces', quantity: 100, reorder_point: 20 },
];

export const seedSupplyProducts = async (targetBranchId) => {
    try {
        let shouldDisconnect = false;
        if (mongoose.connection.readyState === 0 && process.env.NODE_ENV !== 'test') {
            if (!process.env.MONGODB_URI) {
                throw new Error('MONGODB_URI is not defined in .env');
            }
            await mongoose.connect(process.env.MONGODB_URI);
            shouldDisconnect = true;
            logger.info('✅ Connected to MongoDB');
        }

        const branch = await Branch.findById(targetBranchId);
        if (!branch) {
            throw new Error(`Branch not found: ${targetBranchId}`);
        }

        logger.info(`📍 Seeding supply products for: ${branch.name}`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const productData of CORE_RECIPE_PRODUCTS) {
            const existingProduct = await Product.findOne({
                branch_id: targetBranchId,
                name: { $regex: new RegExp(`^${productData.name}$`, 'i') },
            });

            if (existingProduct) {
                logger.info(`⏭️ Skipped: "${existingProduct.name}" already exists (${existingProduct.quantity} ${existingProduct.unit} on hand)`);
                skippedCount++;
                continue;
            }

            await Product.create({
                branch_id: targetBranchId,
                is_active: true,
                ...productData,
            });

            logger.info(`✅ Created: ${productData.name}`);
            createdCount++;
        }

        logger.info(`Supply product seeding completed for branch: ${branch.name} (Created: ${createdCount}, Skipped: ${skippedCount})`);

        if (shouldDisconnect && mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        return { createdCount, skippedCount };
    } catch (error) {
        logger.error('❌ Supply product seeding failed:', { error: error.message });
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        throw error;
    }
};

if (process.argv[1] && process.argv[1].endsWith('seedSupplyProducts.js')) {
    const branchId = process.argv[2];
    if (!branchId) {
        logger.error('❌ Please provide a branch ID. Example: npm run seed:supply-products <BRANCH_ID>');
        process.exit(1);
    }
    seedSupplyProducts(branchId)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
