# Agent 4: Services, Validation & Database

**Branch name:** `tech-debt/services-db`
**Priority:** MEDIUM-LOW
**Estimated issues:** 7

## Parallel Work Awareness

You are one of 4 agents working simultaneously on technical debt. Other agents are working on:

| Agent | Branch | Area | Files |
|-------|--------|------|-------|
| Agent 1 | `tech-debt/auth-layer` | Auth & session | `src/lib/api-auth.ts`, `src/lib/auth-server.ts` |
| Agent 2 | `tech-debt/api-routes` | API routes & docs | `src/app/api/v1/*`, `tests/api/*` |
| Agent 3 | `tech-debt/finance-cache` | Finance, cache, tests | `src/lib/finance/*`, `src/lib/dashboard-*.ts` |

**Your exclusive files (no collision risk):**
- `src/lib/services/*.ts` (all service files)
- `src/lib/services/errors.ts`
- `src/lib/env-schema.ts` (new file)
- `prisma/schema.prisma`
- `docs/DECIMAL_PRECISION.md` (new documentation)

## Setup

```bash
# Create worktree
.\scripts\create-worktree.ps1 tech-debt/services-db
cd ../balance-beacon-tech-debt-services-db
npm install

# Verify isolation
git status
```

## Your Tasks

Reference: `TECHNICAL_DEBT.md` for full context.

### Task 1: Inconsistent Data Validation Strategy (MEDIUM)

**Files:** `src/lib/services/*.ts`

**Problem:** Services throw generic `Error()` objects instead of using the defined `ServiceError` classes.

**Current code:**
```typescript
// src/lib/services/transaction-service.ts:129
throw new Error('Transaction request not found')
throw new Error(`Request is already ${request.status.toLowerCase()}`)
```

**Existing error classes (unused):**
```typescript
// src/lib/services/errors.ts
export class ValidationError extends ServiceError { ... }
export class NotFoundError extends ServiceError { ... }
export class AuthorizationError extends ServiceError { ... }
```

**Fix:** Replace generic errors with typed errors:
```typescript
import { NotFoundError, ValidationError } from './errors'

// Before
throw new Error('Transaction request not found')

// After
throw new NotFoundError('Transaction request not found', 'TransactionRequest')
```

**Files to update:**
- `src/lib/services/transaction-service.ts`
- `src/lib/services/budget-service.ts`
- `src/lib/services/category-service.ts`
- `src/lib/services/holding-service.ts`
- `src/lib/services/recurring-service.ts`

**Acceptance criteria:**
- [ ] All services use ServiceError subclasses
- [ ] No generic `throw new Error()` in services
- [ ] Error types match semantics (NotFound, Validation, Authorization)
- [ ] All existing tests pass

### Task 2: Inconsistent Error Handling Between Layers (MEDIUM)

**Files:** `src/lib/services/errors.ts`, service consumers

**Problem:** `serviceErrorToActionResult()` converter exists but isn't used. Actions handle Prisma errors but not service errors uniformly.

**Current code in actions:**
```typescript
// Actions catch Prisma errors specifically
catch (error) {
  return handlePrismaError(error, { ... })
}
```

**Fix:** Create unified error handling:
```typescript
// src/lib/services/errors.ts - enhance existing converter
export function handleServiceError(error: unknown, context: ErrorContext): ActionResult {
  if (error instanceof ServiceError) {
    return serviceErrorToActionResult(error)
  }
  if (isPrismaError(error)) {
    return handlePrismaError(error, context)
  }
  // Unknown error
  return { success: false, error: { general: [context.fallbackMessage] } }
}
```

**Then update action pattern:**
```typescript
try {
  const result = await transactionService.create(data)
  return { success: true, data: result }
} catch (error) {
  return handleServiceError(error, {
    action: 'createTransaction',
    fallbackMessage: 'Unable to create transaction',
  })
}
```

**Acceptance criteria:**
- [ ] Unified error handler for services and Prisma
- [ ] Actions use consistent error handling pattern
- [ ] Error messages preserved through layers
- [ ] All existing tests pass

### Task 3: Missing Centralized Env Validation (MEDIUM)

**Files:** New `src/lib/env-schema.ts`

**Problem:** Each module validates its own env vars independently.

**Current pattern (scattered):**
```typescript
// src/lib/jwt.ts:16-25
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}

// src/lib/csrf.ts:8-14
if (!process.env.AUTH_SESSION_SECRET) {
  throw new Error('AUTH_SESSION_SECRET environment variable is required')
}
```

**Fix:** Create centralized env schema:
```typescript
// src/lib/env-schema.ts
import { z } from 'zod'

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  AUTH_SESSION_SECRET: z.string().min(32),

  // Optional with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Paddle (optional in dev)
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let validatedEnv: Env | null = null

export function getEnv(): Env {
  if (!validatedEnv) {
    const result = envSchema.safeParse(process.env)
    if (!result.success) {
      console.error('Environment validation failed:')
      console.error(result.error.flatten().fieldErrors)
      throw new Error('Invalid environment configuration')
    }
    validatedEnv = result.data
  }
  return validatedEnv
}

// Typed accessors
export const env = {
  get databaseUrl() { return getEnv().DATABASE_URL },
  get jwtSecret() { return getEnv().JWT_SECRET },
  get isProduction() { return getEnv().NODE_ENV === 'production' },
  // ...
}
```

**Then update modules:**
```typescript
// src/lib/jwt.ts
import { env } from './env-schema'

const secret = env.jwtSecret // Type-safe, validated
```

**Acceptance criteria:**
- [ ] Central env-schema.ts with Zod validation
- [ ] All env vars documented in schema
- [ ] Modules import from env-schema
- [ ] Clear error messages on missing vars
- [ ] Tests use test env values

### Task 4: RefreshToken Index Could Be Composite (LOW)

**File:** `prisma/schema.prisma:308-310`

**Problem:** RefreshToken has three separate indexes but queries often filter by both `expiresAt` and `userId`.

**Current indexes:**
```prisma
model RefreshToken {
  // ...
  @@index([userId])
  @@index([jti])
  @@index([expiresAt])
}
```

**Fix:** Add composite index for cleanup queries:
```prisma
model RefreshToken {
  // ...
  @@index([userId])
  @@index([jti])
  @@index([expiresAt])
  @@index([expiresAt, userId])  // For expired token cleanup
}
```

**After schema change:**
```bash
npm run db:push
npm run prisma:generate
```

**Acceptance criteria:**
- [ ] Composite index added
- [ ] Migration applies cleanly
- [ ] No breaking changes

### Task 5: SharedExpense Index Ordering (LOW)

**File:** `prisma/schema.prisma:246-247`

**Problem:** SharedExpense has separate indexes but queries filter by `ownerId` AND sort by `createdAt`.

**Current indexes:**
```prisma
model SharedExpense {
  // ...
  @@index([ownerId])
  @@index([createdAt])
}
```

**Fix:** Add composite index:
```prisma
model SharedExpense {
  // ...
  @@index([ownerId])
  @@index([createdAt])
  @@index([ownerId, createdAt])  // For owner's expenses sorted by date
}
```

**Acceptance criteria:**
- [ ] Composite index added
- [ ] Migration applies cleanly

### Task 6: Decimal Precision Inconsistency (LOW)

**Files:** Multiple, primarily documentation

**Problem:** Different decimal precisions used without documentation:
- `Holding.quantity`: `Decimal(18, 6)` - 6 decimal places
- `Holding.averageCost`: `Decimal(12, 2)` - 2 decimal places
- `Transaction.amount`: `Decimal(12, 2)` - 2 decimal places
- `Budget.planned`: `Decimal(12, 2)` - 2 decimal places

**Fix:** Document the design decision:
```typescript
// Add to prisma/schema.prisma as comment
// DECIMAL PRECISION STANDARDS:
// - Monetary amounts (Transaction.amount, Budget.planned): Decimal(12, 2)
//   12 digits total, 2 decimal places. Supports up to 9,999,999,999.99
// - Asset quantities (Holding.quantity): Decimal(18, 6)
//   18 digits total, 6 decimal places. For fractional shares/crypto
// - Asset prices (Holding.averageCost): Decimal(12, 2)
//   Standard monetary precision for cost basis
```

**Alternatively:** Create `docs/DECIMAL_PRECISION.md` with full documentation.

**Acceptance criteria:**
- [ ] Precision choices documented
- [ ] Schema comments added
- [ ] No actual precision changes (avoid data migration)

### Task 7: No Audit Trail for Deletions (LOW)

**File:** `prisma/schema.prisma`

**Problem:** Transaction and Budget use hard delete. No audit trail for deletions.

**Current behavior:**
```prisma
model Transaction {
  // No soft delete fields
  // onDelete: Cascade removes permanently
}
```

**Fix options:**

**Option A: Soft delete (recommended for audit):**
```prisma
model Transaction {
  // ... existing fields
  deletedAt DateTime?

  @@index([deletedAt])  // For filtering active records
}
```

Then update all queries:
```typescript
// Before
prisma.transaction.findMany({ where: { accountId } })

// After
prisma.transaction.findMany({ where: { accountId, deletedAt: null } })
```

**Option B: Audit log table:**
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  tableName String
  recordId  String
  action    String   // CREATE, UPDATE, DELETE
  oldData   Json?
  newData   Json?
  userId    String
  createdAt DateTime @default(now())

  @@index([tableName, recordId])
  @@index([userId])
}
```

**Note:** This is a larger change. Consider:
1. Just adding `deletedAt` field now (schema only)
2. Full soft delete implementation in separate PR
3. Document decision and defer

**Acceptance criteria:**
- [ ] Decision documented
- [ ] If implementing: schema updated, queries updated, tests updated
- [ ] If deferring: create follow-up issue

## Workflow Protocol

### 1. Before Starting
```bash
git checkout main && git pull
git checkout tech-debt/services-db
git rebase main
```

### 2. Development Loop
```bash
# After schema changes
npm run db:push
npm run prisma:generate

# Run tests
npm test

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
2. **Schema changes in dedicated commit**
3. Push branch
4. Create PR with `gh pr create`
5. **Wait 3+ minutes for 4 reviewer agents**
6. Address ALL reviewer comments
7. Iterate until approved

### 5. PR Template
```markdown
## Summary
- Standardize service layer error handling with ServiceError classes
- Create centralized env validation schema
- Add composite database indexes for performance
- Document decimal precision standards
- [Soft delete: implemented/deferred]

## Technical Debt Reference
See TECHNICAL_DEBT.md - Services, Architecture & Database Issues

## Database Changes
- Added composite index on RefreshToken(expiresAt, userId)
- Added composite index on SharedExpense(ownerId, createdAt)
- [Soft delete fields if applicable]

## Test Plan
- [ ] Service error tests updated
- [ ] Env validation tests added
- [ ] Schema migration applies cleanly
- [ ] All existing tests pass
```

## Success Criteria

Before marking complete:
- [ ] All 7 issues resolved (or documented deferral)
- [ ] No new issues introduced
- [ ] All tests pass (`npm test`)
- [ ] Type check passes (`npm run check-types`)
- [ ] Build succeeds (`npm run build`)
- [ ] Schema changes apply cleanly
- [ ] PR approved by all 4 reviewers
- [ ] Merged to main

## Notes

- Schema changes require `npm run db:push` locally
- Test database may need reset after schema changes
- Soft delete is optional - document decision if deferring
- Env schema should be imported early in app startup
- Consider backward compatibility for env changes
