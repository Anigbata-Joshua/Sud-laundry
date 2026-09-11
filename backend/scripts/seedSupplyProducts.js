// Owner: Josh
// Purpose: Seed the inventory products required by config/serviceSupplies.config.js
// that don't already exist from the original stage-based recipe
// (Laundry Detergent, Fabric Softener, Ironing Starch, Packaging Nylon,
// Hanger were already seeded/created previously and are left alone here).

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Product from '../src/models/product.model.js';
import Branch from '../src/models/branch.model.js';

dotenv.config();

const branchId = process.argv[2];

if (!branchId) {
    console.error('❌ Please provide a branch ID.');
    console.error('Example: npm run seed:supply-products <BRANCH_ID>');
    process.exit(1);
}

const products = [
    { name: 'Dry Cleaning Solvent', unit: 'unit', quantity: 50, reorder_point: 10 },
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
        console.log('✅ Connected to MongoDB');

        const branch = await Branch.findById(branchId);
        if (!branch) {
            throw new Error(`Branch not found: ${branchId}`);
        }

        console.log(`📍 Seeding supply products for: ${branch.name}`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const productData of products) {
            const existingProduct = await Product.findOne({
                branch_id: branchId,
                name: productData.name,
            });

            if (existingProduct) {
                console.log(`⏭️ Skipped: ${productData.name} already exists`);
                skippedCount++;
                continue;
            }

            await Product.create({
                branch_id: branchId,
                is_active: true,
                ...productData,
            });

            console.log(`✅ Created: ${productData.name}`);
            createdCount++;
        }

        console.log('\n--------------------------------');
        console.log('Supply product seeding completed');
        console.log('--------------------------------');
        console.log(`Branch: ${branch.name}`);
        console.log(`Created: ${createdCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log('--------------------------------\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Supply product seeding failed:');
        console.error(error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedSupplyProducts();