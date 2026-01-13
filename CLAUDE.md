# CLAUDE.md

Personal finance app for two partners. Next.js 16 App Router + Prisma + PostgreSQL + TypeScript.

## Core Principles

- **Ask first** when task, goal, or implementation is unclear
- **Verify** - never assume code is correct; validate logic and run tests
- **No stubs** - complete implementations only, no TODOs or placeholders
- **Commit often** - checkpoint after each completed task
- **Features are incomplete without tests** - no feature is done until it has test coverage
- **Target 90%+ coverage** across actions, schemas, and lib code
- **Be concise** - no filler phrases or social pleasantries, focus on what's relevant

## Commands

```bash
npm run dev              # Start dev server
npm run setup:local      # First-time setup (Docker Postgres + seed)
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Apply migrations (prod)
npm test                 # Vitest
npm run check-types      # TypeScript check
npm run build            # Build production bundle
gh issue list            # List open GitHub issues
```

## Structure

- `src/app/actions/` - Server actions by domain (transactions, budgets, recurring, holdings, categories, auth, misc)
- `src/schemas/` - Zod validation schemas
- `src/lib/finance.ts` - Financial logic, budget tracking
- `src/lib/dashboard-ux.ts` - Dashboard data aggregation
- `src/utils/date.ts` - Use `getMonthStart()` for month normalization
- `prisma/schema.prisma` - Data models: Account, Category, Transaction, Budget, RecurringTemplate, Holding
- `tests/` - Vitest test files

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

## GitHub Issues Workflow

### When Asked "What's Next?"

1. Run `gh issue list --state open` to see pending tasks
2. Pick the highest priority issue or ask user which to work on
3. Reference the issue number in commits: `fix: implement X (closes #N)`

### During Development

- **Start work**: Comment on the issue with your approach
- **Progress updates**: Update issue with checkboxes as you complete subtasks
- **New tasks discovered**: Create new issues with `gh issue create`

### Completing Tasks

1. Ensure all acceptance criteria are met
2. Run tests: `npm test`
3. Commit with issue reference: `git commit -m "feat: ... (closes #N)"`
4. Push and verify CI passes
5. The issue auto-closes when merged to main

## Testing

Write tests to find bugs, not just to pass coverage metrics. Tests should verify real behavior and edge cases, not just happy paths.

## Style

- Be concise, no filler phrases or social pleasantries
- Focus on what's relevant to the task
- Reference issue numbers in commits and PRs
- Never use `console.*` - use proper logging or remove debug statements

## DONT

- DONT CREATE AN MD FILE SUMMERIZING A TASK YOU FINISHED
- DONT commit without tests for new features
- DONT skip type checking or linting
