// Owner: Josh
// Purpose: Scheduled periodic admin digest notification aggregating order counts per branch.

import cron from "node-cron";
import Order from "../models/order.model.js";
import Branch from "../models/branch.model.js";
import User from "../models/user.model.js";
import createNotification from "../services/notification.service.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";

// Aggregate orders per branch and send branch_digest notifications to all active admins
export async function generateAdminDigests({ now = new Date(), since } = {}) {
  const periodStart =
    since || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

  const [admins, branches] = await Promise.all([
    User.find({ role: "admin", is_active: true }).select("_id"),
    Branch.find({ is_active: true }).select("_id name"),
  ]);

  if (!admins.length || !branches.length) {
    logger.info("ℹ️ Admin digest skipped: no active admins or branches found.");
    return {
      adminCount: admins.length,
      branchCount: branches.length,
      notificationsSent: 0,
    };
  }

  const aggregates = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: periodStart, $lte: now },
      },
    },
    {
      $group: {
        _id: "$branch_id",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: "$total_price" },
      },
    },
  ]);

  const statsMap = new Map(
    aggregates.map((item) => [
      item._id?.toString(),
      { orderCount: item.orderCount, totalRevenue: item.totalRevenue },
    ]),
  );

  let notificationsSent = 0;

  for (const branch of branches) {
    const stats = statsMap.get(branch._id.toString()) || {
      orderCount: 0,
      totalRevenue: 0,
    };
    const formattedRevenue = Number(stats.totalRevenue || 0).toLocaleString();
    const message = `📊 [${branch.name}] Order Digest: ${stats.orderCount} order${
      stats.orderCount === 1 ? "" : "s"
    } placed over the period (Total: ₦${formattedRevenue}).`;

    for (const admin of admins) {
      try {
        await createNotification({
          user_id: admin._id,
          type: "branch_digest",
          message,
        });
        notificationsSent++;
      } catch (error) {
        logger.error("Failed to dispatch admin digest notification", {
          adminId: admin._id,
          branchId: branch._id,
          error: error.message,
        });
      }
    }
  }

  return {
    adminCount: admins.length,
    branchCount: branches.length,
    notificationsSent,
  };
}

// Start the cron scheduler for admin branch order digest
export function startAdminDigestJob() {
  const schedule = env.adminDigestSchedule || "0 8 * * 1";
  logger.info(
    `📅 Scheduling Admin Digest cron job with schedule: "${schedule}"`,
  );

  return cron.schedule(
    schedule,
    async () => {
      try {
        logger.info("🔄 Running scheduled admin branch order digest...");
        const result = await generateAdminDigests();
        logger.info(
          `✅ Admin branch order digest completed (${result.notificationsSent} notices sent).`,
        );
      } catch (error) {
        logger.error("❌ Error during scheduled admin digest:", {
          error: error.message,
        });
      }
    },
    { timezone: "Africa/Lagos" },
  );
}

export default {
  generateAdminDigests,
  startAdminDigestJob,
};
