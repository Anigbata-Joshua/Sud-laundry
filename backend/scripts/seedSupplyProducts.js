// Owner: Josh
// Purpose: Seed the inventory products required by config/serviceSupplies.config.js
// that don't already exist from the original stage-based recipe
// (Laundry Detergent, Fabric Softener, Ironing Starch, Packaging Nylon,
// Hanger were already seeded/created previously and are left alone here).

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Product from '../src/models/product.model.js';
import Branch from '../src/models/branch.model.js';
import logger from '../src/utils/logger.js';

dotenv.config();

const branchId = process.argv[2];

if (!branchId) {
    logger.error('❌ Please provide a branch ID. Example: npm run seed:supply-products <BRANCH_ID>');
    process.exit(1);
}

const products = [
    { name: 'Laundry Detergent', unit: 'scoop', quantity: 100, reorder_point: 20 },
    { name: 'Fabric Softener', unit: 'cap', quantity: 50, reorder_point: 10 },
    { name: 'Ironing Starch', unit: 'spray', quantity: 50, reorder_point: 10 },
    { name: 'Dry Cleaning Solvent', unit: 'unit', quantity: 50, reorder_point: 10 },
    { name: 'Packaging Nylon', unit: 'pieces', quantity: 100, reorder_point: 20 },
    { name: 'Hanger', unit: 'pieces', quantity: 100, reorder_point: 20 },
    { name: 'Stain Remover', unit: 'unit', quantity: 50, reorder_point: 10 },
    { name: 'Shoe Cleaner', unit: 'unit', quantity: 30, reorder_point: 5 },
    { name: 'Perfume', unit: 'spray', quantity: 50, reorder_point: 10 },
    { name: 'Premium Packaging Material', unit: 'unit', quantity: 100, reorder_point: 20 },
];

const seedSupplyProducts = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('✅ Connected to MongoDB');

        const branch = await Branch.findById(branchId);
        if (!branch) {
            throw new Error(`Branch not found: ${branchId}`);
        }

        logger.info(`📍 Seeding supply products for: ${branch.name}`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const productData of products) {
            const existingProduct = await Product.findOne({
                branch_id: branchId,
                name: { $regex: new RegExp(`^${productData.name}$`, 'i') },
            });

            if (existingProduct) {
                logger.info(`⏭️ Skipped: "${existingProduct.name}" already exists (${existingProduct.quantity} ${existingProduct.unit} on hand)`);
                skippedCount++;
                continue;
            }

            await Product.create({
                branch_id: branchId,
                is_active: true,
                ...productData,
            });

            logger.info(`✅ Created: ${productData.name}`);
            createdCount++;
        }

        logger.info(`Supply product seeding completed for branch: ${branch.name} (Created: ${createdCount}, Skipped: ${skippedCount})`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        logger.error('❌ Supply product seeding failed:', { error: error.message });
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedSupplyProducts();