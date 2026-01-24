# CLAUDE.md

Personal finance SaaS (in development, public launch soon). Web + mobile apps. 14-day trial, $3/month.

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

## IMPORTANT: PR Auto-Review Process

Every PR receives automatic reviews from 4 agents: **Copilot**, **Claude**, **Gemini**, and **Codex**.

**Mandatory workflow:**

1. After creating/updating a PR, wait at least **3 minutes** for the first round of reviews
2. Read **ALL** comments from all 4 reviewers
3. Address **EVERY** comment - no exceptions
4. Wait for the next review round and iterate
5. Iterate until all comments are addressed (typically 2-4 rounds)

**Rules:**

- **ALWAYS** address all comments, including "minor" or "out of scope" suggestions
- **NEVER** skip a comment unless:
  - The comment is factually wrong, OR
  - You have explicit user approval to skip it
- Treat all reviewer feedback as required changes, not suggestions
- If a comment seems incorrect, explain why in your response before dismissing

## Commands

```bash
npm run dev              # Start dev server
npm run setup:local      # First-time setup (Docker Postgres + seed)
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Apply migrations (prod)
npm test                 # Vitest unit tests
npm run test:e2e         # Playwright E2E tests (see tests/e2e/README.md)
npm run check-types      # TypeScript check
npm run build            # Build production bundle

# Mobile commands (run from mobile/ directory)
cd mobile
npm start                # Start Expo dev server
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator
npm test                 # Run mobile tests
```

## Structure

- `src/app/actions/` - Server actions by domain (transactions, budgets, recurring, holdings, categories, auth, misc)
- `src/app/api/v1/subscriptions/` - Subscription state API for mobile/web
- `src/app/api/webhooks/paddle/` - Paddle webhook endpoint for subscription events
- `src/app/api/v1/` - REST API endpoints (auth, transactions, budgets, holdings, categories, recurring)
  - See `docs/API_AUDIT.md` for mobile compatibility audit
  - See `docs/API_CONTRACTS.md` for endpoint contracts
  - See `docs/API_VERSIONING.md` for versioning strategy
- `src/components/` - React components (dashboard, forms, UI primitives)
- `src/schemas/` - Zod validation schemas
- `src/lib/finance.ts` - Financial logic, budget tracking
- `src/lib/paddle.ts` - Paddle payment provider integration utilities
- `src/lib/subscription.ts` - Subscription state management and helpers
- `src/lib/dashboard-ux.ts` - Dashboard data aggregation
- `src/lib/server-logger.ts` - Logging utility (use instead of console.\*)
- `src/utils/date.ts` - Use `getMonthStart()` for month normalization
- `prisma/schema.prisma` - Models: User, Account, Category, Transaction, Budget, RecurringTemplate, Holding
- `tests/` - Vitest unit tests
- `tests/e2e/` - Playwright E2E tests (see `tests/e2e/README.md`)
- `mobile/` - React Native mobile app (Expo)
  - See `mobile/README.md` for setup instructions

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
- `docs/XSS_DEFENSE.md` - Full documentation

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
cd ../balance-beacon-<branch-name>
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
cd ../balance-beacon
git checkout main && git pull
git worktree remove ../balance-beacon-<name>
git fetch --prune
```

### Direct Work on Main

Only for small fixes, typos, docs, or emergency hotfixes. Everything else goes through worktree workflow.

## Testing

Write tests to find bugs, not just pass coverage. Verify real behavior and edge cases, not just happy paths.

**Test suites:**
- `tests/` - Unit tests (Vitest) for actions, schemas, lib functions
- `tests/e2e/` - End-to-end tests (Playwright) for web UI flows
- `tests/security/` - XSS attack payload tests

See `tests/e2e/README.md` for E2E test documentation.

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
