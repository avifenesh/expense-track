# Agent 3: Finance, Dashboard & Tests

**Branch name:** `tech-debt/finance-cache`
**Priority:** MEDIUM
**Estimated issues:** 6

## Parallel Work Awareness

You are one of 4 agents working simultaneously on technical debt. Other agents are working on:

| Agent | Branch | Area | Files |
|-------|--------|------|-------|
| Agent 1 | `tech-debt/auth-layer` | Auth & session | `src/lib/api-auth.ts`, `src/lib/auth-server.ts` |
| Agent 2 | `tech-debt/api-routes` | API routes & docs | `src/app/api/v1/*`, `tests/api/*` |
| Agent 4 | `tech-debt/services-db` | Services & database | `src/lib/services/*`, `prisma/schema.prisma` |

**Your exclusive files (no collision risk):**
- `src/lib/finance/*.ts` (all finance modules)
- `src/lib/dashboard-cache.ts`
- `src/lib/dashboard-ux.ts`
- `src/lib/currency.ts`
- `tests/transaction-crud-actions.test.ts`
- `tests/dashboard*.test.ts` (if exists)

## Setup

```bash
# Create worktree
.\scripts\create-worktree.ps1 tech-debt/finance-cache
cd ../balance-beacon-tech-debt-finance-cache
npm install

# Verify isolation
git status
```

## Your Tasks

Reference: `TECHNICAL_DEBT.md` for full context.

### Task 1: Dashboard Cache Stores Large JSON (MEDIUM)

**File:** `src/lib/dashboard-cache.ts:88-92`

**Problem:** Cache stores JSON without size validation. Large dashboard data could cause DB bloat or OOM.

**Current code:**
```typescript
const dataJson = JSON.stringify(data)
await prisma.dashboardCache.upsert({
  // ... stores dataJson without size check
})
```

**Fix:** Add size validation before storing:
```typescript
const dataJson = JSON.stringify(data)
const MAX_CACHE_SIZE = 512 * 1024 // 512KB

if (dataJson.length > MAX_CACHE_SIZE) {
  // Log warning and skip caching, return computed data directly
  console.warn(`Dashboard cache payload too large: ${dataJson.length} bytes`)
  return data
}

await prisma.dashboardCache.upsert({
  // ...
})
```

**Acceptance criteria:**
- [ ] Size check before cache storage
- [ ] Graceful handling when too large (skip cache, return data)
- [ ] Logging for monitoring
- [ ] Add test for oversized payload handling

### Task 2: Missing Pagination on Shared Expenses (MEDIUM)

**File:** `src/lib/finance/expense-sharing.ts`

**Problem:** `getSharedExpenses()` and `getExpensesSharedWithMe()` fetch ALL records without pagination.

**Current code:**
```typescript
export async function getSharedExpenses(userId: string) {
  const sharedExpenses = await prisma.sharedExpense.findMany({
    where: { ownerId: userId },
    include: { /* nested includes */ },
    orderBy: { createdAt: 'desc' },
    // NO take/skip/cursor
  })
}
```

**Fix:** Add cursor-based pagination:
```typescript
export async function getSharedExpenses(
  userId: string,
  options?: { cursor?: string; limit?: number }
) {
  const limit = options?.limit ?? 50

  const sharedExpenses = await prisma.sharedExpense.findMany({
    where: { ownerId: userId },
    include: { /* ... */ },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch one extra to check if more exist
    ...(options?.cursor && {
      cursor: { id: options.cursor },
      skip: 1, // Skip the cursor itself
    }),
  })

  const hasMore = sharedExpenses.length > limit
  const items = hasMore ? sharedExpenses.slice(0, limit) : sharedExpenses

  return {
    items: items.map(/* ... */),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  }
}
```

**Apply same pattern to:**
- `getSharedExpenses()`
- `getExpensesSharedWithMe()`

**Acceptance criteria:**
- [ ] Both functions support pagination
- [ ] Default limit of 50 records
- [ ] Cursor-based pagination for efficient loading
- [ ] Backward compatible (no params = first page)
- [ ] Update callers if needed

### Task 3: FX Rates Use Today's Date (MEDIUM)

**File:** `src/lib/finance/dashboard.ts:154-156`

**Problem:** Historical transactions are converted using today's exchange rates, not rates from the transaction date.

**Current code:**
```typescript
// Uses today's rates for all conversions
const rateCache = await batchLoadExchangeRates()
```

**Context:** `src/lib/currency.ts` already supports date parameter:
```typescript
export async function getExchangeRate(from: Currency, to: Currency, date?: Date)
```

**Fix:** Load rates per-month for historical accuracy:
```typescript
// Group transactions by month
const transactionsByMonth = groupBy(transactions, t => t.month.toISOString())

// Load rates for each month
const monthRates = await Promise.all(
  Object.keys(transactionsByMonth).map(async monthKey => {
    const date = new Date(monthKey)
    return {
      monthKey,
      rates: await loadExchangeRatesForDate(date)
    }
  })
)
```

**Note:** This is a performance/accuracy tradeoff. Consider:
1. Full historical accuracy (query rates per month)
2. Monthly batching (one rate per month, reused for all transactions in that month)
3. Keep current behavior with documentation (acceptable for most users)

**Acceptance criteria:**
- [ ] Implement chosen approach
- [ ] Document tradeoff decision in code comment
- [ ] Add test for historical rate loading
- [ ] No performance regression (batch where possible)

### Task 4: Semantic Duplication: Filter Functions (LOW)

**File:** `src/lib/dashboard-ux.ts:9-85`

**Problem:** Five similar filter functions with repeated predicate logic.

**Current pattern:**
```typescript
export function filterBudgets(budgets, filter) {
  return budgets.filter(b =>
    (!filter.category || b.category === filter.category) &&
    (!filter.status || b.status === filter.status)
  )
}
export function filterTransactions(transactions, filter) {
  return transactions.filter(t =>
    (!filter.category || t.category === filter.category) &&
    (!filter.type || t.type === filter.type)
  )
}
// ... 3 more similar functions
```

**Fix:** Create generic predicate filter:
```typescript
type FilterConfig<T, F> = {
  [K in keyof F]?: (item: T, value: NonNullable<F[K]>) => boolean
}

function createFilter<T, F>(config: FilterConfig<T, F>) {
  return (items: T[], filter: Partial<F>): T[] => {
    return items.filter(item =>
      Object.entries(filter).every(([key, value]) => {
        if (value === undefined || value === null) return true
        const predicate = config[key as keyof F]
        return predicate ? predicate(item, value) : true
      })
    )
  }
}

// Usage
export const filterBudgets = createFilter<Budget, BudgetFilter>({
  category: (b, cat) => b.category === cat,
  status: (b, status) => b.status === status,
})
```

**Acceptance criteria:**
- [ ] Generic filter utility created
- [ ] All 5 filter functions refactored
- [ ] Type safety maintained
- [ ] All existing tests pass

### Task 5: Flaky Date-Dependent Tests (MEDIUM)

**File:** `tests/transaction-crud-actions.test.ts:136`

**Problem:** Tests use `new Date()` and hardcoded dates without mocking, causing flakiness around month boundaries.

**Current code:**
```typescript
// Line 1007 - uses current date
const result = await createTransactionAction({
  date: new Date(),  // Flaky!
  // ...
})

// Line 414 - hardcoded date
const result = await createTransactionAction({
  date: new Date('2024-03-15'),  // May fail in different timezone
  // ...
})
```

**Fix:** Use `vi.setSystemTime()` for consistent dates:
```typescript
import { vi, beforeEach, afterEach } from 'vitest'

describe('transaction actions', () => {
  beforeEach(() => {
    // Set fixed date for all tests
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should create transaction with current date', async () => {
    const result = await createTransactionAction({
      date: new Date(), // Now deterministic: 2024-06-15
      // ...
    })
    expect(result.data.month).toBe('2024-06-01T00:00:00.000Z')
  })
})
```

**Acceptance criteria:**
- [ ] All date-dependent tests use `vi.setSystemTime()`
- [ ] No `new Date()` without time mocking in tests
- [ ] Tests pass regardless of when they run
- [ ] Document pattern for future tests

### Task 6: Null Field Handling Not Asserted (LOW)

**File:** `tests/transaction-crud-actions.test.ts:206-243`

**Problem:** Tests check success but don't verify null field handling with proper assertions.

**Current code:**
```typescript
it('should accept null description', async () => {
  const result = await createTransactionAction({
    description: null,
    // ...
  })
  expect('success' in result && result.success).toBe(true)
})
```

**Better assertion:**
```typescript
it('should accept null description', async () => {
  const result = await createTransactionAction({
    description: null,
    // ...
  })
  expect(result).toEqual(expect.objectContaining({
    success: true,
    data: expect.objectContaining({
      description: null,  // Explicitly verify null is preserved
    })
  }))
})
```

**Acceptance criteria:**
- [ ] Null field tests use `expect.objectContaining()`
- [ ] Verify null values are preserved, not converted
- [ ] Apply to all nullable field tests

## Workflow Protocol

### 1. Before Starting
```bash
git checkout main && git pull
git checkout tech-debt/finance-cache
git rebase main
```

### 2. Development Loop
```bash
# Run finance-related tests
npm test -- tests/transaction --watch
npm test -- tests/dashboard --watch

npm run check-types
```

### 3. Periodic Sync (every 2-3 hours)
```bash
git fetch origin main
git rebase origin/main
npm test
```

### 4. PR Creation
Follow CLAUDE.md protocol:
1. Commit each task separately
2. Push branch
3. Create PR with `gh pr create`
4. **Wait 3+ minutes for 4 reviewer agents**
5. Address ALL reviewer comments
6. Iterate until approved

### 5. PR Template
```markdown
## Summary
- Add size validation to dashboard cache
- Implement pagination for shared expenses
- Improve historical FX rate accuracy
- Refactor filter functions to generic utility
- Fix flaky date-dependent tests
- Improve null field test assertions

## Technical Debt Reference
See TECHNICAL_DEBT.md - Finance/Cache & Test Quality Issues

## Test Plan
- [ ] Dashboard cache tests with oversized payloads
- [ ] Pagination tests for shared expenses
- [ ] Date-mocked tests pass consistently
- [ ] All existing tests pass
```

## Success Criteria

Before marking complete:
- [ ] All 6 issues resolved
- [ ] No new issues introduced
- [ ] All tests pass (`npm test`)
- [ ] Type check passes (`npm run check-types`)
- [ ] Build succeeds (`npm run build`)
- [ ] PR approved by all 4 reviewers
- [ ] Merged to main

## Notes

- Finance modules are isolated - safe to refactor
- Test flakiness fix should be done early (improves confidence in other changes)
- Pagination changes may need caller updates - check dashboard and expense-sharing pages
