// Customer-facing wording for order.status. Staff-facing views can keep
// showing the raw StatusBadge (now correctly formatted); this is for
// customers who don't need internal terms like "quality_check".
export const ORDER_STATUS_LABELS = {
  placed: 'Order placed',
  received: 'Received at branch',
  processing: 'Being processed',
  quality_check: 'Being inspected',
  ready: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function getCustomerStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] ?? status.replaceAll('_', ' ')
}