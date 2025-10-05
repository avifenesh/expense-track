# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Balance Beacon is a personal finance application for managing income, spending, and shared budgets across multiple accounts (Self/Partner/Joint). Built with Next.js 13 App Router, Prisma ORM, PostgreSQL, and TypeScript.

## Architecture

### Core Data Models (Prisma)

The application revolves around five main entities in `prisma/schema.prisma`:

- **Account** (`SELF`, `PARTNER`, `JOINT`, `OTHER`) - Represents different financial accounts with unique names
- **Category** - Income or expense groupings; can be soft-archived (`isArchived`) without losing history
- **Transaction** - Individual financial entries linked to account + category; includes month snapshots for aggregation
- **Budget** - Monthly planned amounts per account-category pair (unique constraint on `accountId`, `categoryId`, `month`)
- **RecurringTemplate** - Permanent transaction plans that can be applied to create actual transactions each month

### Application Structure

```
src/
├── app/                    # Next.js App Router pages and server actions
│   ├── actions.ts          # All server actions for mutations (transactions, budgets, templates, auth)
│   ├── layout.tsx          # Root layout with auth and global styles
│   ├── page.tsx            # Main dashboard page (protected route)
│   └── login/page.tsx      # Login page
├── components/
│   ├── auth/               # Login UI components
│   ├── dashboard/          # Dashboard page and visualization components (sparklines, stats)
│   └── ui/                 # Reusable UI primitives (button, card, input, select, textarea)
├── lib/
│   ├── auth.ts             # Auth user definitions and session cookie names
│   ├── auth-server.ts      # Server-side session management (establish/verify/clear)
│   ├── dashboard-ux.ts     # Dashboard data aggregation and presentation logic
│   ├── finance.ts          # Financial calculations and data fetch functions
│   └── prisma.ts           # Prisma client singleton
└── utils/
    └── date.ts             # Date formatting and month manipulation helpers
```

### Authentication System

- **Session-based auth** using signed cookies (`balance_session`, `balance_user`, `balance_account`)
- User definitions in `src/lib/auth.ts` with hardcoded `AUTH_USERS` (Avi and Serena)
- All mutations in `src/app/actions.ts` validate sessions via `requireSession()` and check account access via `ensureAccountAccess()`
- Password hashing with bcryptjs; session secrets from `AUTH_SESSION_SECRET` env variable

### Server Actions Pattern

All data mutations are Next.js server actions in `src/app/actions.ts`:
- Input validation with Zod schemas
- Session/account access checks via `ensureAccountAccess()`
- Returns `{ success: true, data }` or `{ success: false, error: {...} }`
- Always call `revalidatePath('/')` after mutations to refresh dashboard

### Financial Logic

Key patterns in `src/lib/finance.ts`:
- **Month snapshots**: Transactions store both exact `date` and `month` (month start) for aggregation
- **Budget tracking**: Compares planned amounts vs. actual transaction sums for each account-category-month
- **Historical trends**: Fetches last N months of income/expense/net for sparklines
- **Recurring templates**: Apply templates to create transactions for a given month using `applyRecurringTemplate()`

## Development Commands

### Essential Setup

```bash
npm run setup:local          # One-shot: installs deps, creates .env, boots Docker Postgres, syncs schema, seeds data
npm run dev                  # Start dev server (assumes DB already running)
npm run dev:local            # Boot Docker Postgres + start dev server
```

### Database Operations

```bash
npm run db:up:local          # Start Docker Postgres container
npm run db:down:local        # Stop and remove Docker Postgres container
npm run db:logs:local        # Follow database logs
npm run db:push              # Push schema to DB without migrations (dev only)
npm run db:migrate           # Apply migrations (production)
npm run db:seed              # Seed starter accounts and categories
npm run prisma:generate      # Regenerate Prisma client (auto-runs on install)
```

### Build & Test

```bash
npm run build                # Production build (includes prisma:generate)
npm run start                # Start production server (uses scripts/start.js)
npm run lint                 # Run ESLint
npm test                     # Run Vitest unit tests
npm run test:e2e             # Run Playwright e2e tests
```

## Key Development Patterns

### Adding a New Transaction Field

1. Update `prisma/schema.prisma` Transaction model
2. Run `npm run db:push` (dev) or create migration with `npx prisma migrate dev`
3. Run `npm run prisma:generate` to update TypeScript types
4. Update Zod schema in `src/app/actions.ts` (e.g., `transactionFormSchema`)
5. Update transaction creation logic in relevant server actions
6. Update UI forms in `src/components/dashboard/`

### Adding a New Server Action

1. Define Zod schema for inputs at top of `src/app/actions.ts`
2. Create `'use server'` async function
3. Validate input with `schema.safeParse()`
4. Check access with `ensureAccountAccess()` or `requireSession()`
5. Perform Prisma operations
6. Call `revalidatePath('/')` to refresh cached data
7. Return `{ success: true/false, data?, error? }`

### Working with Dates

- Always use `getMonthStart()` from `src/utils/date.ts` to normalize month values
- Transaction `month` field stores the first day of the month at midnight UTC
- Use `formatMonthLabel()` for display and `getMonthKey()` for URL/state management

### Modifying the Dashboard

Dashboard data aggregation lives in `src/lib/dashboard-ux.ts`:
- `loadDashboardData()` - Main entry point, fetches all dashboard sections
- `computeMonthlyStats()` - Top-level income/expense/net cards
- `summarizeCategoryBudgets()` - Budget progress per category
- `fetchMonthlyHistory()` - Historical trend data for sparklines

## Environment Variables

Required in `.env`:

```bash
DATABASE_URL="postgresql://..."           # Postgres connection string
AUTH_SESSION_SECRET="long-random-string"  # Session signing secret (use openssl rand -hex 32)
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Optional: app base URL
```

## Testing

- **Unit tests**: Vitest config in `vitest.config.ts`, run with `npm test`
- **E2E tests**: Playwright config in `playwright.config.ts`, run with `npm run test:e2e`
- Manual testing: Focus on budget creation, recurring template application, and transaction flows

## Important Constraints

- **Account access control**: Users can only modify accounts in their `accountNames` array (see `ensureAccountAccess()`)
- **Unique constraints**: Budget entries are unique per account-category-month; violates will fail
- **Soft deletion**: Categories use `isArchived` flag; transactions retain references to archived categories
- **Decimal precision**: Financial amounts use `Decimal(12,2)` in DB and multiply by 100 in JS before storage
- **Session expiry**: Sessions are stateless; re-login required if cookies expire

## Common Pitfalls

- **Stale Prisma types**: Always run `npm run prisma:generate` after schema changes
- **Missing revalidation**: Server actions must call `revalidatePath()` to update UI
- **Month normalization**: Use `getMonthStart()` consistently to avoid off-by-one errors
- **Amount scaling**: Server actions use `toDecimalString()` helper to properly round currency values
- **Docker conflicts**: If `npm run db:up:local` fails, check for existing containers with `docker ps -a`
