# Agent 1: Security & DevOps

## Overview

You are one of 4 parallel agents working on tech debt. Your focus is **Security and DevOps** issues.

**Your worktree branch**: `tech-debt/agent-1-security`
**Your scope**: Security vulnerabilities, CI/CD, secrets management, rate limiting, webhooks

## Parallel Agent Awareness

Three other agents are working simultaneously:
- **Agent 2** (Test Quality): Working in `tech-debt/agent-2-tests` - touches `tests/*` only
- **Agent 3** (Backend Architecture): Working in `tech-debt/agent-3-backend` - touches `src/lib/*`, `src/app/actions/*`, `prisma/*`, `src/schemas/*`
- **Agent 4** (Frontend & UX): Working in `tech-debt/agent-4-frontend` - touches `src/components/*`, `src/hooks/*`

**Collision avoidance**: Your files don't overlap with other agents. If you need to modify a file outside your scope, coordinate by checking if another agent's PR is pending for that file.

## Setup

```bash
# Create worktree from main
git worktree add ../expense-track-agent-1 -b tech-debt/agent-1-security origin/main
cd ../expense-track-agent-1
npm install
```

## Rules

1. **Follow CLAUDE.md** - Read and follow all project conventions
2. **PR Review Protocol** - Every PR gets reviewed by 4 agents (Copilot, Claude, Gemini, Codex). Wait 3 minutes, address ALL comments, iterate until clean
3. **Pull main regularly** - Before starting each session and before creating PR: `git fetch origin main && git rebase origin/main`
4. **Reference main doc** - Full issue details in `TECHNICAL_DEBT.md`
5. **Commit often** - Checkpoint after each fix
6. **Tests required** - Add/update tests for all changes

---

## Session 1: Critical & High Priority Security (PR #1)

**Branch**: `tech-debt/agent-1-security-session-1`

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| Critical | Hard-coded CI database credentials | `.github/workflows/ci.yml:39-41` | Use GitHub Secrets |
| High | In-memory rate limiting resets on cold start | `src/lib/rate-limit.ts` | Document limitation, consider Redis |
| High | Missing secrets rotation documentation | N/A | Create `docs/SECRET_ROTATION.md` |
| Medium | PostgreSQL SSL not enforced | `.env.example` | Require sslmode=require in production |
| Medium | Migration shadow DB conflict | `.github/workflows/ci.yml:62-66` | Create unique shadow DB per run |
| Medium | Sentry config not validated at build | `next.config.js` | Throw if SENTRY_ENABLED but creds missing |

### Implementation Guide

1. **CI Database Credentials** (Critical)
   - Move `DATABASE_URL`, `DIRECT_URL` from hardcoded values to GitHub Secrets
   - Update CI workflow to use `${{ secrets.CI_DATABASE_URL }}`
   - Document required secrets in README or CI docs

2. **Rate Limiting Documentation**
   - Add JSDoc comments explaining cold start limitation
   - Create `docs/RATE_LIMITING.md` explaining current in-memory approach
   - Note: Redis implementation is out of scope (large effort)

3. **Secrets Rotation Documentation**
   - Create `docs/SECRET_ROTATION.md` with rotation procedures for:
     - JWT_SECRET
     - DATABASE_URL credentials
     - PADDLE_* keys
     - SMTP credentials

4. **PostgreSQL SSL**
   - Update `.env.example` with `?sslmode=require` in DATABASE_URL
   - Add comment about production SSL requirement

5. **Shadow DB Conflict**
   - Generate unique shadow DB name per CI run using `${{ github.run_id }}`
   - Clean up shadow DB after migration step

6. **Sentry Validation**
   - Add build-time check in `next.config.js`
   - Throw error if `SENTRY_ENABLED=true` but `SENTRY_DSN` is missing

### PR Checklist

- [ ] All issues from this session fixed
- [ ] Tests pass: `npm test`
- [ ] Type check passes: `npm run check-types`
- [ ] Lint passes: `npm run lint`
- [ ] Rebased on latest main
- [ ] PR created with clear description
- [ ] Waited 3+ minutes for reviewer comments
- [ ] Addressed ALL reviewer comments
- [ ] Iterated until all comments resolved

---

## Session 2: Medium & Low Priority Security (PR #2)

**Branch**: `tech-debt/agent-1-security-session-2`

**Prerequisite**: Session 1 PR merged to main. Pull latest main before starting.

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| Medium | No cron rate limiting | `src/app/api/cron/subscriptions/route.ts` | Add rate limit by secret/IP |
| Medium | Paddle webhook replay attack possible | `src/app/api/webhooks/paddle/route.ts` | Add event_id deduplication |
| Medium | Password reset tokens not cleaned up | `src/app/actions/auth.ts:143-201` | Add scheduled cleanup job |
| Low | Display name regex allows "- - -" | `src/app/api/v1/auth/register/route.ts:23` | Require alphanumeric at start/end |
| Low | Test secrets committed in workflow | `.github/workflows/ci.yml:85-94` | Move to GitHub Secrets |

### Implementation Guide

1. **Cron Rate Limiting**
   - Add IP-based or secret-based rate limiting to cron endpoint
   - Limit to 1 request per minute per IP
   - Log rate limit violations

2. **Webhook Replay Protection**
   - Store processed `event_id` in database or cache
   - Check for duplicate before processing
   - Consider TTL for stored event IDs (24 hours)

3. **Password Reset Token Cleanup**
   - Add cron job or scheduled task to delete expired tokens
   - Tokens older than 24 hours should be removed
   - Can be added to existing cron endpoint or new one

4. **Display Name Regex**
   - Update regex to require alphanumeric character at start and end
   - Pattern: `/^[a-zA-Z0-9][a-zA-Z0-9 _-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/`

5. **Test Secrets in Workflow**
   - Move any hardcoded test credentials to GitHub Secrets
   - Use `${{ secrets.TEST_* }}` variables

### PR Checklist

- [ ] Session 1 PR merged
- [ ] Rebased on latest main (includes Session 1)
- [ ] All issues from this session fixed
- [ ] Tests pass
- [ ] Type check passes
- [ ] PR created and reviewed
- [ ] All reviewer comments addressed

---

## Files You Own (No Collision Risk)

```
.github/workflows/ci.yml
.github/workflows/njsscan.yml
.env.example
next.config.js
src/lib/rate-limit.ts
src/app/api/cron/subscriptions/route.ts
src/app/api/webhooks/paddle/route.ts
src/app/api/v1/auth/register/route.ts (display name only)
docs/SECRET_ROTATION.md (new)
docs/RATE_LIMITING.md (new)
```

## Coordination Notes

- If you need to touch `src/app/actions/auth.ts`, coordinate with Agent 3 who owns architecture changes to that file
- Agent 3 may also touch API routes for pattern consistency - your security fixes take priority, they handle patterns
- Pull main between sessions to get other agents' merged changes
