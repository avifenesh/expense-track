# Agent 3: Backend Architecture

## Overview

You are one of 4 parallel agents working on tech debt. Your focus is **Backend Architecture** - refactoring god objects, standardizing patterns, improving API design, and database constraints.

**Your worktree branch**: `tech-debt/agent-3-backend`
**Your scope**: `src/lib/*`, `src/app/actions/*`, `src/app/api/v1/*` (patterns only), `src/schemas/*`, `prisma/*`

## Parallel Agent Awareness

Three other agents are working simultaneously:
- **Agent 1** (Security & DevOps): Working in `tech-debt/agent-1-security` - touches `.github/*`, specific security endpoints
- **Agent 2** (Test Quality): Working in `tech-debt/agent-2-tests` - touches `tests/*` only
- **Agent 4** (Frontend & UX): Working in `tech-debt/agent-4-frontend` - touches `src/components/*`, `src/hooks/*`

**Collision avoidance**:
- Agent 1 touches specific API routes for security fixes (`cron`, `webhooks`, `register`) - you handle pattern consistency in other routes
- Agent 1 may touch `src/app/actions/auth.ts` for password reset cleanup - coordinate if both PRs pending
- Your changes to `src/lib/*` don't conflict with others

## Setup

```bash
# Create worktree from main
git worktree add ../expense-track-agent-3 -b tech-debt/agent-3-backend origin/main
cd ../expense-track-agent-3
npm install
```

## Rules

1. **Follow CLAUDE.md** - Read and follow all project conventions
2. **PR Review Protocol** - Every PR gets reviewed by 4 agents (Copilot, Claude, Gemini, Codex). Wait 3 minutes, address ALL comments, iterate until clean
3. **Pull main regularly** - Before starting each session and before creating PR: `git fetch origin main && git rebase origin/main`
4. **Reference main doc** - Full issue details in `TECHNICAL_DEBT.md`
5. **Preserve behavior** - Refactoring must not change external behavior
6. **After schema changes** - Run `npm run db:push && npm run prisma:generate`

---

## Session 1: God Objects & Core Architecture (PR #1)

**Branch**: `tech-debt/agent-3-backend-session-1`

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| High | God object: finance.ts (1032 lines) | `src/lib/finance.ts` | Split into domain modules |
| High | God object: auth.ts (994 lines) | `src/app/actions/auth.ts` | Split into auth + account actions |
| High | Inconsistent auth patterns across actions | `src/app/actions/*.ts` | Standardize on requireAuthUser() |
| Medium | Auth module handles session AND user | `src/lib/auth-server.ts` | Consider separating session vs user lookup |
| Medium | Tight coupling: cache imports finance | `src/lib/dashboard-cache.ts:4-5` | Generify cache to accept compute function |
| Medium | Inconsistent error handling between layers | Services vs Actions | Standardize error handling at service layer |

### Implementation Guide

1. **Split finance.ts** (High - Large Effort)

   Create domain-specific modules:
   ```
   src/lib/finance/
   ├── index.ts              # Re-exports for backward compatibility
   ├── transactions.ts       # Transaction calculations
   ├── budgets.ts           # Budget tracking logic
   ├── exchange-rates.ts    # Currency conversion
   ├── expense-sharing.ts   # Split calculations
   └── types.ts             # Shared types
   ```

   Steps:
   - Create new directory structure
   - Move related functions to appropriate modules
   - Update imports in existing files
   - Keep `src/lib/finance.ts` as re-export barrel for backward compatibility
   - Verify no circular dependencies

2. **Split auth.ts** (High - Medium Effort)

   ```
   src/app/actions/
   ├── auth.ts              # Login, logout, register, password reset
   └── account.ts           # Account CRUD, switching, preferences
   ```

   Steps:
   - Identify account-related vs auth-related functions
   - Move account functions to new `account.ts`
   - Update imports across codebase

3. **Standardize Auth Patterns** (High - Medium Effort)

   Ensure all actions use:
   ```typescript
   const auth = await requireAuthUser()
   if ('error' in auth) return auth
   const { authUser } = auth
   ```

   Audit all files in `src/app/actions/`:
   - transactions.ts
   - budgets.ts
   - recurring.ts
   - holdings.ts
   - categories.ts

4. **Separate Session vs User** (`src/lib/auth-server.ts`)

   Consider splitting:
   ```typescript
   // Session management
   export async function getSession() { ... }
   export async function requireSession() { ... }

   // User lookup
   export async function getUserById(id: string) { ... }
   export async function getUserByEmail(email: string) { ... }
   ```

5. **Decouple Cache from Finance** (`src/lib/dashboard-cache.ts`)

   Change from:
   ```typescript
   import { computeDashboardData } from './finance'
   ```

   To:
   ```typescript
   export async function getCachedData<T>(
     key: string,
     computeFn: () => Promise<T>
   ): Promise<T>
   ```

6. **Standardize Error Handling**

   Create service-layer error types:
   ```typescript
   // src/lib/services/errors.ts
   export class NotFoundError extends Error { ... }
   export class AuthorizationError extends Error { ... }
   export class ValidationError extends Error { ... }
   ```

### PR Checklist

- [ ] All issues from this session fixed
- [ ] Tests pass: `npm test`
- [ ] Type check passes: `npm run check-types`
- [ ] Build passes: `npm run build`
- [ ] No circular dependencies introduced
- [ ] Backward compatibility maintained (no breaking changes to exports)
- [ ] Rebased on latest main
- [ ] PR created with clear description
- [ ] Waited 3+ minutes for reviewer comments
- [ ] Addressed ALL reviewer comments

---

## Session 2: API Design & Database (PR #2)

**Branch**: `tech-debt/agent-3-backend-session-2`

**Prerequisite**: Session 1 PR merged to main. Pull latest main before starting.

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| Medium | Duplicated access control logic | `src/lib/api-auth-helpers.ts:18-88` | Create generic ensureResourceOwnership |
| Medium | Missing abstraction: repeated API auth | Multiple API routes | Extract requireApiResourceAccess middleware |
| Medium | Inconsistent data validation strategy | Services vs Actions vs API | Add validation at service layer boundary |
| Medium | Generic error messages mask real issues | `src/app/api/v1/categories/route.ts:50-51` | Distinguish error types in catch |
| Medium | Inconsistent response data format | Multiple endpoints | Return full resource on mutations |
| Medium | Inconsistent authorization patterns | Multiple API routes | Standardize on helper function |
| Medium | No database-level date validation | `prisma/schema.prisma:178-179` | Add CHECK constraint for endMonth >= startMonth |
| Medium | Category unique constraint race condition | `src/app/actions/categories.ts:36` | Use upsert with isArchived: false |
| Medium | CSRF token in all schemas | `src/schemas/index.ts` | Create separate API schemas |
| Medium | Missing GET parameter validation | `src/app/api/v1/budgets/route.ts:96-106` | Add explicit null checks |
| Medium | No error response TypeScript types | `src/lib/api-helpers.ts` | Export ApiResponse, ValidationError types |
| Low | No boundary between public/private types | `src/lib/finance.ts:14-198` | Add @private JSDoc or barrel exports |
| Low | Action CSRF patterns inconsistent | Multiple action files | Ensure all use same pipeline |

### Implementation Guide

1. **Generic Access Control** (`src/lib/api-auth-helpers.ts`)
   ```typescript
   export async function ensureResourceOwnership<T extends { userId: string }>(
     resource: T | null,
     userId: string,
     resourceType: string
   ): Promise<T | ApiError> {
     if (!resource) return notFoundError(`${resourceType} not found`)
     if (resource.userId !== userId) return forbiddenError('Access denied')
     return resource
   }
   ```

2. **API Auth Middleware** (new file: `src/lib/api-middleware.ts`)
   ```typescript
   export async function withApiAuth(
     request: NextRequest,
     handler: (user: JwtUser) => Promise<Response>
   ): Promise<Response> {
     try {
       const user = requireJwtAuth(request)
       const rateLimit = checkRateLimit(user.userId)
       if (!rateLimit.allowed) return rateLimitError(rateLimit.resetAt)
       incrementRateLimit(user.userId)
       return await handler(user)
     } catch (error) {
       return authError(error instanceof Error ? error.message : 'Unauthorized')
     }
   }
   ```

3. **Separate API Schemas** (`src/schemas/index.ts`)
   ```typescript
   // Base schema without CSRF
   export const transactionBaseSchema = z.object({ ... })

   // Server action schema with CSRF
   export const transactionSchema = transactionBaseSchema.extend({
     csrfToken: z.string()
   })

   // API schema without CSRF
   export const transactionApiSchema = transactionBaseSchema
   ```

4. **Database Date Constraint**
   ```sql
   -- In migration
   ALTER TABLE "RecurringTemplate"
   ADD CONSTRAINT "check_end_after_start"
   CHECK ("endMonth" IS NULL OR "endMonth" >= "startMonth");
   ```

5. **Category Upsert Fix** (`src/app/actions/categories.ts`)
   ```typescript
   // Instead of create, use upsert
   await prisma.category.upsert({
     where: {
       accountId_name_isArchived: {
         accountId,
         name: data.name,
         isArchived: false
       }
     },
     create: { ... },
     update: { isArchived: false, ... }
   })
   ```

6. **Error Response Types** (`src/lib/api-helpers.ts`)
   ```typescript
   export type ApiSuccessResponse<T> = { data: T }
   export type ApiErrorResponse = { error: string; details?: Record<string, string[]> }
   export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse
   ```

### PR Checklist

- [ ] Session 1 PR merged
- [ ] Rebased on latest main
- [ ] All issues from this session fixed
- [ ] Schema changes: `npm run db:push && npm run prisma:generate`
- [ ] Tests pass
- [ ] Type check passes
- [ ] PR created and reviewed
- [ ] All reviewer comments addressed

---

## Files You Own

```
src/lib/finance.ts → src/lib/finance/*
src/lib/auth-server.ts
src/lib/api-auth-helpers.ts
src/lib/api-helpers.ts
src/lib/api-middleware.ts (new)
src/lib/dashboard-cache.ts
src/lib/services/errors.ts (new)
src/app/actions/auth.ts
src/app/actions/account.ts (new)
src/app/actions/categories.ts
src/app/api/v1/*/route.ts (patterns only)
src/schemas/index.ts
prisma/schema.prisma (constraints)
```

## Coordination Notes

- Agent 1 owns security fixes in `src/app/actions/auth.ts` (password reset cleanup) - if both PRs pending, communicate
- Agent 1 owns `src/app/api/cron/*` and `src/app/api/webhooks/*` - don't modify those
- Agent 2 tests your code - they may need to update tests after your refactors
- Pull main between sessions to incorporate Agent 1's security fixes
