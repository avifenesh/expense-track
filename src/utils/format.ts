// Currency type matching Prisma schema enum
type Currency = "USD" | "EUR" | "ILS";

export function formatCurrency(
  value: number,
  currencyCode: Currency | string = "USD"
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatRelativeAmount(
  value: number,
  currencyCode: Currency | string = "USD"
) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  });
  const formatted = formatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}
