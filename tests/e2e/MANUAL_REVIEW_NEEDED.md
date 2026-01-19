# Manual Review Needed

## Hardcoded Timeouts

The following test files contain `page.waitForTimeout(500)` which is an anti-pattern:

- `budgets.spec.ts` (lines 129, 144)
- `dashboard.spec.ts` (lines 52, 68, 94)
- `transactions.spec.ts` (lines 159, 162, 179)

### Why This Is A Problem

Hardcoded timeouts make tests:
- Slower than necessary
- Flaky (race conditions)
- Harder to maintain

### Recommended Fix

Replace `page.waitForTimeout(500)` with proper Playwright wait strategies:

```typescript
// BAD
await monthSelect.selectOption({ index: 0 })
await page.waitForTimeout(500)

// GOOD - Wait for network idle
await monthSelect.selectOption({ index: 0 })
await page.waitForLoadState('networkidle')

// GOOD - Wait for specific element
await monthSelect.selectOption({ index: 0 })
await expect(page.getByText('Loading...')).not.toBeVisible()

// GOOD - Wait for URL change
await monthSelect.selectOption({ index: 0 })
await page.waitForURL(/month=/)
```

### Action Required

Developer should:
1. Identify what state change each test is waiting for
2. Replace arbitrary timeout with appropriate wait condition
3. Test to ensure no flakiness
