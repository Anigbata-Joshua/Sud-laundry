// Owner: Josh
// Purpose: Seed standard catalog items with per-service pricing for branches.

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CatalogItem from '../src/models/catalogItem.model.js';
import Service from '../src/models/service.model.js';
import Branch from '../src/models/branch.model.js';
import logger from '../src/utils/logger.js';

dotenv.config();

const CORE_SERVICES = [
  'Washing & Folding',
  'Washing & Ironing',
  'Ironing',
  'Dry Cleaning',
  'Dry Cleaning & Pressing',
];

const CATALOG_TEMPLATES = [
  // Casuals
  {
    name: 'T-Shirt',
    category: 'Casuals',
    piece_count: 1,
    description: 'Cotton or synthetic casual t-shirt',
    prices: {
      'Washing & Folding': 800,
      'Washing & Ironing': 1200,
      'Ironing': 600,
      'Dry Cleaning': 1500,
      'Dry Cleaning & Pressing': 2000,
    },
  },
  {
    name: 'Polo Shirt',
    category: 'Casuals',
    piece_count: 1,
    description: 'Collared casual polo shirt',
    prices: {
      'Washing & Folding': 1000,
      'Washing & Ironing': 1400,
      'Ironing': 700,
      'Dry Cleaning': 1800,
      'Dry Cleaning & Pressing': 2200,
    },
  },
  {
    name: 'Jeans / Denim Trousers',
    category: 'Casuals',
    piece_count: 1,
    description: 'Casual denim pants',
    prices: {
      'Washing & Folding': 1200,
      'Washing & Ironing': 1800,
      'Ironing': 900,
      'Dry Cleaning': 2200,
      'Dry Cleaning & Pressing': 2800,
    },
  },
  {
    name: 'Casual Shorts',
    category: 'Casuals',
    piece_count: 1,
    description: 'Cotton or linen casual shorts',
    prices: {
      'Washing & Folding': 800,
      'Washing & Ironing': 1100,
      'Ironing': 600,
      'Dry Cleaning': 1400,
      'Dry Cleaning & Pressing': 1800,
    },
  },
  {
    name: 'Sweatshirt / Hoodie',
    category: 'Casuals',
    piece_count: 1,
    description: 'Heavy fleece or cotton pullover',
    prices: {
      'Washing & Folding': 1500,
      'Washing & Ironing': 2200,
      'Ironing': 1000,
      'Dry Cleaning': 2500,
      'Dry Cleaning & Pressing': 3000,
    },
  },

  // Corporate Wear
  {
    name: 'Formal Shirt',
    category: 'Corporate Wear',
    piece_count: 1,
    description: 'Button-down business dress shirt',
    prices: {
      'Washing & Folding': 1000,
      'Washing & Ironing': 1500,
      'Ironing': 800,
      'Dry Cleaning': 2000,
      'Dry Cleaning & Pressing': 2500,
    },
  },
  {
    name: 'Formal Trousers / Slacks',
    category: 'Corporate Wear',
    piece_count: 1,
    description: 'Office slacks or wool blend trousers',
    prices: {
      'Washing & Folding': 1200,
      'Washing & Ironing': 1800,
      'Ironing': 900,
      'Dry Cleaning': 2200,
      'Dry Cleaning & Pressing': 2800,
    },
  },
  {
    name: 'Blazer / Suit Jacket',
    category: 'Corporate Wear',
    piece_count: 1,
    description: 'Single or double-breasted suit jacket',
    prices: {
      'Washing & Folding': 2000,
      'Washing & Ironing': 2500,
      'Ironing': 1500,
      'Dry Cleaning': 3500,
      'Dry Cleaning & Pressing': 4500,
    },
  },
  {
    name: 'Two-Piece Suit',
    category: 'Corporate Wear',
    piece_count: 2,
    description: 'Matching jacket and trousers',
    prices: {
      'Washing & Folding': 3000,
      'Washing & Ironing': 3800,
      'Ironing': 2200,
      'Dry Cleaning': 5000,
      'Dry Cleaning & Pressing': 6500,
    },
  },
  {
    name: 'Three-Piece Suit',
    category: 'Corporate Wear',
    piece_count: 3,
    description: 'Matching jacket, waistcoat, and trousers',
    prices: {
      'Washing & Folding': 4000,
      'Washing & Ironing': 5000,
      'Ironing': 3000,
      'Dry Cleaning': 7000,
      'Dry Cleaning & Pressing': 9000,
    },
  },
  {
    name: 'Silk Tie',
    category: 'Corporate Wear',
    piece_count: 1,
    description: 'Silk or microfiber necktie',
    prices: {
      'Washing & Folding': 600,
      'Washing & Ironing': 800,
      'Ironing': 500,
      'Dry Cleaning': 1000,
      'Dry Cleaning & Pressing': 1400,
    },
  },

  // Native & Traditional
  {
    name: 'Agbada 3-Piece',
    category: 'Native & Traditional',
    piece_count: 3,
    description: 'Grand Boubou / Agbada robe, buba top, and sokoto trousers',
    prices: {
      'Washing & Folding': 3000,
      'Washing & Ironing': 4500,
      'Ironing': 2500,
      'Dry Cleaning': 6000,
      'Dry Cleaning & Pressing': 8000,
    },
  },
  {
    name: 'Kaftan / Senator Set',
    category: 'Native & Traditional',
    piece_count: 2,
    description: 'Traditional 2-piece tailored native attire',
    prices: {
      'Washing & Folding': 2000,
      'Washing & Ironing': 3000,
      'Ironing': 1500,
      'Dry Cleaning': 3800,
      'Dry Cleaning & Pressing': 5000,
    },
  },
  {
    name: 'Wrapper & Blouse',
    category: 'Native & Traditional',
    piece_count: 2,
    description: 'Lace or George wrapper set with blouse',
    prices: {
      'Washing & Folding': 2000,
      'Washing & Ironing': 3200,
      'Ironing': 1600,
      'Dry Cleaning': 4000,
      'Dry Cleaning & Pressing': 5200,
    },
  },
  {
    name: 'Ankara Dress',
    category: 'Native & Traditional',
    piece_count: 1,
    description: 'African wax print dress',
    prices: {
      'Washing & Folding': 1500,
      'Washing & Ironing': 2400,
      'Ironing': 1200,
      'Dry Cleaning': 3000,
      'Dry Cleaning & Pressing': 4000,
    },
  },

  // Outerwear & Jackets
  {
    name: 'Winter Coat / Overcoat',
    category: 'Outerwear & Jackets',
    piece_count: 2,
    description: 'Heavy wool or trench overcoat',
    prices: {
      'Washing & Folding': 3000,
      'Washing & Ironing': 4000,
      'Ironing': 2000,
      'Dry Cleaning': 5500,
      'Dry Cleaning & Pressing': 7000,
    },
  },
  {
    name: 'Bomber / Lightweight Jacket',
    category: 'Outerwear & Jackets',
    piece_count: 1,
    description: 'Casual windbreaker or bomber jacket',
    prices: {
      'Washing & Folding': 1600,
      'Washing & Ironing': 2500,
      'Ironing': 1200,
      'Dry Cleaning': 3200,
      'Dry Cleaning & Pressing': 4200,
    },
  },

  // Bedding & Household
  {
    name: 'Bed Sheet (Single/Double)',
    category: 'Bedding & Household',
    piece_count: 1,
    description: 'Fitted or flat cotton bed sheet',
    prices: {
      'Washing & Folding': 1500,
      'Washing & Ironing': 2200,
      'Ironing': 1200,
      'Dry Cleaning': 2800,
      'Dry Cleaning & Pressing': 3500,
    },
  },
  {
    name: 'Duvet / Comforter (Standard)',
    category: 'Bedding & Household',
    piece_count: 2,
    description: 'Medium filled single or double bed comforter',
    prices: {
      'Washing & Folding': 3500,
      'Washing & Ironing': 4800,
      'Ironing': 2500,
      'Dry Cleaning': 5500,
      'Dry Cleaning & Pressing': 6500,
    },
  },
  {
    name: 'King Duvet / Comforter',
    category: 'Bedding & Household',
    piece_count: 3,
    description: 'Heavy king/super-king padded duvet or comforter',
    prices: {
      'Washing & Folding': 4500,
      'Washing & Ironing': 6000,
      'Ironing': 3500,
      'Dry Cleaning': 7000,
      'Dry Cleaning & Pressing': 8500,
    },
  },
  {
    name: 'Pillow Case',
    category: 'Bedding & Household',
    piece_count: 1,
    description: 'Standard pillow cover',
    prices: {
      'Washing & Folding': 400,
      'Washing & Ironing': 600,
      'Ironing': 300,
      'Dry Cleaning': 800,
      'Dry Cleaning & Pressing': 1000,
    },
  },
  {
    name: 'Window Curtain (per panel)',
    category: 'Bedding & Household',
    piece_count: 2,
    description: 'Standard window drape or curtain panel',
    prices: {
      'Washing & Folding': 2500,
      'Washing & Ironing': 3500,
      'Ironing': 1800,
      'Dry Cleaning': 4500,
      'Dry Cleaning & Pressing': 5800,
    },
  },
];

async function seedBranch(branch) {
  logger.info(`🔍 Checking core services for branch: ${branch.name} (${branch._id})`);

  const activeServices = await Service.find({
    branch_id: branch._id,
    is_active: true,
  }).lean();

  const serviceMap = new Map(activeServices.map((s) => [s.name, s]));
  const missingCore = CORE_SERVICES.filter((name) => !serviceMap.has(name));

  if (missingCore.length > 0) {
    logger.warn(
      `⚠️ Branch "${branch.name}" is missing core services: ${missingCore.join(', ')}. Skipping catalog seed for this branch until core services are seeded.`,
    );
    return { created: 0, skipped: 0, branchName: branch.name, status: 'missing_core_services' };
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const template of CATALOG_TEMPLATES) {
    const existing = await CatalogItem.findOne({
      branch_id: branch._id,
      name: template.name,
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const services = [];
    for (const coreName of CORE_SERVICES) {
      const svcDoc = serviceMap.get(coreName);
      if (!svcDoc) continue;

      const rawPrice = template.prices[coreName];
      const isAvailable = rawPrice !== null && rawPrice !== undefined;
      const price = isAvailable ? rawPrice : 0;

      services.push({
        service_id: svcDoc._id,
        service_name: svcDoc.name,
        price,
        is_available: isAvailable,
      });
    }

    await CatalogItem.create({
      branch_id: branch._id,
      name: template.name,
      category: template.category,
      description: template.description,
      piece_count: template.piece_count,
      services,
      is_active: true,
    });

    createdCount++;
  }

  logger.info(
    `✅ Branch "${branch.name}": seeded ${createdCount} catalog items (skipped ${skippedCount} already existing).`,
  );
  return { created: createdCount, skipped: skippedCount, branchName: branch.name, status: 'success' };
}

const seedCatalogItems = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const targetBranchId = process.argv[2];
    let branches = [];

    if (targetBranchId) {
      const branch = await Branch.findById(targetBranchId);
      if (!branch) {
        throw new Error(`Branch not found with ID: ${targetBranchId}`);
      }
      branches = [branch];
    } else {
      branches = await Branch.find().sort({ name: 1 });
    }

    if (branches.length === 0) {
      logger.warn('No branches found to seed catalog items.');
      await mongoose.disconnect();
      process.exit(0);
    }

    logger.info(`Starting catalog seeding for ${branches.length} branch(es)...`);
    const results = [];
    for (const b of branches) {
      const res = await seedBranch(b);
      results.push(res);
    }

    logger.info('--- Seeding Summary ---');
    for (const r of results) {
      logger.info(`• ${r.branchName}: status=${r.status}, created=${r.created}, skipped=${r.skipped}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Catalog items seeding failed:', { error: error.message });
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedCatalogItems();
