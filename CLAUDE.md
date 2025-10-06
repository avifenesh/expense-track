# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Balance Beacon is a personal finance application for managing income, spending, and shared budgets across multiple accounts (Self/Partner/Joint). Built with Next.js 13 App Router, Prisma ORM, PostgreSQL, and TypeScript.

## Architecture

### Core Data Models (Prisma)

The application revolves around seven main entities in `prisma/schema.prisma`:

- **Account** (`SELF`, `PARTNER`, `JOINT`, `OTHER`) - Represents different financial accounts with unique names and optional preferred currency
- **Category** - Income or expense groupings; can be soft-archived (`isArchived`) without losing history; supports holding categories for investments
- **Transaction** - Individual financial entries linked to account + category; includes month snapshots for aggregation, multi-currency support, and mutual expense tracking
- **Budget** - Monthly planned amounts per account-category pair (unique constraint on `accountId`, `categoryId`, `month`) with multi-currency support
- **RecurringTemplate** - Permanent transaction plans that can be applied to create actual transactions each month
- **Holding** - Investment holdings (stocks, ETFs) with quantity, average cost, and symbol tracking per account-category
- **ExchangeRate** - Cached currency exchange rates from Frankfurter API (EUR, USD, ILS)
- **StockPrice** - Cached stock prices from Alpha Vantage API with 24-hour TTL

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
│   ├── currency.ts         # Multi-currency support: exchange rates, conversion, caching
│   ├── dashboard-ux.ts     # Dashboard data aggregation and presentation logic
│   ├── finance.ts          # Financial calculations and data fetch functions
│   ├── prisma.ts           # Prisma client singleton
│   └── stock-api.ts        # Stock price fetching from Alpha Vantage with rate limiting
└── utils/
    ├── date.ts             # Date formatting and month manipulation helpers
    └── format.ts           # Number and currency formatting utilities
```

### Authentication System

- **Session-based auth** using signed cookies (`balance_session`, `balance_user`, `balance_account`)
- User credentials loaded from environment variables in `src/lib/auth.ts` (no fallbacks - will throw if missing)
- Required env vars: `AUTH_USER1_EMAIL`, `AUTH_USER1_DISPLAY_NAME`, `AUTH_USER1_PASSWORD_HASH`, `AUTH_USER1_PREFERRED_CURRENCY`, `AUTH_USER2_EMAIL`, `AUTH_USER2_DISPLAY_NAME`, `AUTH_USER2_PASSWORD_HASH`, `AUTH_USER2_PREFERRED_CURRENCY`
- All mutations in `src/app/actions.ts` validate sessions via `requireSession()` and check account access via `ensureAccountAccess()`
- Password hashing with bcryptjs; session secrets from `AUTH_SESSION_SECRET` env variable
- **Important**: Password hashes in environment variables are automatically unescaped (handles `\$` -> `$` conversion for Vercel env vars)
- To generate password hash: `node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD', 12, (err, hash) => console.log(hash));"`

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
- **Mutual expenses**: Transactions can be marked as `isMutual` to track shared expenses between partners
- **Multi-currency**: All financial entities (transactions, budgets, holdings) support `Currency` enum (USD, EUR, ILS)

### Currency Management (`src/lib/currency.ts`)

- **Exchange rates**: Fetched from Frankfurter API and cached in `ExchangeRate` table with 24-hour TTL
- **Automatic conversion**: `convertAmount()` and `getExchangeRate()` handle currency conversions using cached rates
- **Fallback strategy**: If API fails, uses most recent cached rate with a warning
- **Currency display**: Helper functions `getCurrencySymbol()` and `getCurrencyName()` for UI rendering
- **Rate refresh**: Call `refreshExchangeRates()` to update all currency pair rates

### Stock Price Management (`src/lib/stock-api.ts`)

- **Alpha Vantage integration**: Fetches real-time stock quotes with API key from `ALPHA_VANTAGE_API_KEY` env var
- **Rate limiting**:
  - In-memory tracking: max 25 calls/day (Alpha Vantage free tier limit)
  - API throttling: 12-second delay between calls (5 calls/minute max)
- **Price caching**: Stock prices cached in `StockPrice` table with configurable TTL (default 24 hours via `STOCK_PRICE_MAX_AGE_HOURS`)
- **Stale detection**: `needsRefresh()` checks if prices are older than TTL
- **Background refresh**: `maybeRefreshOnStartup()` for non-blocking price updates on serverless cold starts
- **Holdings integration**: Holdings track investment quantities and average cost per symbol

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
# Database
DATABASE_URL="postgresql://..."                    # Postgres connection string (Neon, local, etc.)

# Authentication
AUTH_SESSION_SECRET="long-random-string"           # Session signing secret (use: openssl rand -hex 32)

# User 1 credentials (required - no fallbacks)
AUTH_USER1_EMAIL="user1@example.com"
AUTH_USER1_DISPLAY_NAME="User One"
AUTH_USER1_PASSWORD_HASH="$2b$12$..."              # Generate with bcryptjs (see Authentication System)
AUTH_USER1_PREFERRED_CURRENCY="ILS"                # Default: USD (options: USD, EUR, ILS)

# User 2 credentials (required - no fallbacks)
AUTH_USER2_EMAIL="user2@example.com"
AUTH_USER2_DISPLAY_NAME="User Two"
AUTH_USER2_PASSWORD_HASH="$2b$12$..."              # Generate with bcryptjs (see Authentication System)
AUTH_USER2_PREFERRED_CURRENCY="EUR"                # Default: USD (options: USD, EUR, ILS)

# Stock price API
ALPHA_VANTAGE_API_KEY="your-api-key-here"          # Required for stock price fetching (free at alphavantage.co)
STOCK_PRICE_MAX_AGE_HOURS="24"                     # How long to cache stock prices (default: 24)

# Optional
NEXT_PUBLIC_APP_URL="http://localhost:3000"        # App base URL for absolute links
```

**Security Note**: All auth environment variables are required with no fallbacks. The application will throw an error at startup if any are missing.

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

## Deployment

### Vercel + Neon Setup

The application is configured to deploy on Vercel with Neon PostgreSQL:

1. **Vercel Configuration** (`vercel.json`):
   - Region set to `cdg1` (Paris) for optimal latency to Tel Aviv
   - Next.js framework with custom build command
   - Function timeout set to 30 seconds

2. **Required Environment Variables in Vercel**:
   - All environment variables from `.env.example` must be configured
   - Use Vercel-Neon integration for automatic `DATABASE_URL` setup (recommended)
   - Add auth environment variables manually in Vercel dashboard

3. **Database Migrations**:
   - Migrations are in `prisma/migrations/` and tracked in git
   - Production deployments use `npm run db:migrate` (runs `prisma migrate deploy`)
   - Vercel build automatically runs `prisma generate` via `npm run build`

## Common Pitfalls

- **Stale Prisma types**: Always run `npm run prisma:generate` after schema changes
- **Missing revalidation**: Server actions must call `revalidatePath()` to update UI
- **Month normalization**: Use `getMonthStart()` consistently to avoid off-by-one errors
- **Amount scaling**: Server actions use `toDecimalString()` helper to properly round currency values
- **Docker conflicts**: If `npm run db:up:local` fails, check for existing containers with `docker ps -a`
- **Missing auth env vars**: Application will fail to start if any `AUTH_USER*` variables are missing (no fallbacks by design)
- **Password hash escaping**: When deploying to Vercel, bcrypt hashes with `$` may get escaped to `\$` - the app auto-unescapes these
- **Stock API rate limits**: Alpha Vantage free tier is 25 calls/day and 5 calls/minute - exceeding these will cause errors
- **Currency conversion**: Always check if exchange rates are cached before performing conversions; API failures fall back to stale rates
- **Holdings without prices**: Holdings require stock prices to be refreshed before they can display current values
