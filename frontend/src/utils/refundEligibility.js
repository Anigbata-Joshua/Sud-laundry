export function isWithinRefundWindow(order, now = Date.now()) {
  if (!order || typeof order !== 'object') return false
  if (order.status !== 'delivered') return true
  const deliveredAt = order.delivered_at ? new Date(order.delivered_at).getTime() : NaN
  return Number.isFinite(deliveredAt) && now < deliveredAt + 48 * 60 * 60 * 1000
}
