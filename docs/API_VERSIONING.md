# API Versioning Strategy

## Current Version

**v1** (current)

```
Base URL: /api/v1
```

## Versioning Approach

URL path versioning:

```
/api/v1/transactions
/api/v2/transactions  (future)
```

**Why**:
- Explicit and visible
- Easy to route at infrastructure level
- Clear version separation in codebase
- No header negotiation

**Format**: Major versions only (`v1`, `v2`, `v3`). No minor/patch versions in URL.

## Breaking vs Non-Breaking Changes

### Breaking (Require New Version)

| Change Type | Example |
|-------------|---------|
| Remove endpoint | DELETE `/api/v1/legacy/endpoint` |
| Remove required field | Remove `accountId` from request |
| Change field type | `amount: string` → `amount: number` |
| Change response structure | `{ data: T }` → `T` |
| Remove enum value | Remove `Currency.BTC` |
| Change authentication | JWT → API Key |
| Change error codes | 400 → 422 for validation |

### Non-Breaking (Same Version)

| Change Type | Example |
|-------------|---------|
| Add endpoint | New `/api/v1/reports` |
| Add optional field | New `notes?: string` field |
| Add enum value | Add `Currency.GBP` |
| Add response field | New `createdAt` in response |
| Performance improvements | Faster queries |
| Bug fixes | Fix calculation error |
| Documentation updates | Clarify behavior |

## Deprecation Policy

| Phase | Duration | Actions |
|-------|----------|---------|
| Announcement | Day 0 | Document deprecation, update docs |
| Deprecation | 6 months | Add `Deprecated` header, log usage |
| Sunset Warning | Last 30 days | Increase log severity, notify users |
| Removal | End | Remove version |

### Deprecation Headers

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: </api/v2/transactions>; rel="successor-version"
```

## Version Support

| Version | Status | Support Until | Notes |
|---------|--------|---------------|-------|
| v1 | Active | N/A (current) | Full support |
| v2 | Planned | - | Sprint 4 (Mobile) |

## Directory Structure

```
src/app/api/
├── v1/
│   ├── auth/
│   ├── transactions/
│   ├── budgets/
│   ├── categories/
│   ├── holdings/
│   └── recurring/
└── v2/  (future)
```

### Shared Code

Version-independent code:

```
src/lib/
├── api-auth.ts          # JWT verification
├── api-helpers.ts       # Response helpers
└── services/            # Business logic
    ├── transaction-service.ts
    ├── budget-service.ts
    └── ...
```

## Client Version Headers

Mobile clients should send:

```http
X-Client-Version: 1.2.0
X-Client-Platform: ios
```

Purpose: analytics, targeted deprecation notices, debugging.

## Error Handling

### Version-Agnostic Errors

```typescript
{ error: "Rate limit exceeded" }  // 429
{ error: "Unauthorized" }          // 401
{ error: "Internal server error" } // 500
```

### Version-Specific Validation

Validation errors may evolve between versions.

## Testing

```
tests/api/
├── v1/
│   ├── auth.test.ts
│   ├── transactions.test.ts
│   └── ...
└── v2/  (future)
```

## Changelog

### v1 (Current)

**Released**: January 2026

**Endpoints**:
- Auth: login, logout, refresh
- Transactions: CRUD + requests
- Budgets: upsert, delete
- Categories: create, archive
- Holdings: CRUD + price refresh
- Recurring: CRUD + apply

**Authentication**: JWT (Bearer token)

**Rate Limiting**: See [API Contracts](./API_CONTRACTS.md) for current limits

---

## References

- [API Audit](./API_AUDIT.md)
- [API Contracts](./API_CONTRACTS.md)
- [XSS Defense](./XSS_DEFENSE.md)
