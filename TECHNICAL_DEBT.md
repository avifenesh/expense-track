# Technical Debt

Last updated: 2026-01-18

## Summary

**Original Issues**: 89 | Critical: 10 | High: 24 | Medium: 40 | Low: 15
**Fixed Total**: 87 issues (10 critical, 24 high, 40 medium, 13 low)
**Remaining**: 2 issues (0 high, 0 medium, 2 low) + 1 blocked

## Critical Issues (0 remaining)

All critical issues resolved.

## High Issues (0 remaining)

All high issues resolved.

## Medium Issues (0 remaining)

All medium issues resolved.

## Low Issues (2 remaining)

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| No boundary between public/private types | src/lib/finance/types.ts | Add @private JSDoc or barrel exports | small |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| No audit trail for deletions | prisma/schema.prisma | DEFERRED - Requires full soft delete impl across all queries | large |

## Blocked (not counted in remaining)

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Prisma hono dependency has JWT vulnerabilities | package-lock.json (transitive) | Wait for Prisma fix or downgrade | blocked |

**Note:** Hono 4.10.6 is dev-only through Prisma CLI. No active CVE. App uses `jsonwebtoken` directly, not Hono's JWT. Low risk but tracked for completeness.
