# Parallel Development Tasks - Ready to Start

**Generated**: 2026-01-13
**Status**: 3 tasks ready for parallel worktree development
**Estimated Completion**: 5 days (parallel) vs 8-12 days (sequential)

---

## Task Assignment

| Task                            | Priority | Effort            | Worktree Branch         | Agent   |
| ------------------------------- | -------- | ----------------- | ----------------------- | ------- |
| #55: Dependency vulnerabilities | P1-HIGH  | Small (1-2 days)  | `security-dependencies` | Agent 1 |
| #66: JWT authentication         | P1-HIGH  | Medium (4-5 days) | `jwt-authentication`    | Agent 2 |
| #53: Security headers & CSRF    | P1-HIGH  | Medium (3-5 days) | `security-headers-csrf` | Agent 3 |

---

## TASK 1: #55 - Scan and Fix Dependency Vulnerabilities

### GitHub Issue

https://github.com/avifenesh/expense-track/issues/55

### Objective

Audit and fix security vulnerabilities in npm dependencies. Achieve zero high/critical vulnerabilities.

### Worktree Setup

```bash
.\scripts\create-worktree.ps1 security-dependencies
cd ../expense-track-security-dependencies
npm install
```

### Files to Modify

```
package.json              # Update vulnerable dependencies
package-lock.json         # Regenerated automatically
.github/workflows/ci.yml  # (Optional) Add automated scanning
```

### Tasks

- [ ] Run `npm audit` to identify vulnerabilities
- [ ] Update vulnerable dependencies to safe versions
- [ ] Test that app still works after updates
- [ ] Run `npm test` to ensure no breaking changes
- [ ] (Optional) Add `npm audit` step to CI workflow
- [ ] (Optional) Configure Dependabot for automated updates

### Acceptance Criteria

- Zero high/critical vulnerabilities in `npm audit`
- All tests passing
- App builds successfully
- Dependencies updated in package.json

### Merge Priority

**MERGE FIRST** - Cleanest merge, no conflicts with other tasks

### Commit Message Format

```
fix: update dependencies to resolve security vulnerabilities (closes #55)

- Updated X to v1.2.3 (fixes CVE-XXXX-XXXX)
- Updated Y to v2.0.0 (fixes CVE-YYYY-YYYY)
- All tests passing after dependency updates
```

---

## TASK 2: #66 - Implement JWT Authentication for Mobile

### GitHub Issue

https://github.com/avifenesh/expense-track/issues/66

### Objective

Add JWT token-based authentication to support mobile apps. Implement token generation, refresh, and validation.

### Worktree Setup

```bash
.\scripts\create-worktree.ps1 jwt-authentication
cd ../expense-track-jwt-authentication
npm install
```

### Files to Create

```
src/lib/jwt.ts                        # JWT token generation/validation
src/app/api/v1/auth/login/route.ts    # POST /api/v1/auth/login
src/app/api/v1/auth/refresh/route.ts  # POST /api/v1/auth/refresh
src/app/api/v1/auth/logout/route.ts   # POST /api/v1/auth/logout
tests/jwt.spec.ts                     # JWT library tests
tests/api/auth.spec.ts                # API endpoint tests
```

### Files to Modify

```
src/lib/auth-server.ts  # Extend with JWT token generation
package.json            # Add jsonwebtoken dependency
```

### Tasks

- [ ] Install `jsonwebtoken` and `@types/jsonwebtoken`
- [ ] Create JWT signing/verification functions in `lib/jwt.ts`
- [ ] Implement access token (15min expiry) + refresh token (30 days)
- [ ] Create POST /api/v1/auth/login endpoint (returns JWT tokens)
- [ ] Create POST /api/v1/auth/refresh endpoint (rotates tokens)
- [ ] Create POST /api/v1/auth/logout endpoint (invalidates refresh token)
- [ ] Add JWT validation helper for API routes
- [ ] Write comprehensive tests for JWT logic
- [ ] Write API endpoint tests
- [ ] Document JWT flow in code comments

### Acceptance Criteria

- JWT tokens working (access + refresh)
- Login endpoint returns valid tokens
- Refresh endpoint rotates tokens correctly
- Token validation works in API routes
- 80%+ test coverage on new code
- Tokens stored securely (HTTP-only cookies OR response body for mobile)

### Implementation Notes

- **Do NOT modify middleware.ts** - Keep JWT validation in individual route handlers to avoid conflicts with Task 3
- Use existing `getUserByEmail` and password verification from `lib/auth-server.ts`
- JWT secret should come from `JWT_SECRET` environment variable
- Access tokens expire in 15 minutes
- Refresh tokens expire in 30 days
- Include userId and email in JWT payload

### Merge Priority

**MERGE THIRD** - Can merge after #55 and #53, or second if #53 is delayed

### Commit Message Format

```
feat: implement JWT authentication for mobile API (closes #66)

- Add JWT token generation and validation
- Implement /api/v1/auth/login endpoint
- Implement /api/v1/auth/refresh endpoint
- Add refresh token rotation for security
- Tests achieve 85% coverage on auth endpoints
```

---

## TASK 3: #53 - Implement Security Headers and CSRF Protection

### GitHub Issue

https://github.com/avifenesh/expense-track/issues/53

### Objective

Add security headers (CSP, X-Frame-Options, etc.) and CSRF token protection to all forms.

### Worktree Setup

```bash
.\scripts\create-worktree.ps1 security-headers-csrf
cd ../expense-track-security-headers-csrf
npm install
```

### Files to Create

```
src/middleware.ts           # Next.js middleware for security headers
src/lib/csrf.ts             # CSRF token generation/validation
tests/csrf.spec.ts          # CSRF library tests
tests/middleware.spec.ts    # Middleware tests
```

### Files to Modify

```
src/app/layout.tsx          # Add CSP meta tags (optional)
package.json                # Add helmet or similar (if needed)
```

### Tasks

- [ ] Create `src/middleware.ts` with security headers:
  - Content-Security-Policy (CSP)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy
- [ ] Create CSRF token generation in `lib/csrf.ts`
- [ ] Add CSRF validation for POST/PUT/DELETE requests
- [ ] Add CSRF token to forms (hidden input field)
- [ ] Test CSRF protection with invalid tokens
- [ ] Write comprehensive tests for middleware
- [ ] Write comprehensive tests for CSRF logic
- [ ] Document security headers in code comments

### Acceptance Criteria

- Security headers present on all responses
- CSRF protection working on all forms
- Invalid CSRF tokens rejected with 403
- 80%+ test coverage on security code
- Security scan tools pass (e.g., securityheaders.com)

### Implementation Notes

- **Create middleware.ts from scratch** - This file doesn't exist yet
- CSRF tokens should be stored in HTTP-only cookies
- CSRF tokens should be validated on all state-changing requests (POST/PUT/DELETE)
- Exempt `/api/v1/auth/login` from CSRF (JWT handles this)
- CSP should allow 'self' and any CDN domains you use

### Merge Priority

**MERGE SECOND** - Merge after #55 (dependencies), before #66 (JWT)

### Commit Message Format

```
feat: add security headers and CSRF protection (closes #53)

- Implement Next.js middleware with CSP and security headers
- Add CSRF token generation and validation
- Protect all forms with CSRF tokens
- Tests achieve 85% coverage on security code
```

---

## Conflict Resolution Strategy

### Potential Conflict: middleware.ts

Both Task 2 (#66) and Task 3 (#53) may want to create/modify `src/middleware.ts`.

**Resolution**:

- **Task 3 creates middleware.ts** with security headers
- **Task 2 keeps JWT validation in route handlers** (not middleware)
- If both finish simultaneously, Task 3 merges first
- Task 2 can optionally extend middleware.ts in a follow-up PR

This is a **minor conflict** and easily resolved.

---

## Merge Order Recommendation

1. **#55 (dependencies)** - Merge first, cleanest merge
2. **#53 (security headers)** - Merge second, creates middleware.ts
3. **#66 (JWT auth)** - Merge last, no conflicts

**Alternative**: If #66 finishes first, it can merge before #53 by keeping JWT validation in route handlers.

---

## Testing Requirements

Each task must:

- [ ] Run `npm test` and achieve 80%+ coverage on new code
- [ ] Run `npm run check-types` with no errors
- [ ] Run `npm run build` successfully
- [ ] Test manually in dev environment
- [ ] No console.error or console.log in production code
- [ ] Follow existing code patterns (Zod validation, ActionResult type, etc.)

---

## Ralph Loop Configuration

Each agent should:

1. **Enter plan mode FIRST** after cd to worktree
2. **Get user approval** on the implementation plan
3. **Start Ralph Loop** with:
   ```bash
   /ralph-loop --max-iterations 10 --completion-promise "<TASK> COMPLETE"
   ```

### Completion Promises

- **Task 1**: "DEPENDENCY SECURITY COMPLETE"
- **Task 2**: "JWT AUTHENTICATION COMPLETE"
- **Task 3**: "SECURITY HEADERS COMPLETE"

---

## Communication Protocol

### When Starting

Comment on your GitHub issue with your approach before creating the worktree.

### During Development

- Commit often with descriptive messages
- Reference issue number in commits: `feat: implement X (relates to #N)`
- Push regularly to create/update PR
- Update issue with progress checkboxes

### When Complete

- Run all tests and ensure they pass
- Create PR: `gh pr create --title "feat: implement X" --body "Closes #N"`
- Output completion promise: `<promise>TASK COMPLETE</promise>`
- Comment on issue with PR link

---

## Environment Variables Needed

### Task 2 (JWT) Requires

Add to `.env` file in worktree:

```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
```

### All Tasks Use

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/expense_track
AUTH_USER1_EMAIL=user1@example.com
AUTH_USER1_PASSWORD_HASH=$2a$10$...
AUTH_USER1_SECRET=secret1
AUTH_USER2_EMAIL=user2@example.com
AUTH_USER2_PASSWORD_HASH=$2a$10$...
AUTH_USER2_SECRET=secret2
```

The worktree creation script automatically copies `.env` from main directory.

---

## Questions?

If you encounter issues:

1. Check this file for guidance
2. Check CLAUDE.md for project conventions
3. Check GitHub issue for acceptance criteria
4. Ask user for clarification if blocked

---

## Success Criteria Summary

### Task 1 (#55)

✅ Zero high/critical npm vulnerabilities
✅ All tests passing after updates
✅ App builds successfully

### Task 2 (#66)

✅ JWT login/refresh/logout endpoints working
✅ Token validation functional
✅ 80%+ test coverage
✅ Mobile clients can authenticate

### Task 3 (#53)

✅ Security headers on all responses
✅ CSRF protection on all forms
✅ 80%+ test coverage
✅ Security scan passes

---

**Ready to start? Each agent should pick their task and begin with worktree setup!**
