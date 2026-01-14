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

## Legacy 2-User Architecture

**Important Context**: This codebase was originally built for exactly 2 users (two partners). Some code reflects this:

- **Hardcoded auth**: `AUTH_USER1_*` and `AUTH_USER2_*` env vars in `src/lib/auth.ts`
- **Account assumptions**: Code may assume specific account names or structures
- **No userId isolation**: Database queries don't filter by user (multi-tenant transformation in progress)

**Before testing/fixing**: Understand that some patterns need refactoring for multi-user SaaS (Sprint 2+). When writing tests for Sprint 1, you may need to adapt or fix code to be testable.

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

## Security

- **CSRF Protection**: All mutating server actions require CSRF tokens validated via `requireCsrfToken()`. Double-submit cookie pattern with HMAC-SHA256 signing.
- **Security Headers**: Middleware sets CSP, X-Frame-Options, HSTS, and other security headers on all responses.
- **XSS Protection**: Multiple defense layers including React JSX automatic escaping, nonce-based CSP, input validation, and URL parameter sanitization. See `docs/SECURITY.md` for details.

### Security Testing

**XSS Audit**: Comprehensive test suite at `tests/security/` with 70+ attack payloads

```bash
npm test -- tests/security/xss.test.ts  # Run XSS tests (17 tests)
```

**Coverage**: All user input surfaces tested against XSS attacks:

- Stored XSS: Transaction descriptions, category names, budget notes, holding notes
- Reflected XSS: URL parameters (month, account, reason)
- Error messages: Validation errors across all forms
- API endpoints: Login and holdings API input validation

**Key Files**:

- `tests/security/xss-payloads.ts` - 70+ XSS attack vectors organized by type
- `tests/security/xss-helpers.ts` - Validation utilities for XSS prevention
- `tests/security/xss.test.ts` - Comprehensive XSS test suite
- `docs/SECURITY.md` - Security documentation and audit findings

## GitHub Issues Workflow

### When Asked "What's Next?"

1. Run `/next` to analyze open issues and get prioritized recommendations
2. User approves a task to work on
3. **Create worktree** for the task (see Worktree Policy)
4. **Enter plan mode** after cd to worktree
5. **Start iterative development** with review-approve workflow
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
2. **Create worktree using the script** (automatically copies .env):

   ```bash
   # Windows PowerShell
   .\scripts\create-worktree.ps1 <branch-name>

   # Linux/Mac/Git Bash
   ./scripts/create-worktree.sh <branch-name>

   # Example
   .\scripts\create-worktree.ps1 finance-tests
   ```

3. **Switch to worktree directory**:
   ```bash
   cd ../expense-track-<branch-name>
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```

### Development in Worktree

**Review-Approve-Iterate Workflow (Required for each task):**

1. **After `cd` to worktree, enter plan mode first**
   - Use plan mode to understand the codebase and design the approach
   - Read relevant files, understand patterns, design implementation
   - Get user approval on the plan before starting

2. **Implement the feature/fix**
   - Write code following the approved plan
   - Write tests for new functionality
   - Commit often with descriptive messages
   - Reference issue number in commits

3. **Request code review** (after completing a logical chunk of work)
   - Use Task tool with `subagent_type: "pr-review-toolkit:code-reviewer"`
   - Provide context: files changed (usually git diff output)
   - Agent reviews for:
     - Adherence to project guidelines (CLAUDE.md)
     - Code quality and best practices
     - Potential bugs or issues
     - Style violations

4. **Fix based on review feedback**
   - Address all review comments
   - Commit fixes with clear messages
   - Return to step 3 if significant changes made

5. **Iterate until clean review**
   - Continue review → fix → review cycle
   - Goal: Zero blocking issues from code-reviewer

6. **Request approval** (when review is clean)
   - Use Task tool with `subagent_type: "general-purpose"`
   - Provide detailed prompt:
     - Original task requirements (from GitHub issue)
     - List of what was implemented
     - Summary of all changes made
     - Test results and coverage
     - Ask agent to verify:
       - All acceptance criteria met
       - Tests passing
       - No missing pieces from requirements
       - Ready for PR
   - Agent responds with APPROVED or BLOCKED + reasons

7. **Handle approval result**
   - **If APPROVED**: Continue to PR creation (step 8)
   - **If BLOCKED**: Go back to step 2, complete missing pieces, then repeat steps 3-6

8. **Create PR and merge** (after approval)
   - Push changes: `git push -u origin <branch>`
   - Create PR: `gh pr create`
   - Merge: `gh pr merge --squash --delete-branch`

**Example workflow:**

```bash
# After getting task from /next
cd ../expense-track-auth-tests

# Enter plan mode, explore codebase, design solution
# Get user approval

# Implement
# ... write code and tests ...
git commit -m "test: add auth-server.ts coverage"

# Request review
# Task tool: subagent_type="pr-review-toolkit:code-reviewer"
# Provide: git diff output
# Review identifies: missing edge case tests

# Fix and commit
# ... add edge case tests ...
git commit -m "test: add edge case coverage for token expiry"

# Request review again
# Task tool: subagent_type="pr-review-toolkit:code-reviewer"
# Review: clean, no issues

# Request approval
# Task tool: subagent_type="general-purpose"
# Prompt: "Verify task completion for issue #X: [requirements].
#         Implemented: [changes]. Tests: [results].
#         Check all acceptance criteria met."
# Response: BLOCKED - acceptance criteria requires 90% coverage, only at 85%

# Fix and commit
# ... add more tests ...
git commit -m "test: increase coverage to 95%"

# Request review
# Review: clean

# Request approval
# Response: APPROVED - all criteria met, ready for PR

# Create PR
git push -u origin auth-tests
gh pr create --title "test: achieve 90%+ coverage on auth-server.ts"
gh pr merge --squash --delete-branch
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
