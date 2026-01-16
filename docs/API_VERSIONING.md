# API Versioning Strategy

This document outlines the versioning strategy for the expense-track REST API, ensuring backward compatibility and smooth evolution of the API as the mobile app and web app develop.

## Current API Version

**Version**: v1
**Base URL**: `/api/v1/`
**Status**: Active, Production-ready

## Versioning Approach

### URL Path Versioning

We use URL path versioning for clarity and simplicity:

```
/api/v1/transactions
/api/v1/budgets
/api/v1/categories
```

**Rationale:**
- Clear and visible in URLs
- Easy to route at the infrastructure level
- Simple to implement in Next.js App Router
- Mobile apps can easily switch versions
- Works well with API documentation tools

### Alternatives Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| URL Path (`/api/v1/`) | Clear, simple, cacheable | URL changes on version bump | **Chosen** |
| Header (`Accept: application/vnd.api.v1+json`) | Clean URLs | Hidden, harder to debug | Rejected |
| Query param (`?version=1`) | Simple to add | Not cacheable, messy | Rejected |

## Version Lifecycle

### Active Versions

| Version | Status | Supported Until |
|---------|--------|-----------------|
| v1 | Active | Indefinite |

### Version States

1. **Active**: Current production version, receiving new features
2. **Maintained**: No new features, only security/critical bug fixes
3. **Deprecated**: 6-month warning before removal, deprecation headers sent
4. **Retired**: No longer available

## When to Create a New Version

Create a new API version (v2) when making **breaking changes**:

### Breaking Changes (Require New Version)

- Removing an endpoint
- Removing a field from a response
- Changing a field's data type
- Changing required fields in requests
- Changing authentication mechanism
- Changing error response format
- Renaming endpoints or fields

### Non-Breaking Changes (Same Version)

- Adding new endpoints
- Adding optional fields to requests
- Adding new fields to responses
- Adding new optional query parameters
- Adding new error codes (with backward-compatible format)
- Performance improvements
- Bug fixes

## Backward Compatibility Policy

### Commitments

1. **No surprise removals**: Fields and endpoints are never removed without 6-month deprecation notice
2. **Additive changes only**: New features are added without breaking existing clients
3. **Stable contracts**: Response structure remains consistent within a version
4. **Migration guides**: Every major version change includes a migration guide

### Client Expectations

Mobile clients should:
- Handle unknown fields gracefully (ignore them)
- Use feature detection for optional functionality
- Monitor deprecation warnings
- Plan upgrades during deprecation periods

## Deprecation Process

### Timeline

1. **T-6 months**: Deprecation announced in changelog and docs
2. **T-6 months**: `Deprecation` header added to responses
3. **T-3 months**: Warning emails sent to registered developers
4. **T-1 month**: Final notice, API returns deprecation warnings
5. **T-0**: Endpoint removed, returns 410 Gone

### Deprecation Headers

When an endpoint or field is deprecated:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jul 2025 00:00:00 GMT
Link: </api/v2/transactions>; rel="successor-version"
```

### Deprecation Response Body

```json
{
  "success": true,
  "data": { ... },
  "_deprecation": {
    "message": "This endpoint is deprecated and will be removed on 2025-07-01",
    "successor": "/api/v2/transactions",
    "documentation": "https://docs.example.com/migration/v1-to-v2"
  }
}
```

## Version Discovery

### Version Endpoint

```
GET /api/versions
```

**Response:**
```json
{
  "versions": [
    {
      "version": "v1",
      "status": "active",
      "baseUrl": "/api/v1",
      "documentation": "https://docs.example.com/api/v1"
    }
  ],
  "current": "v1",
  "latest": "v1"
}
```

### Health Check with Version

```
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "v1",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

## Mobile App Considerations

### Version Pinning

Mobile apps should:
1. Pin to a specific API version in config
2. Check for new versions on app start (optional)
3. Handle 410 Gone responses gracefully
4. Show upgrade prompts when using deprecated APIs

### Example Mobile Config

```typescript
// config/api.ts
export const API_CONFIG = {
  version: 'v1',
  baseUrl: 'https://api.expense-track.com/api/v1',
  minSupportedVersion: 'v1',
  checkVersionOnStart: true,
};
```

### Version Negotiation

If a mobile app uses an unsupported version:

```http
GET /api/v0/transactions HTTP/1.1
```

**Response (410 Gone):**
```json
{
  "success": false,
  "error": "API version v0 is no longer supported",
  "supportedVersions": ["v1"],
  "upgradeUrl": "https://docs.example.com/migration/v0-to-v1"
}
```

## Documentation Standards

### Per-Version Documentation

Each API version has:
- OpenAPI/Swagger specification
- Changelog from previous version
- Migration guide from previous version
- Code examples in multiple languages

### Changelog Format

```markdown
# API v1 Changelog

## 2024-01-15
### Added
- POST /api/v1/expenses/share - Share expenses with other users
- GET /api/v1/dashboard - Dashboard summary endpoint

### Changed
- GET /api/v1/transactions now includes category details by default

### Deprecated
- None

### Removed
- None
```

## Implementation in Next.js

### Route Structure

```
src/app/api/
├── versions/
│   └── route.ts           # GET /api/versions
├── v1/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   └── refresh/route.ts
│   ├── transactions/
│   │   ├── route.ts       # GET, POST
│   │   └── [id]/route.ts  # GET, PUT, DELETE
│   └── ...
└── v2/                    # Future version
    └── ...
```

### Version Middleware

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check for deprecated API version
  if (pathname.startsWith('/api/v0')) {
    return NextResponse.json(
      {
        success: false,
        error: 'API version v0 is no longer supported',
        supportedVersions: ['v1'],
      },
      { status: 410 }
    );
  }

  return NextResponse.next();
}
```

## Security Considerations

### Version-Specific Security

- Each version maintains its own security patches
- Critical security fixes are backported to all supported versions
- Authentication mechanism changes require new version

### Rate Limiting by Version

Rate limits may vary by version:
- Newer versions may have higher limits
- Deprecated versions may have reduced limits to encourage migration

## Future Planning

### v2 Considerations

When planning v2, consider:
- GraphQL alongside REST
- Real-time subscriptions (WebSockets)
- Batch operations
- Improved pagination (cursor-based)
- Enhanced filtering/sorting

### Migration Path

When v2 is released:
1. v1 enters "Maintained" state
2. 6-month parallel operation
3. Migration tools provided
4. v1 enters "Deprecated" state
5. 6-month deprecation period
6. v1 retired

## Summary

| Aspect | Decision |
|--------|----------|
| Versioning style | URL path (`/api/v1/`) |
| Breaking changes | New version required |
| Deprecation period | 6 months minimum |
| Parallel versions | Maximum 2 active versions |
| Documentation | OpenAPI per version |
| Mobile support | Version pinning recommended |
