// Owner: Series
// Purpose: customer-facing notification feed and mark-as-read actions.
// Users can only view and modify their own notifications.

import Notification from '../models/notification.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';


/**
 * Get the authenticated user's notifications.
 *
 * GET /notifications
 *
 * Supports:
 * ?page=1
 * ?limit=20
 * ?is_read=true
 * ?type=order_update
 * ?q=search
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  let { page = 1, limit = 20, is_read, type, q, } = req.query;

  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const filter = { user_id: userId, };

  if (typeof is_read !== 'undefined') {
    if (is_read !== 'true' && is_read !== 'false') {
      throw new ApiError(400, 'is_read must be true or false');
    }

    filter.is_read = is_read === 'true';
  }

  if (type) {
    filter.type = type;
  }

  if (q) {
    filter.message = { $regex: q, $options: 'i' };
  }

  const total = await Notification.countDocuments(filter);

  const notifications = await Notification.find(filter)
    .sort({ sent_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const meta = { total, page, limit, totalPages: Math.ceil(total / limit), };

  return apiResponse(res, 200, { items: notifications, meta, }, 'Notifications retrieved successfully');
});


/**
 * Mark one notification as read.
 *
 * PATCH /notifications/:id/read
 *
 * The notification must belong to the authenticated user.
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  const { id } = req.params;

  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!id) {
    throw new ApiError(400, 'Notification ID is required');
  }

  const notification = await Notification.findOne({ _id: id, user_id: userId });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (!notification.is_read) {
    notification.is_read = true;
    await notification.save();
  }

  return apiResponse(res, 200, notification, 'Notification marked as read');
});


/**
 * Mark all notifications as read.
 *
 * PATCH /notifications/read-all
 *
 * Only the authenticated user's notifications are affected.
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const result = await Notification.updateMany(
    { user_id: userId, is_read: false },
    { $set: { is_read: true } }
  );

  return apiResponse(
    res, 200, { updatedCount: result.modifiedCount, }, 'All notifications marked as read'
  );
});