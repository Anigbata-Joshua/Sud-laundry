// Owner: Josh
// Purpose: Unit & integration tests for Order Form Pricing UX (GarmentServiceSelector)
// Covers:
// 1. Card price equals line price for every item and service
// 2. No duplicate item+service lines after clicks (quantity increases)
// 3. Different service for same garment creates separate line
// 4. Per-line service dropdown changes: merging quantities if duplicate would occur
// 5. Line price always equals card price for that service
// 6. Disabled cards (is_available: false) cannot be added
// 7. UI totals equal server totals for standard and express

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExpressSurcharge } from '../src/controllers/order.controller.js';
import env from '../src/config/env.js';

// Reusable mock catalog items simulating branch catalog
const CORE_SERVICES = [
  'Washing & Folding',
  'Washing & Ironing',
  'Ironing',
  'Dry Cleaning',
  'Dry Cleaning & Pressing',
];

const mockServices = [
  { _id: 'srv-wf', name: 'Washing & Folding' },
  { _id: 'srv-wi', name: 'Washing & Ironing' },
  { _id: 'srv-ir', name: 'Ironing' },
  { _id: 'srv-dc', name: 'Dry Cleaning' },
  { _id: 'srv-dp', name: 'Dry Cleaning & Pressing' },
];

const mockCatalogItems = [
  {
    _id: 'item-shirt',
    name: 'T-Shirt',
    category: 'Casuals',
    piece_count: 1,
    services: [
      { service_id: 'srv-wf', service_name: 'Washing & Folding', price: 800, is_available: true },
      { service_id: 'srv-wi', service_name: 'Washing & Ironing', price: 1200, is_available: true },
      { service_id: 'srv-ir', service_name: 'Ironing', price: 600, is_available: true },
      { service_id: 'srv-dc', service_name: 'Dry Cleaning', price: 1500, is_available: true },
      { service_id: 'srv-dp', service_name: 'Dry Cleaning & Pressing', price: 2000, is_available: true },
    ],
  },
  {
    _id: 'item-polo',
    name: 'Polo Shirt',
    category: 'Casuals',
    piece_count: 1,
    services: [
      { service_id: 'srv-wf', service_name: 'Washing & Folding', price: 1000, is_available: true },
      { service_id: 'srv-wi', service_name: 'Washing & Ironing', price: 1400, is_available: true },
      { service_id: 'srv-ir', service_name: 'Ironing', price: 700, is_available: true },
      { service_id: 'srv-dc', service_name: 'Dry Cleaning', price: 1800, is_available: true },
      { service_id: 'srv-dp', service_name: 'Dry Cleaning & Pressing', price: 2200, is_available: true },
    ],
  },
  {
    _id: 'item-blazer',
    name: 'Blazer / Suit Jacket',
    category: 'Corporate Wear',
    piece_count: 1,
    services: [
      // Washing & Folding is NOT available for blazer
      { service_id: 'srv-wf', service_name: 'Washing & Folding', price: 2000, is_available: false },
      { service_id: 'srv-wi', service_name: 'Washing & Ironing', price: 2500, is_available: false },
      { service_id: 'srv-ir', service_name: 'Ironing', price: 1500, is_available: true },
      { service_id: 'srv-dc', service_name: 'Dry Cleaning', price: 3500, is_available: true },
      { service_id: 'srv-dp', service_name: 'Dry Cleaning & Pressing', price: 4500, is_available: true },
    ],
  },
  {
    _id: 'item-curtain',
    name: 'Window Curtain (per panel)',
    category: 'Bedding & Household',
    piece_count: 1,
    services: [
      { service_id: 'srv-wf', service_name: 'Washing & Folding', price: 2500, is_available: true },
      { service_id: 'srv-wi', service_name: 'Washing & Ironing', price: 3200, is_available: true },
      { service_id: 'srv-ir', service_name: 'Ironing', price: 1800, is_available: true },
      { service_id: 'srv-dc', service_name: 'Dry Cleaning', price: 4000, is_available: true },
      { service_id: 'srv-dp', service_name: 'Dry Cleaning & Pressing', price: 5000, is_available: true },
    ],
  },
];

// Helper functions implementing the exact GarmentServiceSelector line & pricing operations
function getCardPriceAndStatus(item, selectedServiceId) {
  const serviceEntry = (item.services || []).find(
    (s) => String(s.service_id) === String(selectedServiceId)
  );
  if (!serviceEntry || serviceEntry.is_available === false) {
    return { isOffered: false, price: null, serviceEntry: null };
  }
  return { isOffered: true, price: serviceEntry.price, serviceEntry };
}

function handleAddGarmentSimulation(selectedItems, garment, serviceEntry) {
  if (!garment || !serviceEntry || serviceEntry.is_available === false) {
    return selectedItems; // No change if disabled/unavailable
  }

  const existingIndex = selectedItems.findIndex(
    (line) =>
      line.catalog_item_id === garment._id &&
      String(line.service_id) === String(serviceEntry.service_id)
  );

  if (existingIndex >= 0) {
    const updated = [...selectedItems];
    const currentQty = updated[existingIndex].quantity || 1;
    const nextQty = currentQty + 1;
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: nextQty,
      subtotal: Math.round(updated[existingIndex].unit_price * nextQty * 100) / 100,
    };
    return updated;
  }

  const newLine = {
    line_id: `${garment._id}-${serviceEntry.service_id}-${Date.now()}`,
    catalog_item_id: garment._id,
    item_name: garment.name,
    item_category: garment.category,
    piece_count: garment.piece_count || 1,
    service_id: serviceEntry.service_id,
    service_name: serviceEntry.service_name,
    unit_price: serviceEntry.price,
    quantity: 1,
    subtotal: serviceEntry.price,
  };
  return [...selectedItems, newLine];
}

function handleServiceChangeSimulation(selectedItems, catalogItems, index, newServiceId) {
  const line = selectedItems[index];
  if (!line) return selectedItems;

  const garment = catalogItems.find((g) => g._id === line.catalog_item_id);
  if (!garment) return selectedItems;

  const newService = (garment.services || []).find(
    (s) => String(s.service_id) === String(newServiceId) && s.is_available
  );
  if (!newService) return selectedItems;

  const duplicateIndex = selectedItems.findIndex(
    (other, idx) =>
      idx !== index &&
      other.catalog_item_id === line.catalog_item_id &&
      String(other.service_id) === String(newService.service_id)
  );

  if (duplicateIndex >= 0) {
    // Merge into the duplicate line and remove current line
    const updated = selectedItems.filter((_, idx) => idx !== index);
    const targetIdx = duplicateIndex > index ? duplicateIndex - 1 : duplicateIndex;
    const mergedQty = Math.min(500, (updated[targetIdx].quantity || 1) + (line.quantity || 1));
    updated[targetIdx] = {
      ...updated[targetIdx],
      quantity: mergedQty,
      unit_price: newService.price,
      subtotal: Math.round(newService.price * mergedQty * 100) / 100,
    };
    return updated;
  }

  const updated = [...selectedItems];
  updated[index] = {
    ...line,
    service_id: newService.service_id,
    service_name: newService.service_name,
    unit_price: newService.price,
    subtotal: Math.round(newService.price * (line.quantity || 1) * 100) / 100,
  };
  return updated;
}

function calculateUiTotals(selectedItems, priority, expressPercent = env.expressSurchargePercent) {
  const subtotal = selectedItems.reduce((acc, line) => acc + (line.subtotal || 0), 0);
  const expressSurcharge =
    priority === 'express' ? Math.round(subtotal * (expressPercent / 100) * 100) / 100 : 0;
  const grandTotal = subtotal + expressSurcharge;
  return { subtotal, expressSurcharge, grandTotal };
}

test('1. Card price equals line price for every item and service', () => {
  for (const item of mockCatalogItems) {
    for (const service of mockServices) {
      const { isOffered, price, serviceEntry } = getCardPriceAndStatus(item, service._id);
      if (isOffered) {
        let lines = [];
        lines = handleAddGarmentSimulation(lines, item, serviceEntry);
        assert.equal(lines.length, 1);
        // Requirement 2 & 3: The line price must always equal the card price for that service
        assert.equal(lines[0].unit_price, price, `Line price must match card price for ${item.name} under ${service.name}`);
        assert.equal(lines[0].subtotal, price);
      }
    }
  }
});

test('2. No duplicate item+service lines after clicks (quantity increases)', () => {
  let lines = [];
  const polo = mockCatalogItems.find((i) => i.name === 'Polo Shirt');
  const wfService = polo.services.find((s) => s.service_name === 'Washing & Folding');

  // First click: adds 1 Polo Shirt with Washing & Folding
  lines = handleAddGarmentSimulation(lines, polo, wfService);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 1);
  assert.equal(lines[0].unit_price, 1000);
  assert.equal(lines[0].subtotal, 1000);

  // Second click: same garment + same service must increment quantity, not duplicate
  lines = handleAddGarmentSimulation(lines, polo, wfService);
  assert.equal(lines.length, 1, 'Should NOT create duplicate line for same item and service');
  assert.equal(lines[0].quantity, 2);
  assert.equal(lines[0].subtotal, 2000);

  // Third click
  lines = handleAddGarmentSimulation(lines, polo, wfService);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);
  assert.equal(lines[0].subtotal, 3000);
});

test('3. The same garment with a different service creates a separate line', () => {
  let lines = [];
  const polo = mockCatalogItems.find((i) => i.name === 'Polo Shirt');
  const wfService = polo.services.find((s) => s.service_name === 'Washing & Folding'); // 1000
  const ironService = polo.services.find((s) => s.service_name === 'Ironing'); // 700

  lines = handleAddGarmentSimulation(lines, polo, wfService);
  lines = handleAddGarmentSimulation(lines, polo, ironService);

  assert.equal(lines.length, 2, 'Different service for same garment must be a separate line');
  assert.equal(lines[0].service_name, 'Washing & Folding');
  assert.equal(lines[0].unit_price, 1000);
  assert.equal(lines[1].service_name, 'Ironing');
  assert.equal(lines[1].unit_price, 700);
});

test('4. Per-line service dropdown changes: merges quantities if duplicate would occur', () => {
  let lines = [];
  const polo = mockCatalogItems.find((i) => i.name === 'Polo Shirt');
  const wfService = polo.services.find((s) => s.service_name === 'Washing & Folding'); // 1000
  const ironService = polo.services.find((s) => s.service_name === 'Ironing'); // 700

  // Add 2 Washing & Folding
  lines = handleAddGarmentSimulation(lines, polo, wfService);
  lines = handleAddGarmentSimulation(lines, polo, wfService);
  assert.equal(lines[0].quantity, 2);

  // Add 3 Ironing
  lines = handleAddGarmentSimulation(lines, polo, ironService);
  lines = handleAddGarmentSimulation(lines, polo, ironService);
  lines = handleAddGarmentSimulation(lines, polo, ironService);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].quantity, 3);

  // User changes line 0 (Washing & Folding, qty 2) dropdown to Ironing
  lines = handleServiceChangeSimulation(lines, mockCatalogItems, 0, 'srv-ir');

  // Should merge line 0 and line 1 into a single line with quantity 5
  assert.equal(lines.length, 1, 'Duplicate line must be merged when changing dropdown');
  assert.equal(lines[0].service_name, 'Ironing');
  assert.equal(lines[0].unit_price, 700, 'Unit price must equal card price for the selected service');
  assert.equal(lines[0].quantity, 5);
  assert.equal(lines[0].subtotal, 3500);
});

test('5. Per-line service dropdown changes: updates price when no duplicate occurs', () => {
  let lines = [];
  const polo = mockCatalogItems.find((i) => i.name === 'Polo Shirt');
  const wfService = polo.services.find((s) => s.service_name === 'Washing & Folding'); // 1000

  lines = handleAddGarmentSimulation(lines, polo, wfService);
  assert.equal(lines[0].unit_price, 1000);

  // Change to Dry Cleaning (1800)
  lines = handleServiceChangeSimulation(lines, mockCatalogItems, 0, 'srv-dc');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].service_name, 'Dry Cleaning');
  assert.equal(lines[0].unit_price, 1800, 'Unit price must update to match Dry Cleaning card price');
  assert.equal(lines[0].subtotal, 1800);
});

test('6. Disabled card (is_available: false) cannot be added', () => {
  let lines = [];
  const blazer = mockCatalogItems.find((i) => i.name === 'Blazer / Suit Jacket');

  // Blazer has Washing & Folding disabled (is_available: false)
  const { isOffered, price, serviceEntry } = getCardPriceAndStatus(blazer, 'srv-wf');
  assert.equal(isOffered, false, 'Blazer under Washing & Folding must be marked not offered');
  assert.equal(price, null);

  // Attempting to add must NOT add any lines
  lines = handleAddGarmentSimulation(lines, blazer, serviceEntry);
  assert.equal(lines.length, 0, 'Disabled card must not be added to the order');
});

test('7. UI totals equal server totals for standard and express', () => {
  const shirt = mockCatalogItems.find((i) => i.name === 'T-Shirt');
  const curtain = mockCatalogItems.find((i) => i.name === 'Window Curtain (per panel)');

  let lines = [];
  // 2 T-Shirts under Washing & Folding (800 each = 1600)
  lines = handleAddGarmentSimulation(lines, shirt, shirt.services.find((s) => s.service_id === 'srv-wf'));
  lines = handleAddGarmentSimulation(lines, shirt, shirt.services.find((s) => s.service_id === 'srv-wf'));

  // 1 Curtain under Dry Cleaning (4000)
  lines = handleAddGarmentSimulation(lines, curtain, curtain.services.find((s) => s.service_id === 'srv-dc'));

  // Total subtotal: 1600 + 4000 = 5600
  assert.equal(lines.length, 2);

  // Test Standard Priority (normal)
  const stdUi = calculateUiTotals(lines, 'normal');
  const stdServerSurcharge = calculateExpressSurcharge(stdUi.subtotal, 'normal');
  const stdServerTotal = stdUi.subtotal + stdServerSurcharge;

  assert.equal(stdUi.subtotal, 5600);
  assert.equal(stdUi.expressSurcharge, 0);
  assert.equal(stdUi.grandTotal, 5600);
  assert.equal(stdServerSurcharge, 0);
  assert.equal(stdUi.grandTotal, stdServerTotal, 'UI standard total must equal server standard total');

  // Test Express Priority
  const expUi = calculateUiTotals(lines, 'express');
  const expServerSurcharge = calculateExpressSurcharge(expUi.subtotal, 'express');
  const expServerTotal = expUi.subtotal + expServerSurcharge;

  // 5600 * 0.30 = 1680
  assert.equal(expUi.subtotal, 5600);
  assert.equal(expUi.expressSurcharge, 1680);
  assert.equal(expUi.grandTotal, 7280);
  assert.equal(expServerSurcharge, 1680);
  assert.equal(expUi.grandTotal, expServerTotal, 'UI express total must equal server express total');
});

test('8. Express surcharge only increases price as separate line, never changes garment base price', () => {
  const polo = mockCatalogItems.find((i) => i.name === 'Polo Shirt');
  const wfService = polo.services.find((s) => s.service_id === 'srv-wf'); // 1000

  let lines = handleAddGarmentSimulation([], polo, wfService);

  // Base price in line
  assert.equal(lines[0].unit_price, 1000);

  // Priority toggled to express
  const expTotals = calculateUiTotals(lines, 'express');
  // Garment unit_price remains untouched
  assert.equal(lines[0].unit_price, 1000, 'Garment base unit price must not change with express');
  // Subtotal remains untouched
  assert.equal(expTotals.subtotal, 1000);
  // Surcharge is separate
  assert.equal(expTotals.expressSurcharge, 300);
  assert.equal(expTotals.grandTotal, 1300);
});
