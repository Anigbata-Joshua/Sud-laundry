import mongoose from "mongoose";
import Product from "../models/product.model.js";
import StockMovement from "../models/stockMovement.model.js";
import Employee from "../models/employee.model.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import SupplyRequest from "../models/supplyRequest.model.js";
import ApiError from "../utils/apiError.js";
import createNotification from "./notification.service.js";
import {
  SERVICE_SUPPLIES_RECIPE,
  DEFAULT_PACKAGING_PER_UNIT,
  STAGE_SERVICE_CATEGORIES,
  calculateEffectivePieces,
  getTier,
} from "../config/serviceSupplies.config.js";
import logger from "../utils/logger.js";

// Calculate the amount of supply needed for a specific workflow step
export function calculateSuppliesForStep({ order, stepName }) {
  const totals = new Map(); // productName -> { quantity, unit }

  const addAmount = (productName, quantity, unit) => {
    const existing = totals.get(productName);
    if (existing) {
      existing.quantity += quantity;
    } else {
      totals.set(productName, { quantity, unit });
    }
  };

  const relevantCategories = STAGE_SERVICE_CATEGORIES[stepName];

  for (const item of order.items ?? []) {
    // Only count a service's supplies against the stage it actually belongs to
    if (
      relevantCategories &&
      !relevantCategories.some(
        (cat) => cat.toLowerCase() === (item.category || "").toLowerCase(),
      )
    ) {
      continue;
    }

    const recipe =
      SERVICE_SUPPLIES_RECIPE[item.service_name || item.name];
    if (!recipe) continue; // service has no supply requirement

    const effectivePieces = calculateEffectivePieces(
      item.quantity,
      item.piece_count || 1,
    );

    if (recipe.perUnit) {
      for (const supply of recipe.perUnit) {
        addAmount(
          supply.productName,
          supply.quantity * effectivePieces,
          supply.unit,
        );
      }
      continue;
    }

    const tier = getTier(effectivePieces);
    const tierSupplies = recipe[tier];
    if (!tierSupplies) continue;

    for (const supply of tierSupplies) {
      addAmount(supply.productName, supply.quantity, supply.unit);
    }
  }

  if (stepName === "packaging") {
    // Only real garments need packaging materials
    const totalGarments = (order.items ?? [])
      .filter((item) => item.type === "service")
      .reduce(
        (sum, item) =>
          sum + calculateEffectivePieces(item.quantity, item.piece_count || 1),
        0,
      );
    for (const supply of DEFAULT_PACKAGING_PER_UNIT) {
      addAmount(
        supply.productName,
        supply.quantity * totalGarments,
        supply.unit,
      );
    }
  }

  return Array.from(totals.entries()).map(
    ([productName, { quantity, unit }]) => ({
      productName,
      quantity,
      unit,
    }),
  );
}

// Calculate supply requirements across the entire order
export function calculateSuppliesForOrder(order) {
  const stageNames = ["washing", "processing", "packaging"];
  const stageSupplies = {};
  const totalSuppliesMap = new Map();

  for (const stageName of stageNames) {
    const supplies = calculateSuppliesForStep({ order, stepName: stageName });
    stageSupplies[stageName] = supplies;
    for (const s of supplies) {
      const existing = totalSuppliesMap.get(s.productName);
      if (existing) {
        existing.quantity += s.quantity;
      } else {
        totalSuppliesMap.set(s.productName, {
          productName: s.productName,
          quantity: s.quantity,
          unit: s.unit,
        });
      }
    }
  }

  const totalSupplies = Array.from(totalSuppliesMap.values());
  return { totalSupplies, stageSupplies };
}

// Resolves calculated productNames to real Product documents at the branch
export async function resolveSuppliesToProducts({ branch_id, supplies }) {
  const resolved = [];
  for (const supply of supplies) {
    const product = await Product.findOne({
      branch_id,
      name: { $regex: new RegExp(`^${supply.productName}$`, "i") },
      is_active: true,
    });

    const available = product
      ? product.quantity - (product.reserved_quantity || 0)
      : null;

    resolved.push({
      product_id: product?._id ?? null,
      product_name: supply.productName,
      quantity: supply.quantity,
      unit: supply.unit,
      stock: product ? product.quantity : null,
      reserved: product ? product.reserved_quantity || 0 : null,
      available,
      found: Boolean(product),
      product,
    });
  }
  return resolved;
}

// Notify officers and branch managers of inventory shortages
export async function notifyOfficersOfStockShortage({
  branchId,
  productName,
  required,
  available = 0,
  unit = "units",
  missing = false,
}) {
  try {
    const branchEmployees = await Employee.find({
      branch_id: branchId,
      is_active: true,
    }).select("user_id");

    if (!branchEmployees.length) return;

    const userIds = branchEmployees.map((emp) => emp.user_id);
    const recipients = await User.find({
      _id: { $in: userIds },
      role: { $in: ["branch_manager", "inventory_officer"] },
      is_active: true,
    }).select("_id");

    const message = missing
      ? `⚠️ Out of Stock Alert: Product "${productName}" is not available or inactive at your branch. Restock required to accept new orders.`
      : `⚠️ Stock Shortage Alert: Product "${productName}" has only ${available} ${unit} available, but ${required} ${unit} was requested for an incoming order. Please restock immediately.`;

    for (const recipient of recipients) {
      await createNotification({
        user_id: recipient._id,
        type: "other",
        message,
      });
    }
  } catch (err) {
    logger.error("Failed to notify officers of stock shortage:", {
      error: err.message,
    });
  }
}

// Notify customer when service is temporarily unavailable due to stock shortage
export async function notifyCustomerOfStockShortage({
  customerId,
  productName: _productName,
}) {
  if (!customerId) return;
  try {
    await createNotification({
      user_id: customerId,
      type: "other",
      message:
        "We're sorry, your order could not be placed because required supplies are temporarily out of stock at the selected branch.",
    });
  } catch (err) {
    logger.error("Failed to notify customer of stock shortage:", {
      error: err.message,
    });
  }
}

// Check stock and atomically reserve required quantities for an order
export async function checkAndReserveSuppliesForOrder({
  branch_id,
  items,
  customer_id = null,
}) {
  const { totalSupplies, stageSupplies } = calculateSuppliesForOrder({ items });
  if (!totalSupplies.length) return [];

  const resolved = await resolveSuppliesToProducts({
    branch_id,
    supplies: totalSupplies,
  });

  // 1. Verify existence and stock availability
  for (const item of resolved) {
    if (!item.found || !item.product_id) {
      await Promise.all([
        notifyCustomerOfStockShortage({
          customerId: customer_id,
          productName: item.product_name,
        }),
        notifyOfficersOfStockShortage({
          branchId: branch_id,
          productName: item.product_name,
          required: item.quantity,
          unit: item.unit,
          missing: true,
        }),
      ]);
      throw new ApiError(
        409,
        `Product "${item.product_name}" is not available at the selected branch to process this order`,
      );
    }

    if (item.available < item.quantity) {
      await Promise.all([
        notifyCustomerOfStockShortage({
          customerId: customer_id,
          productName: item.product_name,
        }),
        notifyOfficersOfStockShortage({
          branchId: branch_id,
          productName: item.product_name,
          required: item.quantity,
          available: Math.max(0, item.available),
          unit: item.unit || "units",
        }),
      ]);
      throw new ApiError(
        409,
        "This service is temporarily unavailable. Please try again later or choose another branch.",
      );
    }
  }

  // 2. Perform atomic reservation
  const reservedBatch = [];
  try {
    for (const item of resolved) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: item.product_id,
          branch_id,
          is_active: true,
          $expr: {
            $gte: [
              {
                $subtract: [
                  "$quantity",
                  { $ifNull: ["$reserved_quantity", 0] },
                ],
              },
              item.quantity,
            ],
          },
        },
        {
          $inc: { reserved_quantity: item.quantity },
        },
        { new: true },
      );

      if (!updated) {
        // Concurrent reservation collision: rollback already reserved items in this batch
        throw new ApiError(
          409,
          `Insufficient stock for "${item.product_name}" due to simultaneous demand. Please try again.`,
        );
      }

      reservedBatch.push({
        product_id: item.product_id,
        quantity: item.quantity,
        name: updated.name,
        unit: updated.unit,
      });
    }
  } catch (error) {
    // Rollback any reserved quantities in this attempt
    if (reservedBatch.length) {
      await Promise.all(
        reservedBatch.map((r) =>
          Product.updateOne(
            { _id: r.product_id },
            { $inc: { reserved_quantity: -r.quantity } },
          ),
        ),
      );
    }
    await Promise.all([
      notifyCustomerOfStockShortage({
        customerId: customer_id,
        productName: resolved[reservedBatch.length]?.product_name || "Supplies",
      }),
      notifyOfficersOfStockShortage({
        branchId: branch_id,
        productName: resolved[reservedBatch.length]?.product_name || "Supplies",
        required: resolved[reservedBatch.length]?.quantity || 1,
        available: 0,
        unit: resolved[reservedBatch.length]?.unit || "units",
      }),
    ]);
    throw error;
  }

  // 3. Build supplies_reserved array for the order
  const prodMap = new Map(
    resolved.map((r) => [r.product_name.toLowerCase(), r.product_id]),
  );
  const supplies_reserved = [];

  for (const [stage, supplies] of Object.entries(stageSupplies)) {
    for (const s of supplies) {
      const prodId = prodMap.get(s.productName.toLowerCase());
      if (prodId) {
        supplies_reserved.push({
          product_id: prodId,
          name: s.productName,
          quantity: s.quantity,
          unit: s.unit,
          stage,
          consumed: false,
        });
      }
    }
  }

  return supplies_reserved;
}

// Release unconsumed reservations on cancellation
export async function releaseReservedSuppliesForOrder(order) {
  if (!order?.supplies_reserved || !order.supplies_reserved.length) return;

  const toRelease = new Map();
  for (const item of order.supplies_reserved) {
    if (!item.consumed && item.quantity > 0 && item.product_id) {
      const prodId = item.product_id.toString();
      toRelease.set(prodId, (toRelease.get(prodId) || 0) + item.quantity);
    }
  }

  if (toRelease.size === 0) return;

  const releasedBatch = [];
  try {
    for (const [prodId, qty] of toRelease.entries()) {
      await Product.updateOne(
        { _id: prodId },
        { $inc: { reserved_quantity: -qty } },
      );
      releasedBatch.push({ prodId, qty });
    }
    for (const item of order.supplies_reserved) {
      if (!item.consumed && item.quantity > 0) {
        item.consumed = true;
      }
    }
  } catch (error) {
    if (releasedBatch.length) {
      await Promise.all(
        releasedBatch.map((r) =>
          Product.updateOne(
            { _id: r.prodId },
            { $inc: { reserved_quantity: r.qty } },
          ).catch((e) =>
            logger.error("Failed rollback in releaseReservedSuppliesForOrder:", {
              error: e.message,
            }),
          ),
        ),
      );
    }
    throw error;
  }
}

// Consume reserved supplies when attendant starts/accepts a stage
export async function consumeReservedSuppliesForStep({
  order,
  step,
  employee_id,
}) {
  if (!order?.supplies_reserved || !order.supplies_reserved.length) return;
  const stageItems = order.supplies_reserved.filter((item) => {
    if (item.consumed) return false;
    // Single processing workflow step consumes all reserved supplies for the order
    if (step.name === 'processing') return true;
    // Legacy multi-step workflows filter by matching stage
    return item.stage === step.name;
  });
  if (!stageItems.length) return;

  const lowStockAlerts = [];
  const appliedProducts = [];
  const createdMovements = [];
  const initialSuppliesUsedCount = (order.supplies_used || []).length;

  try {
    for (const item of stageItems) {
      const product = await Product.findById(item.product_id);
      if (product) {
        const prevQuantity = product.quantity;
        const prevReserved = product.reserved_quantity || 0;

        product.quantity = Math.max(0, product.quantity - item.quantity);
        product.reserved_quantity = Math.max(
          0,
          (product.reserved_quantity || 0) - item.quantity,
        );
        await product.save();
        appliedProducts.push({
          productId: product._id,
          prevQuantity,
          prevReserved,
        });

        const movement = await StockMovement.create([
          {
            product_id: product._id,
            branch_id: order.branch_id,
            employee_id,
            order_id: order._id,
            type: "usage",
            quantity: -item.quantity,
            notes: `Automatic supply usage for Order #${order._id
              .toString()
              .slice(-6)
              .toUpperCase()} (${step.name})`,
          },
        ]);
        if (movement && movement[0]) {
          createdMovements.push(movement[0]._id);
        }

        order.supplies_used.push({
          product_id: product._id,
          name: product.name,
          quantity_used: item.quantity,
          employee_id,
          used_at: new Date(),
        });

        item.consumed = true;

        if (
          product.reorder_point > 0 &&
          product.quantity <= product.reorder_point
        ) {
          lowStockAlerts.push({
            productName: product.name,
            remaining: product.quantity,
            reorderPoint: product.reorder_point,
            unit: product.unit || "units",
            branchId: order.branch_id,
          });
        }
      }
    }

    await order.save();
  } catch (error) {
    for (const item of stageItems) {
      item.consumed = false;
    }
    if (order.supplies_used) {
      order.supplies_used.splice(initialSuppliesUsedCount);
    }
    if (appliedProducts.length) {
      await Promise.all(
        appliedProducts.map((p) =>
          Product.updateOne(
            { _id: p.productId },
            {
              $set: {
                quantity: p.prevQuantity,
                reserved_quantity: p.prevReserved,
              },
            },
          ).catch((e) =>
            logger.error("Failed product rollback in consumeReservedSuppliesForStep:", {
              error: e.message,
            }),
          ),
        ),
      );
    }
    if (createdMovements.length) {
      await StockMovement.deleteMany({
        _id: { $in: createdMovements },
      }).catch((e) =>
        logger.error("Failed movement deletion in consumeReservedSuppliesForStep:", {
          error: e.message,
        }),
      );
    }
    throw error;
  }

  for (const alert of lowStockAlerts) {
    await notifyBranchManagersOfLowStock(alert);
  }
}

// Adjust reserved stock when intake quantities are corrected
export async function adjustReservedSuppliesForIntake({
  order,
  intakeItems,
  branch_id,
}) {
  const currentUnconsumed = (order.supplies_reserved || []).filter(
    (s) => !s.consumed,
  );
  const { totalSupplies: newTotals, stageSupplies: newStages } =
    calculateSuppliesForOrder({
      items: intakeItems,
    });
  const resolvedNew = await resolveSuppliesToProducts({
    branch_id,
    supplies: newTotals,
  });

  const prevMap = new Map();
  for (const item of currentUnconsumed) {
    const idStr = item.product_id.toString();
    prevMap.set(idStr, (prevMap.get(idStr) || 0) + item.quantity);
  }

  const newMap = new Map();
  for (const item of resolvedNew) {
    if (item.product_id) {
      const idStr = item.product_id.toString();
      newMap.set(idStr, (newMap.get(idStr) || 0) + item.quantity);
    }
  }

  const allProdIds = new Set([...prevMap.keys(), ...newMap.keys()]);
  const deltas = [];
  for (const prodId of allProdIds) {
    const prevQty = prevMap.get(prodId) || 0;
    const newQty = newMap.get(prodId) || 0;
    const delta = newQty - prevQty;
    if (delta !== 0) {
      deltas.push({ prodId, delta, prevQty, newQty });
    }
  }

  // 1. Pre-check: Verify all products that need increase have sufficient stock before touching ANY product
  for (const { prodId, delta } of deltas) {
    if (delta > 0) {
      const itemInfo = resolvedNew.find(
        (r) => r.product_id && r.product_id.toString() === prodId.toString(),
      );
      const available = itemInfo?.available ?? -1;
      if (!itemInfo || !itemInfo.found || available < delta) {
        const productName = itemInfo?.product_name || "Supplies";
        try {
          await notifyOfficersOfStockShortage({
            branchId: branch_id,
            productName,
            required: delta,
            available: Math.max(0, available),
            unit: itemInfo?.unit || "units",
          });
        } catch (notifyErr) {
          logger.error("Failed to notify officers during intake shortage:", {
            error: notifyErr.message,
          });
        }
        throw new ApiError(
          409,
          "Insufficient stock available to increase intake quantities",
        );
      }
    }
  }

  // 2. Atomically apply adjustments with full rollback tracking
  const appliedBatch = [];
  try {
    for (const { prodId, delta } of deltas) {
      if (delta > 0) {
        const updated = await Product.findOneAndUpdate(
          {
            _id: prodId,
            branch_id,
            is_active: true,
            $expr: {
              $gte: [
                {
                  $subtract: [
                    "$quantity",
                    { $ifNull: ["$reserved_quantity", 0] },
                  ],
                },
                delta,
              ],
            },
          },
          { $inc: { reserved_quantity: delta } },
          { new: true },
        );
        if (!updated) {
          const itemInfo = resolvedNew.find(
            (r) => r.product_id && r.product_id.toString() === prodId.toString(),
          );
          const productName = itemInfo?.product_name || "Supplies";
          try {
            await notifyOfficersOfStockShortage({
              branchId: branch_id,
              productName,
              required: delta,
              unit: itemInfo?.unit || "units",
            });
          } catch (notifyErr) {
            logger.error("Failed to notify officers during intake shortage:", {
              error: notifyErr.message,
            });
          }
          throw new ApiError(
            409,
            "Insufficient stock available to increase intake quantities",
          );
        }
        appliedBatch.push({ prodId, delta });
      } else if (delta < 0) {
        await Product.updateOne(
          { _id: prodId },
          { $inc: { reserved_quantity: delta } },
        );
        appliedBatch.push({ prodId, delta });
      }
    }
  } catch (error) {
    // Rollback any modifications made in this attempt
    if (appliedBatch.length) {
      await Promise.all(
        appliedBatch.map((a) =>
          Product.updateOne(
            { _id: a.prodId },
            { $inc: { reserved_quantity: -a.delta } },
          ).catch((rollbackErr) => {
            logger.error("Failed rollback in adjustReservedSuppliesForIntake:", {
              error: rollbackErr.message,
            });
          }),
        ),
      );
    }
    throw error;
  }

  const consumedItems = (order.supplies_reserved || []).filter(
    (s) => s.consumed,
  );
  const updatedUnconsumed = [];
  const prodMap = new Map(
    resolvedNew.map((r) => [r.product_name.toLowerCase(), r.product_id]),
  );

  for (const [stage, supplies] of Object.entries(newStages)) {
    for (const s of supplies) {
      const prodId = prodMap.get(s.productName.toLowerCase());
      if (prodId) {
        updatedUnconsumed.push({
          product_id: prodId,
          name: s.productName,
          quantity: s.quantity,
          unit: s.unit,
          stage,
          consumed: false,
        });
      }
    }
  }

  order.supplies_reserved = [...consumedItems, ...updatedUnconsumed];
}

// Deducts stock for an APPROVED manual supply request (fallback flow)
export async function disburseApprovedSupplies({ order, supplyRequest }) {
  const session = await mongoose.startSession();
  const lowStockAlerts = [];

  try {
    await session.withTransaction(async () => {
      lowStockAlerts.length = 0;
      const claimed = await SupplyRequest.findOneAndUpdate(
        { _id: supplyRequest._id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewed_by: supplyRequest.reviewed_by,
            reviewed_at: supplyRequest.reviewed_at,
          },
        },
        { new: true, session },
      );
      if (!claimed)
        throw new ApiError(409, "This request has already been reviewed");
      const currentOrder = await Order.findById(order._id).session(session);
      if (
        !currentOrder ||
        String(currentOrder.branch_id) !== String(supplyRequest.branch_id)
      ) {
        throw new ApiError(409, "Request order or branch is invalid");
      }
      for (const line of supplyRequest.approved_items) {
        const product = await Product.findById(line.product_id).session(
          session,
        );
        if (!product) {
          throw new ApiError(404, `Product not found: ${line.product_id}`);
        }
        if (
          !product.is_active ||
          String(product.branch_id) !== String(supplyRequest.branch_id)
        ) {
          throw new ApiError(
            400,
            "Approved items must be active products in the request branch",
          );
        }
        line.product_name = product.name;
        line.unit = product.unit;

        if (product.quantity < line.quantity) {
          throw new ApiError(
            409,
            `Insufficient stock for "${product.name}": have ${product.quantity} ${product.unit || "units"}, tried to disburse ${line.quantity}`,
          );
        }

        product.quantity -= line.quantity;
        await product.save({ session });

        await StockMovement.create(
          [
            {
              product_id: product._id,
              branch_id: supplyRequest.branch_id,
              employee_id: supplyRequest.requested_by,
              order_id: order._id,
              type: "usage",
              quantity: -line.quantity,
              notes: `Approved by inventory officer for Order #${order._id
                .toString()
                .slice(-6)} (request ${supplyRequest._id})`,
            },
          ],
          { session },
        );

        currentOrder.supplies_used.push({
          product_id: product._id,
          name: product.name,
          quantity_used: line.quantity,
          employee_id: supplyRequest.requested_by,
          used_at: new Date(),
        });

        if (
          product.reorder_point > 0 &&
          product.quantity <= product.reorder_point
        ) {
          lowStockAlerts.push({
            productName: product.name,
            remaining: product.quantity,
            reorderPoint: product.reorder_point,
            unit: product.unit || "units",
            branchId: supplyRequest.branch_id,
          });
        }
      }

      await currentOrder.save({ session });
      await SupplyRequest.updateOne(
        { _id: supplyRequest._id },
        { $set: { approved_items: supplyRequest.approved_items } },
        { session, runValidators: true },
      );
    });
  } finally {
    await session.endSession();
  }

  for (const alert of lowStockAlerts) {
    await notifyBranchManagersOfLowStock(alert);
  }
}

export const notifyBranchManagersOfLowStock = async ({
  productName,
  remaining,
  reorderPoint,
  unit = "units",
  branchId,
}) => {
  try {
    const branchEmployees = await Employee.find({
      branch_id: branchId,
      is_active: true,
    }).select("user_id");

    if (!branchEmployees.length) return;

    const userIds = branchEmployees.map((emp) => emp.user_id);

    const managers = await User.find({
      _id: { $in: userIds },
      role: { $in: ["branch_manager", "inventory_officer"] },
      is_active: true,
    }).select("_id");

    const alertMessage = `⚠️ Low Stock Alert: Product "${productName}" has only ${remaining} ${unit} left at your branch (Reorder point: ${reorderPoint} ${unit}). Please restock.`;

    for (const manager of managers) {
      await createNotification({
        user_id: manager._id,
        type: "other",
        message: alertMessage,
      });
    }
  } catch (err) {
    logger.error("Failed to notify branch managers of low stock:", {
      error: err.message,
    });
  }
};

export default {
  calculateSuppliesForStep,
  calculateSuppliesForOrder,
  resolveSuppliesToProducts,
  notifyOfficersOfStockShortage,
  notifyCustomerOfStockShortage,
  checkAndReserveSuppliesForOrder,
  releaseReservedSuppliesForOrder,
  consumeReservedSuppliesForStep,
  adjustReservedSuppliesForIntake,
  disburseApprovedSupplies,
  notifyBranchManagersOfLowStock,
};
