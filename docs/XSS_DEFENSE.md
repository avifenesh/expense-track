# Security Overview

This document describes the security measures implemented to protect against common web vulnerabilities, with a focus on XSS (Cross-Site Scripting) prevention.

## XSS Defense Layers

The application employs multiple layers of defense against XSS attacks:

### 1. React Automatic Escaping

**Primary Defense**: React's JSX automatically escapes all text content rendered in components.

- All user content (transactions, categories, budgets, notes) rendered as `{variable}` in JSX
- React converts special characters to HTML entities:
  - `<` → `&lt;`
  - `>` → `&gt;`
  - `&` → `&amp;`
  - `"` → `&quot;`
  - `'` → `&#x27;`
- **No use of `dangerouslySetInnerHTML`** anywhere in the codebase
- Confirmed via codebase audit (grep search for `dangerouslySetInnerHTML` returned 0 results)

### 2. Content Security Policy (CSP)

**Location**: `src/middleware.ts`

- Nonce-based CSP with `strict-dynamic` directive
- Blocks inline script execution without valid nonce
- Prevents loading scripts from unauthorized origins
- Headers set on all responses via Next.js middleware

**CSP Directive**:

```
script-src 'nonce-{random}' 'strict-dynamic';
object-src 'none';
base-uri 'none';
```

### 3. Input Validation

**Location**: `src/schemas/index.ts`

All user inputs validated using Zod schemas before processing:

- **String length limits**: Transaction descriptions (240 chars), category names (2+ chars)
- **Type validation**: Currency enums, transaction types, amounts (positive Decimal)
- **Format validation**: Email format, month keys (YYYY-MM), date objects
- **Rejection of malformed input**: Invalid data returns structured error responses

### 4. URL Parameter Sanitization

**Locations**: `src/app/page.tsx`, `src/app/login/page.tsx`

URL parameters validated before use:

- **Month parameter**: Length check (≥7 chars) + format validation (YYYY-MM)
- **Account parameter**: Whitelist validation against user's accessible accounts (Map lookup)
- **Reason parameter**: Object property lookup with fallback to generic message
- Invalid parameters trigger safe fallback values (never reflected in output)

### 5. API Input Validation

**Locations**: `src/app/api/v1/auth/login/route.ts`, `src/app/api/holdings/route.ts`

API endpoints validate and sanitize inputs:

- **Login API**: Basic presence checks, normalized email, whitelist validation against `AUTH_USERS`
- **Holdings API**: Account ID whitelist validation, currency type guard (`isCurrency()`)
- **Generic error messages**: APIs return predefined error strings, never reflecting user input
- **No payload reflection**: User input not included in error responses

### 6. CSRF Protection

**Location**: `src/lib/csrf.ts`

- Double-submit cookie pattern with HMAC-SHA256 signing
- All mutating server actions require CSRF token validation via `requireCsrfToken()`
- Prevents cross-site request forgery attacks

---

## API Security

REST API endpoints use JWT Bearer authentication instead of cookie sessions. See `docs/API_AUDIT.md` for details on authentication patterns for web vs mobile clients.

**Key Differences:**
- Web: Cookie-based sessions with CSRF protection
- Mobile: JWT Bearer tokens (CSRF not applicable)

---

## XSS Test Coverage

**Location**: `tests/security/`

Comprehensive XSS vulnerability audit implemented with 17 test cases covering:

### Test Infrastructure

- **Payload Catalog** (`xss-payloads.ts`): 70+ attack vectors across 10 categories
  - Basic XSS (script tags, img onerror, svg onload)
  - Encoded payloads (HTML entities, URL encoding)
  - JavaScript URIs (javascript:, data: schemes)
  - Event handlers (onclick, onload, onerror)
  - Polyglots (context-agnostic multi-vector)
  - SQL injection (cross-contamination testing)
  - Special characters and edge cases
  - Attribute injection patterns
  - DOM-based XSS vectors
  - Obfuscation techniques

- **Test Helpers** (`xss-helpers.ts`): Validation utilities
  - `assertNoExecutableScript()`: Detects unescaped scripts, event handlers, javascript: URIs
  - `assertEscapedContent()`: Verifies proper HTML entity encoding
  - `htmlEscape()`: Simulates React JSX escaping for testing
  - `containsDangerousPatterns()`: Identifies XSS attack patterns

### Test Coverage by Attack Surface

**Stored XSS** (8 tests):

- Transaction descriptions
- Category names
- Budget notes
- Holding notes
- Recurring template descriptions

**Reflected XSS** (3 tests):

- Month URL parameter
- Account URL parameter
- Reason URL parameter

**Error Message Rendering** (3 tests):

- Transaction validation errors
- Category validation errors
- Budget validation errors

**API Endpoint Validation** (3 tests):

- Login API (email/password)
- Holdings API (accountId/currency)
- API error response safety

### Test Results

✅ **All 17 tests passing**
✅ **Zero vulnerabilities found**
✅ **All attack vectors properly mitigated**

---

## Audit Findings

### Summary

After comprehensive testing with 70+ XSS payloads across all user input surfaces and attack vectors:

**No XSS vulnerabilities were found.**

### Defense Validation

1. ✅ **React JSX Escaping**: All payloads properly escaped when rendered
2. ✅ **CSP**: Nonce-based policy prevents inline script execution
3. ✅ **Input Validation**: Malformed inputs rejected by Zod schemas
4. ✅ **URL Parameters**: All parameters validated/whitelisted before use
5. ✅ **API Endpoints**: Generic error messages, no payload reflection
6. ✅ **CSRF Protection**: All mutating actions require valid CSRF tokens

### Stored XSS Protection

- User content stored **as-is** in database (no pre-escaping)
- React automatically escapes content when rendered in JSX
- Verified with script tags, event handlers, JavaScript URIs, polyglots
- All payloads rendered as safe text, not executable code

### Reflected XSS Protection

- URL parameters never directly rendered
- Invalid parameters trigger safe fallback values
- Validation prevents XSS payloads from reaching application logic
- API responses use generic error messages (no user input reflection)

### DOM-Based XSS Protection

- No dynamic HTML generation with user input
- No `eval()`, `Function()`, or `innerHTML` usage with user data
- All DOM updates through React (automatic escaping)

---

## Security Best Practices

### For Developers

1. **Always render user content in JSX**: `{variable}` not `<div dangerouslySetInnerHTML={{__html: variable}} />`
2. **Use Zod schemas for all user inputs**: Define validation rules in `src/schemas/`
3. **Never reflect user input in error messages**: Use generic error strings
4. **Validate URL parameters**: Check length, format, whitelist membership before use
5. **Require CSRF tokens for mutations**: All server actions that modify data
6. **Test with XSS payloads**: Run `npm test -- tests/security/` before committing

### Prohibited Patterns

❌ **NEVER use** `dangerouslySetInnerHTML`
❌ **NEVER use** `eval()` or `Function()` with user input
❌ **NEVER use** `innerHTML` or `outerHTML` with user data
❌ **NEVER render** raw user input in HTML attributes
❌ **NEVER reflect** user input in API error responses

### Safe Patterns

✅ Render user content: `<p>{transaction.description}</p>`
✅ Render lists: `{items.map(item => <div key={item.id}>{item.name}</div>)}`
✅ Conditional rendering: `{user.name ? <span>{user.name}</span> : null}`
✅ URL-safe redirects: `redirect(\`/page?id=${encodeURIComponent(id)}\`)`✅ Generic errors:`return { error: 'Invalid request' }`(not`return { error: userInput }`)

---

## Incident Response

If an XSS vulnerability is discovered:

1. **Assess severity**: Can the vulnerability execute arbitrary scripts?
2. **Document**: Record payload, affected endpoint, steps to reproduce
3. **Fix immediately**: Apply appropriate defense layer (validation, escaping, CSP)
4. **Add test case**: Add payload to `tests/security/xss-payloads.ts` and create test
5. **Deploy fix**: Push to production as emergency patch
6. **Notify users**: If user data was potentially compromised

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [React Security Documentation](https://react.dev/reference/react-dom/server/renderToString#removing-rendertostring-from-the-client-code)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)

---

**Last Updated**: 2026-01-14
**Audit Status**: ✅ Comprehensive XSS audit complete (Issue #54)
