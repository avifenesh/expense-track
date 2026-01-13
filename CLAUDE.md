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

1. Run `/next` to analyze open issues and get prioritized recommendations
2. User approves a task to work on
3. **Create worktree** for the task (see Worktree Policy)
4. **Enter plan mode** after cd to worktree
5. **Start Ralph Loop** with appropriate max-iterations
6. Reference the issue number in commits: `fix: implement X (closes #N)`

### During Development

- **Start work**: Comment on the issue with your approach
- **Progress updates**: Update issue with checkboxes as you complete subtasks
- **New tasks discovered**: Create new issues with `gh issue create`

### Completing Tasks

1. Ensure all acceptance criteria are met
2. Run tests: `npm test`
3. Commit with issue reference: `git commit -m "feat: ... (closes #N)"`
4. Push and verify CI passes
5. Open PR and merge (see Worktree Policy)
6. The issue auto-closes when merged to main

## Worktree Policy

Use git worktrees for feature development to keep main branch clean and enable parallel work.

### Creating a Worktree

1. **Comment on the issue** with your approach before starting
2. **Create worktree** from main branch:
   ```bash
   git worktree add -b feature/<name> ../expense-track-<name>
   ```
3. **Switch to worktree directory**:
   ```bash
   cd ../expense-track-<name>
   ```

### Development in Worktree

**Ralph Loop Workflow (Required for each task):**

1. **After `cd` to worktree, enter plan mode first**
   - Use plan mode to understand the codebase and design the approach
   - Read relevant files, understand patterns, design implementation
   - Get user approval on the plan before starting

2. **Start Ralph Loop after plan approval**

   ```bash
   /ralph-loop --max-iterations <N> --completion-promise "<PROMISE>"
   ```

   - Set `max-iterations` higher than expected (e.g., if task needs ~5 iterations, set 8-10)
   - Define clear completion promise (e.g., "FEATURE COMPLETE", "TESTS PASSING", "REFACTOR DONE")

3. **During Ralph Loop execution**
   - Commit often with descriptive messages
   - Reference issue number in commits
   - Run tests before pushing: `npm test`
   - Push regularly to create/update PR
   - Output `<promise>COMPLETION PROMISE</promise>` when done

**Example workflow:**

```bash
# After getting task from /next
cd ../expense-track-holdings-refresh

# Enter plan mode, explore codebase, design solution
# Get user approval

# Start Ralph Loop
/ralph-loop --max-iterations 10 --completion-promise "HOLDINGS REFRESH COMPLETE"

# Ralph Loop iterates until:
# - Feature implemented with tests
# - All tests passing
# - Changes committed
# - Outputs: <promise>HOLDINGS REFRESH COMPLETE</promise>
```

### Opening a PR

```bash
gh pr create --title "feat: implement X" --body "Closes #N"
```

### Merging to Main

1. Address any PR review comments
2. Ensure all tests pass
3. Merge PR with squash:
   ```bash
   gh pr merge <PR_NUMBER> --squash --delete-branch
   ```

### Cleanup After Merge

```bash
# Return to main directory
cd ../expense-track

# Update main
git checkout main
git pull

# Remove worktree
git worktree remove ../expense-track-<name>

# Prune remote tracking branches
git fetch --prune
```

### Direct Work on Main

**Only for fixes/hotfixes:**

- Small bug fixes
- Typo corrections
- Documentation updates
- Emergency hotfixes

**Everything else** should go through worktree → PR → merge workflow.

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
- DONT use `git push --no-verify` or `git commit --no-verify` - always fix the issues instead
