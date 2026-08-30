// Owner: Josh
// Purpose: Seed initial laundry services for a branch.

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Service from '../models/service.model.js';
import Branch from '../models/branch.model.js';

dotenv.config();

const branchId = process.argv[2];

if (!branchId) {
    console.error('❌ Please provide a branch ID.');
    console.error(
        'Example: npm run seed:services <BRANCH_ID>'
    );
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

        console.log('✅ Connected to MongoDB');

        // Verify branch exists
        const branch = await Branch.findById(branchId);

        if (!branch) {
            throw new Error(
                `Branch not found: ${branchId}`
            );
        }

        console.log(
            `📍 Seeding services for: ${branch.name}`
        );

        let createdCount = 0;
        let skippedCount = 0;

        for (const serviceData of services) {
            const existingService = await Service.findOne({
                branch_id: branchId,
                name: serviceData.name,
            });

            if (existingService) {
                console.log(
                    `⏭️ Skipped: ${serviceData.name} already exists`
                );

                skippedCount++;
                continue;
            }

            await Service.create({
                branch_id: branchId,
                ...serviceData,
            });

            console.log(
                `✅ Created: ${serviceData.name}`
            );

            createdCount++;
        }

        console.log('\n--------------------------------');
        console.log('Service seeding completed');
        console.log('--------------------------------');
        console.log(`Branch: ${branch.name}`);
        console.log(`Created: ${createdCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log('--------------------------------\n');

        await mongoose.disconnect();

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Service seeding failed:');
        console.error(error.message);

        await mongoose.disconnect();

        process.exit(1);
    }
};

seedServices();