# API Contracts for Mobile

This document defines the REST API contracts for mobile app development. It covers existing endpoints and specifies contracts for recommended new endpoints.

## Authentication

All authenticated endpoints require a JWT Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained from `/api/v1/auth/login` and refreshed via `/api/v1/auth/refresh`.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "fieldName": ["Error message 1", "Error message 2"]
  }
}
```

## ID Format

All resource IDs use CUID (Collision-resistant Unique Identifier) format:
- Example: `clx1234567890abcdefghij`
- 25 characters, URL-safe, sortable by creation time
- Generated server-side, never client-provided

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/expired token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Auth Endpoints

### POST /api/v1/auth/login

Authenticate user and obtain tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

**Errors:**
- 401: Invalid credentials
- 403: Email not verified

---

### POST /api/v1/auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

**Errors:**
- 401: Invalid or expired refresh token

---

### POST /api/v1/auth/logout

Invalidate refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### POST /api/v1/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Please check your email to verify your account."
  }
}
```

**Errors:**
- 400: Validation error (weak password, invalid email)
- 409: Email already registered

---

### POST /api/v1/auth/verify-email

Verify email address with token.

**Request:**
```json
{
  "token": "verification_token_here"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

**Errors:**
- 400: Invalid or expired token

---

### POST /api/v1/auth/resend-verification

Resend verification email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a verification link has been sent."
  }
}
```

---

### POST /api/v1/auth/request-reset

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a reset link has been sent."
  }
}
```

---

### POST /api/v1/auth/reset-password

Reset password using token.

**Request:**
```json
{
  "token": "reset_token_here",
  "newPassword": "newPassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

**Errors:**
- 400: Invalid or expired token
- 400: Password too weak

---

### DELETE /api/v1/auth/account (PLANNED)

> ⚠️ **Not yet implemented.** Planned for GDPR compliance.

Delete user account (GDPR compliance).

**Auth:** Bearer token required

**Request:**
```json
{
  "confirmEmail": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Account deleted successfully"
  }
}
```

**Errors:**
- 400: Email confirmation does not match

---

### GET /api/v1/auth/export (PLANNED)

> ⚠️ **Not yet implemented.** Planned for GDPR compliance.

Export all user data (GDPR compliance).

**Auth:** Bearer token required

**Query Parameters:**
- `format`: `json` (default) or `csv`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accounts": [ ... ],
    "categories": [ ... ],
    "transactions": [ ... ],
    "budgets": [ ... ],
    "holdings": [ ... ],
    "recurringTemplates": [ ... ],
    "sharedExpenses": [ ... ]
  }
}
```

---

## Transaction Endpoints

### GET /api/v1/transactions

List transactions with filters.

**Auth:** Bearer token required

**Query Parameters:**
- `accountId`: Filter by account (required)
- `month`: Filter by month (YYYY-MM format)
- `categoryId`: Filter by category
- `type`: Filter by type (`INCOME` or `EXPENSE`)
- `limit`: Number of results (default: 50, max: 100)
- `offset`: Pagination offset

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "clx...",
        "accountId": "clx...",
        "categoryId": "clx...",
        "type": "EXPENSE",
        "amount": "125.50",
        "currency": "USD",
        "date": "2024-01-15",
        "month": "2024-01-01",
        "description": "Grocery shopping",
        "isRecurring": false,
        "category": {
          "id": "clx...",
          "name": "Food",
          "type": "EXPENSE",
          "color": "#4CAF50"
        }
      }
    ],
    "total": 150,
    "hasMore": true
  }
}
```

---

### POST /api/v1/transactions

Create a new transaction.

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx...",
  "categoryId": "clx...",
  "type": "EXPENSE",
  "amount": 125.50,
  "currency": "USD",
  "date": "2024-01-15",
  "description": "Grocery shopping",
  "isRecurring": false
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "accountId": "clx...",
    "categoryId": "clx...",
    "type": "EXPENSE",
    "amount": "125.50",
    "currency": "USD",
    "date": "2024-01-15",
    "month": "2024-01-01",
    "description": "Grocery shopping",
    "isRecurring": false
  }
}
```

---

### PUT /api/v1/transactions/[id]

Update a transaction.

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx...",
  "categoryId": "clx...",
  "type": "EXPENSE",
  "amount": 130.00,
  "currency": "USD",
  "date": "2024-01-15",
  "description": "Grocery shopping (updated)",
  "isRecurring": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    ...
  }
}
```

---

### DELETE /api/v1/transactions/[id]

Delete a transaction.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx..."
  }
}
```

---

## Budget Endpoints

### GET /api/v1/budgets

List budgets.

**Auth:** Bearer token required

**Query Parameters:**
- `accountId`: Filter by account (required)
- `month`: Filter by month (YYYY-MM format)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "budgets": [
      {
        "id": "clx...",
        "accountId": "clx...",
        "categoryId": "clx...",
        "month": "2024-01-01",
        "planned": "500.00",
        "currency": "USD",
        "notes": "Monthly food budget",
        "category": {
          "id": "clx...",
          "name": "Food",
          "type": "EXPENSE",
          "color": "#4CAF50"
        }
      }
    ]
  }
}
```

---

### POST /api/v1/budgets

Create or update a budget.

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx...",
  "categoryId": "clx...",
  "monthKey": "2024-01",
  "planned": 500.00,
  "currency": "USD",
  "notes": "Monthly food budget"
}
```

**Response (200/201):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "accountId": "clx...",
    "categoryId": "clx...",
    "month": "2024-01-01",
    "planned": "500.00",
    "currency": "USD",
    "notes": "Monthly food budget"
  }
}
```

---

### DELETE /api/v1/budgets

Delete a budget.

**Auth:** Bearer token required

**Query Parameters:**
- `accountId`: Account ID (required)
- `categoryId`: Category ID (required)
- `monthKey`: Month key in YYYY-MM format (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

## Category Endpoints

### GET /api/v1/categories

List user categories.

**Auth:** Bearer token required

**Query Parameters:**
- `type`: Filter by type (`INCOME` or `EXPENSE`)
- `includeArchived`: Include archived categories (default: false)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "clx...",
        "name": "Food",
        "type": "EXPENSE",
        "color": "#4CAF50",
        "isArchived": false,
        "userId": "clx..."
      }
    ]
  }
}
```

---

### POST /api/v1/categories

Create a new category.

**Auth:** Bearer token required

**Request:**
```json
{
  "name": "Entertainment",
  "type": "EXPENSE",
  "color": "#9C27B0"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "Entertainment",
    "type": "EXPENSE",
    "color": "#9C27B0",
    "isArchived": false,
    "isHolding": false,
    "userId": "clx..."
  }
}
```

---

### PATCH /api/v1/categories/[id]/archive

Archive or unarchive a category.

**Auth:** Bearer token required

**Request:**
```json
{
  "isArchived": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "name": "Entertainment",
    "type": "EXPENSE",
    "color": "#9C27B0",
    "isArchived": true
  }
}
```

---

## Expense Sharing Endpoints (PLANNED - Sprint 3)

> ⚠️ **Not yet implemented.** These endpoints are planned for Sprint 3 mobile development.

### POST /api/v1/expenses/share

Share an expense with other users.

**Auth:** Bearer token required

**Request:**
```json
{
  "transactionId": "clx...",
  "splitType": "EQUAL",
  "description": "Dinner at restaurant",
  "participants": [
    {
      "email": "friend@example.com",
      "shareAmount": 25.00
    }
  ]
}
```

**Split Types:**
- `EQUAL`: Split equally among participants
- `PERCENTAGE`: Split by percentage
- `FIXED`: Fixed amounts per participant

**Response (201):**
```json
{
  "success": true,
  "data": {
    "sharedExpenseId": "clx...",
    "participants": [
      {
        "id": "clx...",
        "userId": "clx...",
        "email": "friend@example.com",
        "shareAmount": "25.00",
        "status": "PENDING"
      }
    ]
  }
}
```

---

### GET /api/v1/expenses/shared-by-me

Get expenses I've shared with others.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sharedExpenses": [
      {
        "id": "clx...",
        "transactionId": "clx...",
        "splitType": "EQUAL",
        "description": "Dinner at restaurant",
        "totalAmount": "100.00",
        "currency": "USD",
        "createdAt": "2024-01-15T12:00:00Z",
        "participants": [
          {
            "id": "clx...",
            "user": {
              "email": "friend@example.com",
              "displayName": "Friend"
            },
            "shareAmount": "25.00",
            "status": "PENDING"
          }
        ]
      }
    ]
  }
}
```

---

### GET /api/v1/expenses/shared-with-me

Get expenses others have shared with me.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "participations": [
      {
        "id": "clx...",
        "shareAmount": "25.00",
        "status": "PENDING",
        "sharedExpense": {
          "id": "clx...",
          "description": "Dinner at restaurant",
          "totalAmount": "100.00",
          "currency": "USD",
          "owner": {
            "email": "owner@example.com",
            "displayName": "Owner"
          }
        }
      }
    ]
  }
}
```

---

### PATCH /api/v1/expenses/shares/[participantId]/paid

Mark a share as paid.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "status": "PAID",
    "paidAt": "2024-01-16T14:00:00Z"
  }
}
```

---

### POST /api/v1/expenses/shares/[participantId]/decline

Decline a shared expense.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "status": "DECLINED"
  }
}
```

---

### DELETE /api/v1/expenses/shares/[sharedExpenseId]

Cancel a shared expense.

**Auth:** Bearer token required (must be owner)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Shared expense cancelled"
  }
}
```

---

### POST /api/v1/expenses/shares/[participantId]/remind

Send payment reminder to participant.

**Auth:** Bearer token required (must be owner)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Reminder sent"
  }
}
```

---

### GET /api/v1/users/lookup

Lookup user by email for sharing.

**Auth:** Bearer token required

**Query Parameters:**
- `email`: Email to lookup (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "friend@example.com",
      "displayName": "Friend"
    }
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

## User & Account Endpoints (PLANNED - Sprint 3)

> ⚠️ **Not yet implemented.** These endpoints are planned for Sprint 3 mobile development.

### GET /api/v1/users/me

Get current user profile.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "email": "user@example.com",
    "displayName": "John Doe",
    "preferredCurrency": "USD",
    "hasCompletedOnboarding": true,
    "subscription": {
      "status": "ACTIVE",
      "currentPeriodEnd": "2024-02-15T00:00:00Z"
    }
  }
}
```

---

### GET /api/v1/accounts

List user's accounts.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "clx...",
        "name": "Personal",
        "type": "PERSONAL",
        "preferredCurrency": "USD",
        "color": "#4CAF50",
        "icon": "wallet",
        "description": "My personal account"
      }
    ]
  }
}
```

---

### GET /api/v1/dashboard (PLANNED)

> ⚠️ **Not yet implemented.** Planned for mobile dashboard.

Get dashboard summary data.

**Auth:** Bearer token required

**Query Parameters:**
- `accountId`: Account ID (required)
- `month`: Month in YYYY-MM format (default: current month)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncome": "5000.00",
      "totalExpenses": "3500.00",
      "netSavings": "1500.00",
      "currency": "USD"
    },
    "budgetProgress": [
      {
        "categoryId": "clx...",
        "categoryName": "Food",
        "planned": "500.00",
        "spent": "350.00",
        "remaining": "150.00",
        "percentUsed": 70
      }
    ],
    "recentTransactions": [
      {
        "id": "clx...",
        "amount": "125.50",
        "description": "Grocery shopping",
        "date": "2024-01-15",
        "category": {
          "name": "Food",
          "color": "#4CAF50"
        }
      }
    ],
    "pendingShares": {
      "owedToMe": "75.00",
      "owedByMe": "25.00"
    }
  }
}
```

---

## Onboarding Endpoints (PLANNED - Sprint 3)

> ⚠️ **Not yet implemented.** These endpoints are planned for Sprint 3 mobile development.

### POST /api/v1/onboarding/complete

Mark onboarding as complete.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Onboarding completed"
  }
}
```

---

### POST /api/v1/onboarding/skip

Skip onboarding flow.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Onboarding skipped"
  }
}
```

---

### PATCH /api/v1/users/me/currency

Update preferred currency.

**Auth:** Bearer token required

**Request:**
```json
{
  "currency": "EUR"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "preferredCurrency": "EUR"
  }
}
```

---

### POST /api/v1/categories/bulk

Bulk create categories.

**Auth:** Bearer token required

**Request:**
```json
{
  "categories": [
    { "name": "Food", "type": "EXPENSE", "color": "#4CAF50" },
    { "name": "Salary", "type": "INCOME", "color": "#2196F3" }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "categoriesCreated": 2,
    "categories": [
      { "id": "clx...", "name": "Food", "type": "EXPENSE", "color": "#4CAF50" },
      { "id": "clx...", "name": "Salary", "type": "INCOME", "color": "#2196F3" }
    ]
  }
}
```

---

## Subscription & Payment Endpoints

### GET /api/v1/subscriptions

Get current user's subscription state and Paddle checkout settings.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "status": "ACTIVE",
      "isActive": true,
      "canAccessApp": true,
      "trialEndsAt": "2024-01-29T00:00:00Z",
      "currentPeriodEnd": "2024-02-15T00:00:00Z",
      "daysRemaining": 15,
      "paddleCustomerId": "ctm_...",
      "paddleSubscriptionId": "sub_..."
    },
    "checkout": {
      "priceId": "pri_...",
      "customData": {
        "user_id": "clx..."
      },
      "customerEmail": "user@example.com"
    },
    "pricing": {
      "monthlyPriceCents": 500,
      "trialDays": 14,
      "currency": "USD"
    }
  }
}
```

**Subscription Status Values:**
- `TRIALING` - Active trial period
- `ACTIVE` - Paid and active
- `PAST_DUE` - Payment failed, grace period
- `CANCELED` - Canceled, access until period end
- `EXPIRED` - No longer has access

**Notes:**
- `checkout` will be `null` if Paddle is not configured
- `canAccessApp` determines if user can access features
- Mobile apps should check this endpoint on launch

---


## Rate Limiting

Endpoints are rate-limited per user/identifier with sliding window:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Default (general API) | 100 requests | 1 minute |
| Login | 5 requests | 1 minute |
| Registration | 3 requests | 1 minute |
| Password reset | 3 requests | 1 hour |
| Resend verification | 3 requests | 15 minutes |
| Account deletion | 3 requests | 1 hour |
| Data export | 3 requests | 1 hour |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705334400
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Number of items (default: 50, max: 100)
- `offset`: Skip N items

**Response includes:**
```json
{
  "data": {
    "items": [...],
    "total": 150,
    "hasMore": true
  }
}
```
