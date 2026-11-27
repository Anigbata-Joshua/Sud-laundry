// Owner: Josh
// Purpose: Safe standalone cleanup script for junk test services (e.g. from run_production_tests.js).
// Rules:
// - Dry-run by default (lists candidate services to remove).
// - Deletes ONLY when --apply is passed.
// - Checks that no Order or CatalogItem references the candidate service before removal.
// - Backs up candidate services to backend/scripts/backups/services_backup_<timestamp>.json before any deletion.
// - DO NOT COMMIT THIS SCRIPT.

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../src/config/env.js';
import Service from '../src/models/service.model.js';
import Order from '../src/models/order.model.js';
import CatalogItem from '../src/models/catalogItem.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCleanup() {
  const isApply = process.argv.includes('--apply');

  console.log('====================================================');
  console.log(`🧹 JUNK SERVICES CLEANUP (${isApply ? 'APPLY MODE' : 'DRY-RUN MODE'})`);
  console.log('====================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.mongoUri);
  }

  // Find candidate test services matching timestamp patterns (e.g. "Premium Suit Dry Clean 17...", "Wash & Fold 17...")
  const junkRegex = /\s17\d{8,}/;
  const candidates = await Service.find({ name: { $regex: junkRegex } }).lean();

  console.log(`Found ${candidates.length} candidate test services matching pattern: ${junkRegex}`);

  if (candidates.length === 0) {
    console.log('✅ No junk test services found.');
    await mongoose.connection.close();
    return;
  }

  const safeToDelete = [];
  const referencedServices = [];

  for (const svc of candidates) {
    // Check if any Order references this service
    const orderRef = await Order.findOne({ 'items.service_id': svc._id }).select('_id').lean();
    if (orderRef) {
      referencedServices.push({ service: svc, reason: `Referenced by Order ${orderRef._id}` });
      continue;
    }

    // Check if any CatalogItem references this service
    const catalogRef = await CatalogItem.findOne({ 'services.service_id': svc._id }).select('_id name').lean();
    if (catalogRef) {
      referencedServices.push({ service: svc, reason: `Referenced by CatalogItem "${catalogRef.name}" (${catalogRef._id})` });
      continue;
    }

    safeToDelete.push(svc);
  }

  console.log('\n--- CANDIDATE SERVICES ---');
  for (const svc of safeToDelete) {
    console.log(`  [SAFE] ID: ${svc._id} | Name: "${svc.name}" | Price: ${svc.price} | Branch: ${svc.branch_id}`);
  }

  if (referencedServices.length > 0) {
    console.log('\n--- IN-USE SERVICES (SKIPPED) ---');
    for (const ref of referencedServices) {
      console.log(`  [IN-USE] ID: ${ref.service._id} | Name: "${ref.service.name}" | Reason: ${ref.reason}`);
    }
  }

  if (!isApply) {
    console.log('\n⚠️ DRY-RUN COMPLETE: No services were deleted.');
    console.log(`To delete the ${safeToDelete.length} safe test services, run:`);
    console.log('  node scripts/cleanup_junk_services.js --apply\n');
    await mongoose.connection.close();
    return;
  }

  // APPLY MODE: Backup first
  if (safeToDelete.length > 0) {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `services_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(safeToDelete, null, 2), 'utf8');
    console.log(`\n💾 Backup saved to: ${backupFile}`);

    const idsToDelete = safeToDelete.map((s) => s._id);
    const deleteResult = await Service.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} junk test services.`);
  }

  await mongoose.connection.close();
}

runCleanup().catch((err) => {
  console.error('❌ Error during junk services cleanup:', err);
  process.exit(1);
});

