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
    // =========================
    // LAUNDRY SERVICES
    // =========================

    {
        name: 'Washing',
        type: 'service',
        category: 'Laundry',
        price: 1000,
        turnaround_hours: 72,
    },

    {
        name: 'Washing & Ironing',
        type: 'service',
        category: 'Laundry',
        price: 1500,
        turnaround_hours: 72,
    },

    {
        name: 'Washing & Folding',
        type: 'service',
        category: 'Laundry',
        price: 1300,
        turnaround_hours: 72,
    },

    {
        name: 'Ironing',
        type: 'service',
        category: 'Laundry',
        price: 800,
        turnaround_hours: 24,
    },


    // =========================
    // DRY CLEANING
    // =========================

    {
        name: 'Dry Cleaning',
        type: 'service',
        category: 'Dry Cleaning',
        price: 2500,
        turnaround_hours: 48,
    },

    {
        name: 'Dry Cleaning & Pressing',
        type: 'service',
        category: 'Dry Cleaning',
        price: 3000,
        turnaround_hours: 48,
    },

    // =========================
    // SPECIALTY SERVICES
    // =========================

    {
        name: 'Stain Removal',
        type: 'add-on',
        category: 'Treatment',
        price: 500,
    },

    {
        name: 'Duvet Cleaning',
        type: 'service',
        category: 'Household',
        price: 3000,
        turnaround_hours: 72,
    },

    {
        name: 'Curtain Cleaning',
        type: 'service',
        category: 'Household',
        price: 3500,
        turnaround_hours: 72,
    },

    {
        name: 'Carpet & Rug Cleaning',
        type: 'service',
        category: 'Household',
        price: 4000,
        turnaround_hours: 72,
    },

    {
        name: 'Shoe Cleaning',
        type: 'service',
        category: 'Specialty',
        price: 2000,
        turnaround_hours: 48,
    },

    // =========================
    // ADD-ONS
    // =========================

    {
        name: 'Perfume / Fragrance',
        type: 'add-on',
        category: 'Finishing',
        price: 300,
        },

    {
        name: 'Special Packaging',
        type: 'add-on',
        category: 'Finishing',
        price: 500,
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