# CLAUDE.md

Personal finance app for two partners. Next.js 16 App Router + Prisma + PostgreSQL + TypeScript.

## Commands

```bash
npm run dev              # Start dev server
npm run setup:local      # First-time setup (Docker Postgres + seed)
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Apply migrations (prod)
npm test                 # Vitest
npm run check-types      # TypeScript check
```

## Structure

- `src/app/actions.ts` - All server actions (Zod validation → `ensureAccountAccess()` → Prisma → `revalidatePath('/')`)
- `src/lib/finance.ts` - Financial logic, budget tracking
- `src/lib/dashboard-ux.ts` - Dashboard data aggregation
- `src/utils/date.ts` - Use `getMonthStart()` for month normalization
- `prisma/schema.prisma` - Data models: Account, Category, Transaction, Budget, RecurringTemplate, Holding

## Patterns

Server actions return `{ success: true, data }` or `{ success: false, error }`.

After schema changes: `npm run db:push && npm run prisma:generate`

Transactions store both `date` and `month` (first day of month) for aggregation.

Multi-currency: USD, EUR, ILS. Exchange rates cached in DB from Frankfurter API.

## Constraints

- Budget unique per account-category-month
- Categories soft-delete via `isArchived`
- Amounts: `Decimal(12,2)` in DB
- Auth env vars required, no fallbacks
