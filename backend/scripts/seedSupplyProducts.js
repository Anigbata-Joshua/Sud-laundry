// Owner: Josh
// Purpose: Seed the inventory products required by config/serviceSupplies.config.js
// Idempotently seeds all core recipe supply products with stock.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Product from '../src/models/product.model.js';
import Branch from '../src/models/branch.model.js';
import logger from '../src/utils/logger.js';
import { CORE_RECIPE_SUPPLIES } from '../src/config/serviceSupplies.config.js';

dotenv.config();

export const CORE_RECIPE_PRODUCTS = CORE_RECIPE_SUPPLIES.map((s) => ({
    name: s.name,
    unit: s.unit,
    quantity: s.default_quantity,
    reorder_point: s.default_reorder_point,
}));

export const seedSupplyProducts = async (targetBranchId) => {
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
            skippedCount++;
            continue;
        }

        await Product.create({
            branch_id: targetBranchId,
            name: productData.name,
            unit: productData.unit,
            quantity: productData.quantity,
            reorder_point: productData.reorder_point,
            price: 0,
            is_active: true,
        });

        createdCount++;
    }

    logger.info(
        `✅ Seeded ${createdCount} product(s) for branch "${branch.name}" (skipped ${skippedCount} existing)`,
    );
    return { createdCount, skippedCount };
};

if (process.argv[1] && process.argv[1].endsWith('seedSupplyProducts.js')) {
    const branchId = process.argv[2];
    if (!branchId) {
        logger.error('❌ Please provide a branch ID. Example: npm run seed:supply-products <BRANCH_ID>');
        process.exit(1);
    }
    if (!process.env.MONGODB_URI) {
        logger.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }
    mongoose
        .connect(process.env.MONGODB_URI)
        .then(() => seedSupplyProducts(branchId))
        .then(async () => {
            await mongoose.disconnect();
            process.exit(0);
        })
        .catch(async (error) => {
            logger.error('❌ Supply product seeding failed:', { error: error.message });
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
            process.exit(1);
        });
}
