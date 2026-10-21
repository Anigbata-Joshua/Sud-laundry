export const formatNaira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
}).format

export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '—'

export function formatOrderItem(item) {
  if (!item) return ''
  const garment = item.item_name
  const service = item.service_name || item.name
  if (garment && service && garment !== service) {
    return `${garment} · ${service}`
  }
  return garment || service || 'Laundry service'
}
