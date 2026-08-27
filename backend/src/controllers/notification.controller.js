// Owner: series
// Purpose: customer-facing notification feed, mark-as-read.


// Owner: series
// Purpose: customer-facing notification feed + mark-as-read.

import Notification from '../models/notification.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import apiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';

//  logged-in user's own feed
export const getMyNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id; // adjust to however your auth middleware attaches the logged-in user

  // pagination and query support
  let { page = 1, limit = 20, is_read, type, q } = req.query;
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 20;

  const filter = { user_id: userId };
  if (typeof is_read !== 'undefined') filter.is_read = is_read === 'true';
  if (type) filter.type = type;
  if (q) {
    filter.$or = [
      { message: { $regex: q, $options: 'i' } },
    ];
  }

  const total = await Notification.countDocuments(filter);
  const notifications = await Notification.find(filter)
    .sort({ sent_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
  return apiResponse(res, 200, { items: notifications, meta }, 'Notifications retrieved successfully');
});

// read — mark a single notification as read
export const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const notification = await Notification.findOne({ _id: id, user_id: userId });
  if (!notification) {
    throw new apiError(404, 'Notification not found');
  }

  notification.is_read = true;
  await notification.save();

 return apiResponse(res, 200, notification, 'Notification marked as read');
});

// read-all — mark everything as read (nice to have)
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await Notification.updateMany(
    { user_id: userId, is_read: false },
    { $set: { is_read: true } }
  );

  return apiResponse(res, 200, null, 'All notifications marked as read');
});
