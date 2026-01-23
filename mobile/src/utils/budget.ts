export function getBudgetProgress(planned: number, actual: number) {
  if (planned <= 0) {
    return actual > 0 ? 1 : 0
  }

  return Math.min(Math.max(actual / planned, 0), 1)
}

export function isBudgetOver(planned: number, actual: number) {
  if (planned <= 0) {
    return actual > 0
  }

  return actual > planned
}
