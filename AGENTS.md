# Repository Guidelines

Personal finance SaaS (in development, public launch soon). Web + mobile apps. 14-day trial, $5/month.

**Vision:** Individual-first expense tracking. Users manage their own finances with optional expense sharing (splitting costs with roommates, partners, friends). Clarity over complexity - understand your finances in 30 seconds.

Stack: Next.js 16 App Router + Prisma + PostgreSQL + TypeScript.

## Core Principles

- **Ask first** when task, goal, or implementation is unclear
- **Verify** - never assume code is correct; validate logic and run tests
- **No stubs** - complete implementations only, no TODOs or placeholders
- **No omissions** - never output `// ... styles remain same` or `// ... logic here`
- **Commit often** - checkpoint after each completed task
- **Features need tests** - target 90%+ coverage across actions, schemas, and lib
- **Be concise** - no filler phrases, focus on what's relevant
- **NEVER kill all node processes** - only kill specific PIDs if necessary

## Transformation Roadmap

4-sprint plan to transform from personal app to multi-tenant SaaS with mobile:

- **Sprint 1**: Production readiness - 90%+ test coverage, bug fixes, UX polish
- **Sprint 2**: Multi-tenant - user auth, data isolation, subscriptions, OAuth
- **Sprint 3**: Scale - Redis caching, monitoring, performance, security hardening
- **Sprint 4**: Mobile - React Native app (Expo), REST API, iOS/Android deployment

See `TRANSFORMATION_PLAN.md` for details. Issues tracked in GitHub Projects.

## Legacy 2-User Architecture (Being Removed)

Historical context - originally built for 2 users. Active refactoring in Sprint 2:

- **Hardcoded auth**: `AUTH_USER1_*` and `AUTH_USER2_*` env vars in `src/lib/auth.ts` → being replaced
- **Partial userId isolation**: Schema has User model, server actions being updated to enforce filtering

## Commands

```bash
npm run dev              # Start dev server
npm run setup:local      # First-time setup (Docker Postgres + seed)
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Apply migrations (prod)
npm test                 # Vitest
npm run check-types      # TypeScript check
npm run build            # Build production bundle
```

## Structure

- `src/app/actions/` - Server actions by domain (transactions, budgets, recurring, holdings, categories, auth, misc)
- `src/app/api/v1/` - REST API endpoints (auth, transactions, budgets, holdings, categories, recurring)
- `src/components/` - React components (dashboard, forms, UI primitives)
- `src/schemas/` - Zod validation schemas
- `src/lib/finance.ts` - Financial logic, budget tracking
- `src/lib/dashboard-ux.ts` - Dashboard data aggregation
- `src/lib/server-logger.ts` - Logging utility (use instead of console.\*)
- `src/utils/date.ts` - Use `getMonthStart()` for month normalization
- `prisma/schema.prisma` - Models: User, Account, Category, Transaction, Budget, RecurringTemplate, Holding
- `tests/` - Vitest test files

## Patterns

- Server actions return `{ success: true, data }` or `{ success: false, error }`
- After schema changes: `npm run db:push && npm run prisma:generate`
- Transactions store both `date` and `month` (first day of month) for aggregation
- Multi-currency: USD, EUR, ILS. Exchange rates cached in DB from Frankfurter API

## Constraints

- Budget unique per account-category-month
- Categories soft-delete via `isArchived`
- Amounts: `Decimal(12,2)` in DB
- Auth env vars required, no fallbacks

## Security

- **CSRF**: All mutating server actions require tokens via `requireCsrfToken()`. Double-submit cookie with HMAC-SHA256.
- **Headers**: Middleware sets CSP, X-Frame-Options, HSTS on all responses.
- **XSS**: React JSX escaping, nonce-based CSP, input validation, URL sanitization.

### Security Testing

XSS test suite at `tests/security/` with 70+ attack payloads:

```bash
npm test -- tests/security/xss.test.ts
```

Key files:

- `tests/security/xss-payloads.ts` - Attack vectors
- `tests/security/xss-helpers.ts` - Validation utilities
- `tests/security/xss.test.ts` - Test suite
- `docs/SECURITY.md` - Full documentation

## GitHub Issues Workflow

1. Run `gh issue list` to see open issues
2. Comment on issue with your approach before starting
3. Create worktree for the task
4. Implement with review-approve workflow
5. Reference issue in commits: `fix: implement X (closes #N)`
6. Push and create PR, merge when approved

## Worktree Policy

Use git worktrees for feature development to keep main clean.

### Creating a Worktree

```bash
# Windows PowerShell
.\scripts\create-worktree.ps1 <branch-name>

# Linux/Mac/Git Bash
./scripts/create-worktree.sh <branch-name>

# Then
cd ../expense-track-<branch-name>
npm install
```

### Development Workflow

1. **Plan first** - understand codebase, design approach, get approval
2. **Implement** - write code and tests, commit often, reference issue numbers
3. **Review** - request code review, fix feedback, iterate until clean
4. **Approval** - verify all acceptance criteria met, tests passing
5. **Ship** - push, create PR, merge when approved

### Opening a PR

```bash
gh pr create --title "feat: implement X" --body "Closes #N"
```

### Merging

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

### Cleanup

```bash
cd ../expense-track
git checkout main && git pull
git worktree remove ../expense-track-<name>
git fetch --prune
```

### Direct Work on Main

Only for small fixes, typos, docs, or emergency hotfixes. Everything else goes through worktree workflow.

## Testing

Write tests to find bugs, not just pass coverage. Verify real behavior and edge cases, not just happy paths.

## Style

- Be concise, no filler phrases
- Focus on task relevance
- Reference issue numbers in commits and PRs
- Follow CI until green, test manually after implementation
- Never use `console.*` - use proper logging or remove debug statements

## Technical Standards

**Frontend ("Looks Good")**

- Visual polish: Broken/raw UI is a bug
- Media handling: Loading states, skeletons, error fallbacks required
- Mobile-first: Primary user is mid-range Android with unstable internet

**Backend ("No Bugs")**

- Role security: Validate user roles on every request
- Data integrity: Soft delete, maintain referential integrity
- Validation: Server-side validation always; never trust client

## Definition of Done

A task is complete when:

1. Database schema supports it
2. API handles success AND error states
3. UI feedback (toasts, spinners, errors) visible to user
4. Tests cover the functionality
5. CI passes

## Don'ts

- Don't create summary MD files after tasks
- Don't commit without tests for new features
- Don't skip type checking or linting
- Don't use `--no-verify` flags - fix issues instead
