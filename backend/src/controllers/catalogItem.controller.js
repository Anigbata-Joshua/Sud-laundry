// Owner: Josh
// Purpose: Catalog items CRUD and branch-to-branch price copying.

import mongoose from 'mongoose';
import CatalogItem from '../models/catalogItem.model.js';
import Service from '../models/service.model.js';
import Branch from '../models/branch.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import { textQuery, literalSearch } from '../utils/listQuery.js';

const CORE_SERVICE_NAMES = [
  'Washing & Folding',
  'Washing & Ironing',
  'Ironing',
  'Dry Cleaning',
  'Dry Cleaning & Pressing',
];

const VALID_CATEGORIES = [
  'Casuals',
  'Native & Traditional',
  'Corporate Wear',
  'Outerwear & Jackets',
  'Bedding & Household',
];

// GET /catalog-items
// Public catalog listing. Requires branch_id. Returns only active items.
export const getCatalogItems = asyncHandler(async (req, res) => {
  const { branch_id, category } = req.query;

  if (!branch_id) {
    throw new ApiError(400, 'branch_id is required to fetch catalog items');
  }

  if (!mongoose.isObjectIdOrHexString(branch_id)) {
    throw new ApiError(400, 'Invalid branch_id');
  }

  const filter = {
    branch_id,
    is_active: true,
  };

  if (category) {
    const cleanCategory = textQuery(category, 'category');
    if (cleanCategory) filter.category = cleanCategory;
  }

  const search = textQuery(req.query.q, 'q');
  if (search) {
    filter.name = literalSearch(search);
  }

  const items = await CatalogItem.find(filter)
    .select('branch_id name category description piece_count is_active services')
    .sort({ category: 1, name: 1 })
    .lean();

  return apiResponse(res, 200, items, 'Catalog items fetched successfully');
});

// GET /catalog-items/:id
export const getCatalogItemById = asyncHandler(async (req, res) => {
  const item = await CatalogItem.findById(req.params.id).lean();

  if (!item || !item.is_active) {
    throw new ApiError(404, 'Catalog item not found');
  }

  return apiResponse(res, 200, item, 'Catalog item retrieved successfully');
});

// POST /catalog-items
// Admin or Branch Manager (scoped to own branch)
export const createCatalogItem = asyncHandler(async (req, res) => {
  const { branch_id, name, category, description, piece_count = 1, services } = req.body;
  const currentUser = req.user;

  if (!['admin', 'branch_manager'].includes(currentUser.role)) {
    throw new ApiError(403, 'Only admins and branch managers can create catalog items');
  }

  let itemBranchId = branch_id;
  if (currentUser.role === 'branch_manager') {
    if (!currentUser.branch_id) {
      throw new ApiError(403, 'You are not assigned to any branch');
    }
    itemBranchId = currentUser.branch_id;
    if (branch_id && String(branch_id) !== String(itemBranchId)) {
      throw new ApiError(403, 'You can only create catalog items in your branch');
    }
  }

  if (!itemBranchId || !mongoose.isObjectIdOrHexString(itemBranchId)) {
    throw new ApiError(400, 'A valid branch_id is required');
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Item name is required');
  }

  if (!VALID_CATEGORIES.includes(category)) {
    throw new ApiError(400, `Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (!Array.isArray(services) || services.length === 0) {
    throw new ApiError(400, 'At least one service price configuration is required');
  }

  const parsedPieceCount = Number(piece_count);
  if (!Number.isFinite(parsedPieceCount) || parsedPieceCount < 1) {
    throw new ApiError(400, 'piece_count must be a positive number');
  }

  const trimmedName = name.trim();
  const existing = await CatalogItem.findOne({
    branch_id: itemBranchId,
    name: trimmedName,
  });

  if (existing) {
    throw new ApiError(409, 'A catalog item with this name already exists in this branch');
  }

  // Validate and format services
  const branchServices = await Service.find({
    branch_id: itemBranchId,
    is_active: true,
  }).lean();

  const branchServiceMap = new Map(branchServices.map((s) => [s._id.toString(), s]));
  const branchServiceNameMap = new Map(branchServices.map((s) => [s.name.toLowerCase(), s]));

  const formattedServices = services.map((svc) => {
    let matchedService = null;
    if (svc.service_id) {
      matchedService = branchServiceMap.get(String(svc.service_id));
    }
    if (!matchedService && svc.service_name) {
      matchedService = branchServiceNameMap.get(svc.service_name.trim().toLowerCase());
    }

    if (!matchedService) {
      throw new ApiError(400, `Service "${svc.service_name || svc.service_id}" is not available at this branch`);
    }

    const price = Number(svc.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new ApiError(400, `Invalid price for service "${matchedService.name}"`);
    }

    return {
      service_id: matchedService._id,
      service_name: matchedService.name,
      price,
      is_available: svc.is_available !== false,
    };
  });

  const catalogItem = await CatalogItem.create({
    branch_id: itemBranchId,
    name: trimmedName,
    category,
    description: description?.trim() || '',
    piece_count: parsedPieceCount,
    services: formattedServices,
    is_active: true,
  });

  return apiResponse(res, 201, catalogItem, 'Catalog item created successfully');
});

// PATCH /catalog-items/:id
export const updateCatalogItem = asyncHandler(async (req, res) => {
  const { name, category, description, piece_count, services, is_active } = req.body;
  const currentUser = req.user;

  if (!['admin', 'branch_manager'].includes(currentUser.role)) {
    throw new ApiError(403, 'You do not have permission to update catalog items');
  }

  const item = await CatalogItem.findById(req.params.id);
  if (!item) {
    throw new ApiError(404, 'Catalog item not found');
  }

  if (currentUser.role === 'branch_manager' && String(item.branch_id) !== String(currentUser.branch_id)) {
    throw new ApiError(403, 'You can only update catalog items in your branch');
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'Item name must be a non-empty string');
    }
    const trimmed = name.trim();
    const duplicate = await CatalogItem.findOne({
      branch_id: item.branch_id,
      name: trimmed,
      _id: { $ne: item._id },
    });
    if (duplicate) {
      throw new ApiError(409, 'An item with this name already exists in this branch');
    }
    item.name = trimmed;
  }

  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new ApiError(400, `Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    item.category = category;
  }

  if (description !== undefined) {
    item.description = typeof description === 'string' ? description.trim() : '';
  }

  if (piece_count !== undefined) {
    const pc = Number(piece_count);
    if (!Number.isFinite(pc) || pc < 1) {
      throw new ApiError(400, 'piece_count must be a positive number');
    }
    item.piece_count = pc;
  }

  if (is_active !== undefined) {
    item.is_active = Boolean(is_active);
  }

  if (Array.isArray(services) && services.length > 0) {
    const branchServices = await Service.find({
      branch_id: item.branch_id,
      is_active: true,
    }).lean();

    const branchServiceMap = new Map(branchServices.map((s) => [s._id.toString(), s]));
    const branchServiceNameMap = new Map(branchServices.map((s) => [s.name.toLowerCase(), s]));

    item.services = services.map((svc) => {
      let matchedService = null;
      if (svc.service_id) {
        matchedService = branchServiceMap.get(String(svc.service_id));
      }
      if (!matchedService && svc.service_name) {
        matchedService = branchServiceNameMap.get(svc.service_name.trim().toLowerCase());
      }

      if (!matchedService) {
        throw new ApiError(400, `Service "${svc.service_name || svc.service_id}" is not active at this branch`);
      }

      const price = Number(svc.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new ApiError(400, `Invalid price for service "${matchedService.name}"`);
      }

      return {
        service_id: matchedService._id,
        service_name: matchedService.name,
        price,
        is_available: svc.is_available !== false,
      };
    });
  }

  await item.save();
  return apiResponse(res, 200, item, 'Catalog item updated successfully');
});

// DELETE /catalog-items/:id (Soft delete)
export const deleteCatalogItem = asyncHandler(async (req, res) => {
  const currentUser = req.user;

  if (!['admin', 'branch_manager'].includes(currentUser.role)) {
    throw new ApiError(403, 'You do not have permission to delete catalog items');
  }

  const item = await CatalogItem.findById(req.params.id);
  if (!item) {
    throw new ApiError(404, 'Catalog item not found');
  }

  if (currentUser.role === 'branch_manager' && String(item.branch_id) !== String(currentUser.branch_id)) {
    throw new ApiError(403, 'You can only delete catalog items in your branch');
  }

  item.is_active = false;
  await item.save();

  return apiResponse(res, 200, { id: item._id, is_active: false }, 'Catalog item deactivated successfully');
});

// POST /catalog-items/copy-from-branch
// Admin only. Remaps service_id by name; requires target branch to have all 5 core services;
// skips existing items by name.
export const copyFromBranch = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can copy catalog prices between branches');
  }

  const { source_branch_id, target_branch_id } = req.body;

  if (!source_branch_id || !target_branch_id) {
    throw new ApiError(400, 'source_branch_id and target_branch_id are both required');
  }

  if (!mongoose.isObjectIdOrHexString(source_branch_id) || !mongoose.isObjectIdOrHexString(target_branch_id)) {
    throw new ApiError(400, 'Invalid branch IDs provided');
  }

  if (String(source_branch_id) === String(target_branch_id)) {
    throw new ApiError(400, 'Source and target branches must be different');
  }

  const [sourceBranch, targetBranch] = await Promise.all([
    Branch.findById(source_branch_id),
    Branch.findById(target_branch_id),
  ]);

  if (!sourceBranch) throw new ApiError(404, 'Source branch not found');
  if (!targetBranch) throw new ApiError(404, 'Target branch not found');

  // Verify target branch has all five core services
  const targetServices = await Service.find({
    branch_id: target_branch_id,
    is_active: true,
  }).lean();

  const targetServiceNames = new Set(targetServices.map((s) => s.name));
  const missingCoreServices = CORE_SERVICE_NAMES.filter((name) => !targetServiceNames.has(name));

  if (missingCoreServices.length > 0) {
    throw new ApiError(
      400,
      `Target branch "${targetBranch.name}" is missing required core services: ${missingCoreServices.join(', ')}. Please seed/create core services in target branch first.`,
    );
  }

  const targetServiceMapByName = new Map(targetServices.map((s) => [s.name.toLowerCase(), s]));

  // Find source catalog items
  const sourceItems = await CatalogItem.find({
    branch_id: source_branch_id,
    is_active: true,
  }).lean();

  if (sourceItems.length === 0) {
    return apiResponse(
      res,
      200,
      { copied_count: 0, skipped_count: 0, copied: [], skipped: [] },
      'Source branch has no active catalog items to copy',
    );
  }

  // Find existing target catalog items to skip
  const existingTargetItems = await CatalogItem.find({
    branch_id: target_branch_id,
  }).select('name').lean();

  const existingTargetNames = new Set(existingTargetItems.map((item) => item.name.toLowerCase()));

  const copied = [];
  const skipped = [];
  const toInsert = [];

  for (const src of sourceItems) {
    if (existingTargetNames.has(src.name.toLowerCase())) {
      skipped.push(src.name);
      continue;
    }

    // Remap services by name
    const remappedServices = [];
    for (const svc of src.services || []) {
      const targetSvc = targetServiceMapByName.get(svc.service_name.trim().toLowerCase());
      if (targetSvc) {
        remappedServices.push({
          service_id: targetSvc._id,
          service_name: targetSvc.name,
          price: svc.price,
          is_available: svc.is_available !== false,
        });
      }
    }

    if (remappedServices.length > 0) {
      toInsert.push({
        branch_id: target_branch_id,
        name: src.name,
        category: src.category,
        description: src.description || '',
        piece_count: src.piece_count || 1,
        services: remappedServices,
        is_active: true,
      });
      copied.push(src.name);
      existingTargetNames.add(src.name.toLowerCase());
    } else {
      skipped.push(src.name);
    }
  }

  if (toInsert.length > 0) {
    await CatalogItem.insertMany(toInsert);
  }

  return apiResponse(
    res,
    200,
    {
      copied_count: copied.length,
      skipped_count: skipped.length,
      copied,
      skipped,
    },
    `Successfully copied ${copied.length} items from ${sourceBranch.name} to ${targetBranch.name}`,
  );
});
