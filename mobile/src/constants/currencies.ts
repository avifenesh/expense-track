import type { Currency } from '../stores'

/**
 * Supported currencies with display information.
 * This is the single source of truth for currency options across the app.
 */
export const CURRENCIES = [
  { code: 'USD' as Currency, symbol: '$', name: 'US Dollar', label: 'US Dollar (USD)' },
  { code: 'EUR' as Currency, symbol: '\u20AC', name: 'Euro', label: 'Euro (EUR)' },
  { code: 'ILS' as Currency, symbol: '\u20AA', name: 'Israeli Shekel', label: 'Israeli Shekel (ILS)' },
] as const

export type CurrencyInfo = (typeof CURRENCIES)[number]
