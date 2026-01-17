// Currency precision: 2 decimal places (cents), scale factor 100
const DECIMAL_PRECISION = 2
const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)

/**
 * Convert a number to a decimal string with 2 decimal places.
 * Rounds to avoid floating point precision issues.
 */
export function toDecimalString(input: number): string {
  return (Math.round(input * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
}
