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
