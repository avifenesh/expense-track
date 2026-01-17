# Agent 2: Test Quality

## Overview

You are one of 4 parallel agents working on tech debt. Your focus is **Test Quality** - improving test coverage, fixing flaky tests, and adding missing test cases.

**Your worktree branch**: `tech-debt/agent-2-tests`
**Your scope**: All files in `tests/*` directory only

## Parallel Agent Awareness

Three other agents are working simultaneously:
- **Agent 1** (Security & DevOps): Working in `tech-debt/agent-1-security` - touches `.github/*`, security-related lib files
- **Agent 3** (Backend Architecture): Working in `tech-debt/agent-3-backend` - touches `src/lib/*`, `src/app/actions/*`, `prisma/*`
- **Agent 4** (Frontend & UX): Working in `tech-debt/agent-4-frontend` - touches `src/components/*`, `src/hooks/*`

**Collision avoidance**: You have the cleanest isolation - you only touch `tests/*` files. Other agents don't modify test files. You can safely work independently.

## Setup

```bash
# Create worktree from main
git worktree add ../expense-track-agent-2 -b tech-debt/agent-2-tests origin/main
cd ../expense-track-agent-2
npm install
```

## Rules

1. **Follow CLAUDE.md** - Read and follow all project conventions
2. **PR Review Protocol** - Every PR gets reviewed by 4 agents (Copilot, Claude, Gemini, Codex). Wait 3 minutes, address ALL comments, iterate until clean
3. **Pull main regularly** - Before starting each session and before creating PR: `git fetch origin main && git rebase origin/main`
4. **Reference main doc** - Full issue details in `TECHNICAL_DEBT.md`
5. **Write tests to find bugs** - Not just for coverage. Test real behavior and edge cases
6. **Follow existing patterns** - Look at existing tests for mock patterns and structure

---

## Session 1: Security & Authorization Tests (PR #1)

**Branch**: `tech-debt/agent-2-tests-session-1`

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| High | Missing authorization boundary tests | `tests/api/v1/transactions.test.ts` | Add cross-account access tests |
| High | Missing account switching security tests | `tests/user-isolation.test.ts` | Add updateSessionAccount attack tests |
| High | Missing CSRF validation tests in budget actions | `tests/budget-actions.test.ts` | Add invalid CSRF token test |
| High | Missing subscription state edge case tests | `tests/transaction-crud-actions.test.ts` | Add trial/expired/cancelled tests |
| Medium | Rate limit isolation not verified | `tests/api/v1/auth-login-rate-limit.test.ts:70-90` | Assert rate limit counter per email |
| Low | SQL injection test missing for user lookup | `tests/expense-sharing-actions.test.ts` | Add email injection payload test |

### Implementation Guide

1. **Authorization Boundary Tests** (`tests/api/v1/transactions.test.ts`)
   ```typescript
   describe('authorization boundaries', () => {
     it('should reject access to transactions from another user account', async () => {
       // Create transaction for user A
       // Try to access with user B's JWT
       // Expect 403 Forbidden
     })

     it('should reject modification of transactions from another user account', async () => {
       // Similar for PUT/DELETE
     })
   })
   ```

2. **Account Switching Security** (`tests/user-isolation.test.ts`)
   ```typescript
   describe('updateSessionAccount attacks', () => {
     it('should prevent switching to account owned by another user', async () => {
       // User A tries to switch to User B's account
       // Should fail with authorization error
     })

     it('should prevent session hijacking via account ID manipulation', async () => {
       // Test various attack vectors
     })
   })
   ```

3. **CSRF Validation Tests** (`tests/budget-actions.test.ts`)
   ```typescript
   it('should reject request with invalid CSRF token', async () => {
     vi.mocked(validateCsrfToken).mockResolvedValueOnce(false)
     const result = await createBudgetAction({ ...validInput, csrfToken: 'invalid' })
     expect('error' in result).toBe(true)
   })

   it('should reject request with missing CSRF token', async () => {
     // Test missing token
   })
   ```

4. **Subscription State Tests** (`tests/transaction-crud-actions.test.ts`)
   ```typescript
   describe('subscription state edge cases', () => {
     it('should allow read during trial period', async () => { ... })
     it('should block write when trial expired', async () => { ... })
     it('should block write when subscription cancelled', async () => { ... })
     it('should allow write when subscription active', async () => { ... })
   })
   ```

5. **Rate Limit Isolation** (`tests/api/v1/auth-login-rate-limit.test.ts`)
   ```typescript
   it('should track rate limit per email, not globally', async () => {
     // Hit limit for email A
     // Email B should still be allowed
   })
   ```

6. **SQL Injection Test** (`tests/expense-sharing-actions.test.ts`)
   ```typescript
   it('should safely handle SQL injection payloads in email lookup', async () => {
     const maliciousEmail = "'; DROP TABLE users; --"
     const result = await lookupUserByEmail(maliciousEmail)
     // Should not throw, should return not found or validation error
   })
   ```

### PR Checklist

- [ ] All issues from this session fixed
- [ ] Tests pass: `npm test`
- [ ] No flaky tests (run 3x to verify)
- [ ] Rebased on latest main
- [ ] PR created with clear description
- [ ] Waited 3+ minutes for reviewer comments
- [ ] Addressed ALL reviewer comments

---

## Session 2: Test Infrastructure & Edge Cases (PR #2)

**Branch**: `tech-debt/agent-2-tests-session-2`

**Prerequisite**: Session 1 PR merged to main. Pull latest main before starting.

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| Medium | Expense sharing calculations not validated | `tests/expense-sharing-actions.test.ts:113-144` | Add math verification tests |
| Medium | Budget service Decimal mock inconsistent | `tests/lib/services/budget-service.test.ts:65-71` | Unify MockDecimal implementation |
| Medium | Dashboard cache invalidation not asserted | `tests/transaction-crud-actions.test.ts:130-145` | Add invalidateDashboardCache assertions |
| Medium | Concurrent transaction modification untested | `tests/transaction-crud-actions.test.ts` | Add findUnique success + update fail test |
| Medium | API response format not validated | `tests/api/v1/transactions.test.ts:92-98` | Verify against API_CONTRACTS schema |
| Medium | Flaky date-dependent tests | `tests/transaction-crud-actions.test.ts:136` | Use vi.setSystemTime() |
| Low | Null field handling not fully asserted | `tests/transaction-crud-actions.test.ts:206-243` | Add objectContaining assertions |
| Low | Decimal precision not tested | `tests/finance.test.ts` | Add 0.1 + 0.2 precision test |

### Implementation Guide

1. **Expense Sharing Math Tests** (`tests/expense-sharing-actions.test.ts`)
   ```typescript
   describe('expense splitting calculations', () => {
     it('should split equally with correct rounding', async () => {
       // 100 / 3 = 33.33, 33.33, 33.34
     })

     it('should handle percentage splits that sum to 100%', async () => {
       // Verify percentages are applied correctly
     })

     it('should handle fixed amount splits', async () => {
       // Verify fixed amounts deducted correctly
     })
   })
   ```

2. **Unified MockDecimal** (`tests/lib/services/budget-service.test.ts`)
   ```typescript
   // Create shared mock in tests/helpers/mocks.ts
   export const createMockDecimal = (value: number) => ({
     toNumber: () => value,
     toString: () => value.toString(),
     // ... other Decimal methods
   })
   ```

3. **Cache Invalidation Assertions** (`tests/transaction-crud-actions.test.ts`)
   ```typescript
   it('should invalidate dashboard cache after create', async () => {
     await createTransactionAction(validInput)
     expect(invalidateDashboardCache).toHaveBeenCalledWith({
       monthKey: expect.any(String),
       accountId: expect.any(String)
     })
   })
   ```

4. **Concurrent Modification Test** (`tests/transaction-crud-actions.test.ts`)
   ```typescript
   it('should handle concurrent modification gracefully', async () => {
     // findUnique returns transaction
     // update fails with P2025 (record not found - deleted between find and update)
     // Should return appropriate error, not crash
   })
   ```

5. **API Contract Validation** (`tests/api/v1/transactions.test.ts`)
   ```typescript
   import { transactionResponseSchema } from '@/schemas/api-contracts'

   it('should return response matching API contract', async () => {
     const response = await GET(request)
     const data = await response.json()
     expect(() => transactionResponseSchema.parse(data)).not.toThrow()
   })
   ```

6. **Fix Flaky Date Tests** (`tests/transaction-crud-actions.test.ts`)
   ```typescript
   beforeEach(() => {
     vi.useFakeTimers()
     vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
   })

   afterEach(() => {
     vi.useRealTimers()
   })
   ```

7. **Decimal Precision Test** (`tests/finance.test.ts`)
   ```typescript
   it('should handle floating point precision correctly', () => {
     // 0.1 + 0.2 !== 0.3 in JS
     const result = addAmounts(0.1, 0.2)
     expect(result.toNumber()).toBeCloseTo(0.3, 10)
   })
   ```

### PR Checklist

- [ ] Session 1 PR merged
- [ ] Rebased on latest main
- [ ] All issues from this session fixed
- [ ] Tests pass consistently (no flaky tests)
- [ ] PR created and reviewed
- [ ] All reviewer comments addressed

---

## Files You Own (Complete Isolation)

```
tests/api/v1/transactions.test.ts
tests/api/v1/auth-login-rate-limit.test.ts
tests/user-isolation.test.ts
tests/budget-actions.test.ts
tests/transaction-crud-actions.test.ts
tests/expense-sharing-actions.test.ts
tests/lib/services/budget-service.test.ts
tests/finance.test.ts
tests/helpers/mocks.ts (new - shared test utilities)
```

## Coordination Notes

- You have the cleanest isolation - no other agent modifies test files
- Other agents may change source files you're testing - pull main between sessions to get their changes
- If source file behavior changes, update tests accordingly
- Agent 3 is refactoring `finance.ts` and `auth.ts` - your tests for these may need updates after their PR merges
