// Owner: Series (SHARED — called byJasmine and Josh). See guides/ for the shared-file rule.
// Purpose: creates an in-app notification whenever an order or task status changes.

import Notification from '../models/notification.model.js';


const createNotification = async ({ user_id, order_id, type, message }) => {
  if (!user_id || !type || !message) {
    throw new Error('createNotification requires user_id, type, and message');
  }

  const notification = await Notification.create({
    user_id,
    order_id,
    type,
    message,
    sent_at: new Date(),
  });

  return notification;
};

export default createNotification;