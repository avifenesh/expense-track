const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatCurrency(value: number, currencyCode = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatRelativeAmount(value: number) {
  const formatted = currency.format(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}
