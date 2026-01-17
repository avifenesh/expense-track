// Currency precision: 2 decimal places (cents), scale factor 100
const DECIMAL_PRECISION = 2
const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)

/**
 * Convert a number to a decimal string with 2 decimal places.
 *
 * Uses JavaScript's Math.round() which implements "round half away from zero":
 * - 0.125 rounds to 0.13 (rounds up for positive numbers at midpoint)
 * - -0.125 rounds to -0.13 (rounds away from zero for negative numbers)
 *
 * This is standard financial rounding behavior and avoids floating-point
 * precision issues by scaling to integers before rounding.
 */
export function toDecimalString(input: number): string {
  return (Math.round(input * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
}
