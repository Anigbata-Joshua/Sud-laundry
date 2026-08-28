// Shared display helpers: keep currency, dates, weights, and statuses consistent across screens.
export const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
