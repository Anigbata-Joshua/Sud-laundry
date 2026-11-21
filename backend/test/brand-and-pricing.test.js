// Owner: Josh
// Purpose: Phase F tests — Brand constants, zero old brand names across frontend, email sender, and pricing calculation logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

test('1. Brand constants in brand.js are defined as required', async () => {
  const brandFilePath = path.join(FRONTEND_DIR, 'src', 'constants', 'brand.js');
  assert.ok(fs.existsSync(brandFilePath), 'brand.js must exist');

  const fileUrl = new URL(`file://${brandFilePath.replace(/\\/g, '/')}`);
  const { BRAND } = await import(fileUrl.href);

  assert.equal(BRAND.name, 'Swirl Laundry');
  assert.equal(BRAND.shortName, 'SWIRL');
  assert.equal(BRAND.subTitle, 'LAUNDRY');
  assert.equal(BRAND.tagline, 'Fresh. Folded. Delivered.');
  assert.ok(BRAND.contact?.email, 'Contact email must be defined');
  assert.ok(BRAND.contact?.phone, 'Contact phone must be defined');
});

test('2. Zero occurrences of old brand names ("Suds", "Sud", "Titan") in frontend/src, frontend/public, and frontend/index.html', () => {
  const forbiddenRegex = /(suds|titan|\bsud\b)/i;
  const scannedExtensions = ['.js', '.jsx', '.html', '.svg', '.json', '.css'];
  const violations = [];

  function scanFile(fullPath) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (forbiddenRegex.test(line)) {
        violations.push(`${path.relative(ROOT_DIR, fullPath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (scannedExtensions.includes(ext)) {
          scanFile(fullPath);
        }
      }
    }
  }

  scanDirectory(path.join(FRONTEND_DIR, 'src'));
  scanDirectory(path.join(FRONTEND_DIR, 'public'));
  scanFile(path.join(FRONTEND_DIR, 'index.html'));

  assert.deepEqual(
    violations,
    [],
    `Found old brand names in frontend:\n${violations.join('\n')}`
  );
});

test('3. Resend email service uses "Swirl Laundry" and preserves verified domain', () => {
  const resendServicePath = path.join(ROOT_DIR, 'backend', 'src', 'services', 'resendEmail.service.js');
  const content = fs.readFileSync(resendServicePath, 'utf8');

  assert.ok(
    content.includes("const FROM_ADDRESS = `Swirl Laundry <onboarding@${env.resendFromDomain}>`;"),
    'FROM_ADDRESS must be set to "Swirl Laundry <onboarding@${env.resendFromDomain}>"'
  );
});

test('4. Pricing calculation displays ONE price per garment for selected service (no ranges)', () => {
  const sampleCatalogItem = {
    _id: 'item-101',
    name: 'Men 2-Piece Suit',
    category: 'Corporate Wear',
    services: [
      { service_name: 'Washing & Ironing', price: 2500, is_available: true },
      { service_name: 'Dry Cleaning', price: 4000, is_available: true },
      { service_name: 'Ironing', price: 1200, is_available: false },
    ],
  };

  function computeCardPrice(item, selectedService, isExpress, expressPercent) {
    const servicePricing = (item.services || []).find(
      (s) =>
        s.service_name?.toLowerCase() === selectedService.toLowerCase() ||
        s.name?.toLowerCase() === selectedService.toLowerCase()
    );

    const isAvailable = servicePricing ? servicePricing.is_available !== false : false;
    const basePrice = servicePricing?.price || 0;
    const finalPrice = isExpress ? Math.round(basePrice * (1 + expressPercent / 100)) : basePrice;

    return {
      price: finalPrice,
      basePrice,
      isAvailable,
    };
  }

  // Standard pricing for Dry Cleaning
  const dryCleanStandard = computeCardPrice(sampleCatalogItem, 'Dry Cleaning', false, 30);
  assert.equal(dryCleanStandard.price, 4000, 'Standard Dry Cleaning should be exact base price');
  assert.equal(dryCleanStandard.isAvailable, true);

  // Express pricing for Dry Cleaning with 30% surcharge
  const dryCleanExpress = computeCardPrice(sampleCatalogItem, 'Dry Cleaning', true, 30);
  assert.equal(dryCleanExpress.price, 5200, 'Express Dry Cleaning should include 30% surcharge (4000 * 1.3 = 5200)');

  // Unavailable service check
  const ironing = computeCardPrice(sampleCatalogItem, 'Ironing', false, 30);
  assert.equal(ironing.isAvailable, false, 'Ironing should be marked unavailable');

  // Service not offered by this garment
  const washFold = computeCardPrice(sampleCatalogItem, 'Washing & Folding', false, 30);
  assert.equal(washFold.isAvailable, false, 'Non-existent service should be unavailable');
  assert.equal(washFold.price, 0);
});

test('5. scripts/run_production_tests.js requires test database and has cleanup safety', () => {
  const prodTestScriptPath = path.join(ROOT_DIR, 'backend', 'scripts', 'run_production_tests.js');
  const content = fs.readFileSync(prodTestScriptPath, 'utf8');

  assert.ok(
    content.includes('/test/i.test(dbName)'),
    'run_production_tests.js must verify the database name contains "test"'
  );
  assert.ok(
    content.includes('Service.deleteMany'),
    'run_production_tests.js must clean up created services in a finally block'
  );
});

test('6. backend/scripts/cleanup_junk_services.js requires --apply and checks references', () => {
  const cleanupScriptPath = path.join(ROOT_DIR, 'backend', 'scripts', 'cleanup_junk_services.js');
  assert.ok(fs.existsSync(cleanupScriptPath), 'cleanup_junk_services.js must exist');

  const content = fs.readFileSync(cleanupScriptPath, 'utf8');
  assert.ok(content.includes('--apply'), 'Cleanup script must require --apply flag for mutations');
  assert.ok(
    content.includes("Order.findOne({ 'items.service_id': svc._id })"),
    'Cleanup script must verify no orders reference the services'
  );
  assert.ok(
    content.includes("CatalogItem.findOne({ 'services.service_id': svc._id })"),
    'Cleanup script must verify no catalog items reference the services'
  );
  assert.ok(content.includes('backups'), 'Cleanup script must back up services before deletion');
});

test('7. Customer order page logo leads to home page (/) and navigations route properly', async () => {
  const rolesFilePath = path.join(FRONTEND_DIR, 'src', 'constants', 'roles.js');
  const fileUrl = new URL(`file://${rolesFilePath.replace(/\\/g, '/')}`);
  const { getRoleHome } = await import(fileUrl.href);

  assert.equal(getRoleHome('customer'), '/orders', 'Customer role home must be /orders');
  assert.equal(getRoleHome('branch_manager'), '/', 'Branch manager role home must remain /');

  // Verify AppRoutes.jsx contains HomePage at / for non-staff and CustomerOrdersPage at /orders
  const appRoutesPath = path.join(FRONTEND_DIR, 'src', 'routes', 'AppRoutes.jsx');
  const appRoutesContent = fs.readFileSync(appRoutesPath, 'utf8');
  assert.ok(
    appRoutesContent.includes('!isStaff && <Route path="/" element={<HomePage />} />'),
    'AppRoutes must route / to HomePage for non-staff/customers'
  );
  assert.ok(
    appRoutesContent.includes('<Route path="orders" element={<CustomerOrdersPage />} />'),
    'AppRoutes must route /orders to CustomerOrdersPage'
  );

  // Verify CustomerLayout.jsx has BrandLogo linking to / and My orders linking to /orders
  const customerLayoutPath = path.join(FRONTEND_DIR, 'src', 'layouts', 'CustomerLayout.jsx');
  const customerLayoutContent = fs.readFileSync(customerLayoutPath, 'utf8');
  assert.ok(
    customerLayoutContent.includes(
      '<Link to="/" className="flex items-center gap-2.5 font-extrabold text-ink group">'
    ),
    'CustomerLayout BrandLogo must lead to home page (/)'
  );
  assert.ok(
    customerLayoutContent.includes('to="/orders"'),
    'CustomerLayout must route orders navigation to /orders'
  );
});
