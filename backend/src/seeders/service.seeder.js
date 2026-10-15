// Owner: Josh
// Purpose: Seed initial laundry services for a branch.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Service from '../models/service.model.js';
import Branch from '../models/branch.model.js';
import logger from '../utils/logger.js';

dotenv.config();

const branchId = process.argv[2];

if (!branchId) {
    logger.error('❌ Please provide a branch ID. Example: npm run seed:services <BRANCH_ID>');
    process.exit(1);
}

const services = [
    // Core Laundry Services
    {
        name: 'Washing & Folding',
        type: 'service',
        category: 'Laundry',
        turnaround_hours: 72,
    },
    {
        name: 'Washing & Ironing',
        type: 'service',
        category: 'Laundry',
        turnaround_hours: 72,
    },
    {
        name: 'Ironing',
        type: 'service',
        category: 'Laundry',
        turnaround_hours: 24,
    },
    {
        name: 'Dry Cleaning',
        type: 'service',
        category: 'Dry Cleaning',
        turnaround_hours: 48,
    },
    {
        name: 'Dry Cleaning & Pressing',
        type: 'service',
        category: 'Dry Cleaning',
        turnaround_hours: 48,
    },
];


const seedServices = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error(
                'MONGODB_URI is not defined in .env'
            );
        }

        await mongoose.connect(process.env.MONGODB_URI);

        logger.info('✅ Connected to MongoDB');

        // Verify branch exists
        const branch = await Branch.findById(branchId);

        if (!branch) {
            throw new Error(
                `Branch not found: ${branchId}`
            );
        }

        logger.info(`📍 Seeding services for: ${branch.name}`);

        let createdCount = 0;
        let skippedCount = 0;

        for (const serviceData of services) {
            const existingService = await Service.findOne({
                branch_id: branchId,
                name: serviceData.name,
            });

            if (existingService) {
                logger.info(`⏭️ Skipped: ${serviceData.name} already exists`);
                skippedCount++;
                continue;
            }

            await Service.create({
                branch_id: branchId,
                ...serviceData,
            });

            logger.info(`✅ Created: ${serviceData.name}`);
            createdCount++;
        }

        logger.info(`Service seeding completed for branch: ${branch.name} (Created: ${createdCount}, Skipped: ${skippedCount})`);

        await mongoose.disconnect();

        process.exit(0);
    } catch (error) {
        logger.error('❌ Service seeding failed:', { error: error.message });

        await mongoose.disconnect();

        process.exit(1);
    }
};

seedServices();