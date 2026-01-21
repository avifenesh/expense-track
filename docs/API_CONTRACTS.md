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
| 402 | Payment Required (subscription expired/inactive) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |


## Subscription Enforcement

**All mutating endpoints require an active subscription.** Endpoints that create, update, or delete resources will return 402 if the user's subscription is expired or inactive.

**402 Response Format:**
```json
{
  "error": "Active subscription required",
  "code": "SUBSCRIPTION_REQUIRED"
}
```

**Protected Endpoints:**
- Transaction creation and modification
- Transaction requests (create, approve, reject)
- Budget management
- Category management
- Holdings management
- Recurring templates
- Expense sharing

Mobile apps should:
1. Check subscription status on app launch via `GET /api/v1/subscriptions`
2. Handle 402 responses by prompting user to upgrade
3. Retry the request after successful subscription activation

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

## Expense Sharing Endpoints

### GET /api/v1/sharing

Retrieves all sharing data for the authenticated user including expenses they shared, expenses shared with them, and settlement balances.

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
        "totalAmount": "100.00",
        "currency": "USD",
        "description": "Dinner at restaurant",
        "createdAt": "2024-01-15T12:00:00Z",
        "transaction": {
          "id": "clx...",
          "date": "2024-01-15",
          "description": "Restaurant",
          "category": {
            "id": "clx...",
            "name": "Food & Dining"
          }
        },
        "participants": [
          {
            "id": "clx...",
            "shareAmount": "25.00",
            "sharePercentage": null,
            "status": "PENDING",
            "paidAt": null,
            "reminderSentAt": null,
            "participant": {
              "id": "clx...",
              "email": "friend@example.com",
              "displayName": "Friend"
            }
          }
        ],
        "totalOwed": "25.00",
        "totalPaid": "0.00",
        "allSettled": false
      }
    ],
    "expensesSharedWithMe": [
      {
        "id": "clx...",
        "shareAmount": "30.00",
        "sharePercentage": null,
        "status": "PENDING",
        "paidAt": null,
        "sharedExpense": {
          "id": "clx...",
          "splitType": "EQUAL",
          "totalAmount": "120.00",
          "currency": "USD",
          "description": "Team lunch",
          "createdAt": "2024-01-16T14:00:00Z",
          "transaction": {
            "id": "clx...",
            "date": "2024-01-16",
            "description": "Lunch",
            "category": {
              "id": "clx...",
              "name": "Food & Dining"
            }
          },
          "owner": {
            "id": "clx...",
            "email": "owner@example.com",
            "displayName": "Owner"
          }
        }
      }
    ],
    "settlementBalances": [
      {
        "userId": "clx...",
        "userEmail": "friend@example.com",
        "userDisplayName": "Friend",
        "currency": "USD",
        "youOwe": "30.00",
        "theyOwe": "25.00",
        "netBalance": "-5.00"
      }
    ]
  }
}
```

**Split Types:**
- `EQUAL` - Split equally among participants
- `PERCENTAGE` - Split by percentage
- `FIXED` - Fixed amounts per participant

**Payment Status:**
- `PENDING` - Awaiting payment
- `PAID` - Payment confirmed
- `DECLINED` - Participant declined

**Errors:**
- 401: Unauthorized - Invalid or missing auth token
- 429: Rate limited - Too many requests
- 500: Server error

---

### GET /api/v1/expenses/shared-by-me

List expenses shared by the authenticated user with others. Supports filtering by status and pagination.

**Auth:** Bearer token required

**Query Parameters:**
- `status`: Optional. Filter by status: `pending`, `settled`, or `all` (default: `all`)
  - `pending`: Expenses with at least one participant still pending payment
  - `settled`: Expenses where all participants have paid or declined
  - `all`: All shared expenses
- `limit`: Optional. Number of results (default: 50, max: 100)
- `offset`: Optional. Pagination offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "clx...",
        "transactionId": "clx...",
        "splitType": "EQUAL",
        "totalAmount": "100.00",
        "currency": "USD",
        "description": "Dinner at restaurant",
        "createdAt": "2024-01-15T12:00:00Z",
        "transaction": {
          "id": "clx...",
          "date": "2024-01-15",
          "description": "Restaurant",
          "category": {
            "id": "clx...",
            "name": "Food & Dining"
          }
        },
        "participants": [
          {
            "id": "clx...",
            "shareAmount": "50.00",
            "sharePercentage": null,
            "status": "PENDING",
            "paidAt": null,
            "reminderSentAt": null,
            "participant": {
              "id": "clx...",
              "email": "friend@example.com",
              "displayName": "Friend"
            }
          }
        ],
        "totalOwed": "50.00",
        "totalPaid": "0.00",
        "allSettled": false
      }
    ],
    "total": 10,
    "hasMore": true
  }
}
```

**Errors:**
- 400: Validation error - Invalid status, limit, or offset parameter
- 401: Unauthorized - Invalid or missing auth token
- 429: Rate limited - Too many requests

### GET /api/v1/expenses/shared-with-me

List expenses shared with the authenticated user by others. Supports filtering by participant status and pagination.

**Auth:** Bearer token required

**Query Parameters:**
- `status`: Optional. Filter by status: `pending`, `paid`, `declined`, or `all` (default: `all`)
  - `pending`: Expenses where the user has not yet paid
  - `paid`: Expenses where the user has paid
  - `declined`: Expenses the user has declined
  - `all`: All expenses shared with the user
- `limit`: Optional. Number of results (default: 50, max: 100)
- `offset`: Optional. Pagination offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "clx...",
        "shareAmount": "30.00",
        "sharePercentage": null,
        "status": "PENDING",
        "paidAt": null,
        "sharedExpense": {
          "id": "clx...",
          "splitType": "EQUAL",
          "totalAmount": "120.00",
          "currency": "USD",
          "description": "Team lunch",
          "createdAt": "2024-01-16T14:00:00Z",
          "transaction": {
            "id": "clx...",
            "date": "2024-01-16",
            "description": "Lunch",
            "category": {
              "id": "clx...",
              "name": "Food & Dining"
            }
          },
          "owner": {
            "id": "clx...",
            "email": "owner@example.com",
            "displayName": "Owner"
          }
        }
      }
    ],
    "total": 5,
    "hasMore": false
  }
}
```

**Errors:**
- 400: Validation error - Invalid status, limit, or offset parameter
- 401: Unauthorized - Invalid or missing auth token
- 429: Rate limited - Too many requests

---

### POST /api/v1/expenses/share

Share an expense with other users. Creates a shared expense from an existing transaction, calculating participant shares based on the split type.

**Auth:** Bearer token required
**Subscription:** Active subscription required (returns 402 if expired)

**Request:**
```json
{
  "transactionId": "clx...",
  "splitType": "EQUAL",
  "description": "Dinner at restaurant",
  "participants": [
    {
      "email": "friend@example.com"
    }
  ]
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| transactionId | string | Yes | ID of the transaction to share |
| splitType | string | No | `EQUAL` (default), `PERCENTAGE`, or `FIXED` |
| description | string | No | Optional description (max 240 chars) |
| participants | array | Yes | At least one participant |
| participants[].email | string | Yes | Participant's email address |
| participants[].shareAmount | number | Conditional | Required for `FIXED` splits |
| participants[].sharePercentage | number | Conditional | Required for `PERCENTAGE` splits (0-100) |

**Split Type Behavior:**
- `EQUAL`: Amount divided equally among all participants + owner
- `PERCENTAGE`: Each participant gets their specified percentage of the total
- `FIXED`: Each participant gets their specified fixed amount

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "transactionId": "clx...",
    "splitType": "EQUAL",
    "totalAmount": "100.00",
    "currency": "USD",
    "description": "Dinner at restaurant",
    "createdAt": "2024-01-15T12:00:00Z",
    "participants": [
      {
        "id": "clx...",
        "userId": "clx...",
        "email": "friend@example.com",
        "displayName": "Friend",
        "shareAmount": "50.00",
        "sharePercentage": null,
        "status": "PENDING"
      }
    ]
  }
}
```

**Errors:**

| Code | Condition |
|------|-----------|
| 400 | Validation error (invalid email, missing fields, self-sharing, etc.) |
| 401 | Invalid or missing auth token |
| 402 | Subscription required |
| 403 | User does not own the transaction |
| 404 | Transaction not found |
| 409 | Transaction is already shared |
| 429 | Rate limited |

**Example Error (400 - Participant not found):**
```json
{
  "error": "Validation failed",
  "fields": {
    "participants": ["Users not found: invalid@example.com"]
  }
}
```

**Notes:**
- User cannot share an expense with themselves
- All participant emails must belong to registered users
- For `FIXED` splits, total share amounts cannot exceed transaction amount
- For `PERCENTAGE` splits, total percentage cannot exceed 100%
- Email notifications are sent to participants (asynchronous)


### POST /api/v1/expenses/shares/[participantId]/decline

Decline a shared expense assigned to you.

**Auth:** Bearer token required

**Authorization:** Only the participant (assignee) can decline their own share. The expense owner cannot decline on behalf of participants.

**Status Requirements:** Share must be in PENDING status. Cannot decline shares that are already PAID or DECLINED.

**Request (optional):**
```json
{
  "reason": "I was not part of this expense"
}
```

**Request Fields:**
- `reason`: Optional decline explanation

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "status": "DECLINED",
    "declinedAt": "2024-01-16T14:00:00.000Z"
  }
}
```

**Response Fields:**
- `id`: The participant ID
- `status`: Always "DECLINED" on success
- `declinedAt`: Decline timestamp

**Errors:**
- 400: Validation error - Share is not in PENDING status (already paid or declined), or reason is not a string
- 401: Unauthorized - Invalid or missing auth token
- 403: Forbidden - You can only decline shares assigned to you
- 404: Not found - Participant not found
- 429: Rate limited - Too many requests

---

### PATCH /api/v1/expenses/shares/[participantId]/paid

Mark a participant's share as paid (owner only).

**Auth:** Bearer token required

**Authorization:** Only the expense owner can mark payments as received. Participants cannot mark their own shares as paid.

**Status Requirements:** Share must be in PENDING status. Cannot mark shares that are already PAID or DECLINED.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "status": "PAID",
    "paidAt": "2024-01-16T14:00:00.000Z"
  }
}
```

**Response Fields:**
- `id`: The participant ID
- `status`: Always "PAID" on success
- `paidAt`: Payment confirmation timestamp

**Errors:**
- 400: Validation error - Share is not in PENDING status (already paid or declined)
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 403: Forbidden - Only the expense owner can mark payments
- 404: Not found - Participant not found
- 429: Rate limited - Too many requests

---

### DELETE /api/v1/expenses/shares/[sharedExpenseId] (PLANNED)

> ⚠️ **Not yet implemented.** Planned for future release.

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

### POST /api/v1/expenses/shares/[participantId]/remind (PLANNED)

> ⚠️ **Not yet implemented.** Planned for future release.

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

### GET /api/v1/users/lookup (PLANNED)

> ⚠️ **Not yet implemented.** Planned for future release.

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
---

## User & Account Endpoints

### GET /api/v1/users/me

Get current user profile including subscription status.

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
    "createdAt": "2024-01-15T00:00:00.000Z",
    "hasCompletedOnboarding": true,
    "subscription": {
      "status": "TRIALING",
      "isActive": true,
      "canAccessApp": true,
      "trialEndsAt": "2024-02-01T00:00:00.000Z",
      "currentPeriodEnd": null,
      "daysRemaining": 14
    }
  }
}
```

**Subscription Status Values:**
- `TRIALING` - User is in trial period, `trialEndsAt` shows end date
- `ACTIVE` - Paid subscription, `currentPeriodEnd` shows renewal date
- `PAST_DUE` - Payment failed, user retains access temporarily
- `CANCELED` - User canceled, retains access until `currentPeriodEnd`
- `EXPIRED` - No access, trial/subscription ended

**Error Responses:**
- 401: Invalid or missing auth token
- 429: Rate limited

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

## Onboarding Endpoints

> ✅ **Implemented in Sprint 3 (Issue #219).** Mobile onboarding flow fully supported.

### POST /api/v1/onboarding/complete

Mark onboarding as complete.

**Auth:** Bearer token required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "hasCompletedOnboarding": true
  }
}
```

**Errors:**
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 429: Rate limited - Too many requests

---

### POST /api/v1/onboarding/skip (PLANNED)

> ⚠️ **Not yet implemented.** Planned for future release.

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

**Validation:**
- `currency`: Required. One of: USD, EUR, ILS.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "currency": "EUR"
  }
}
```

**Errors:**
- 400: Validation error - Invalid currency
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 429: Rate limited - Too many requests

---

### POST /api/v1/categories/bulk

Bulk create categories (or reactivate existing archived ones).

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

**Validation:**
- `categories`: Required. Array of category objects (minimum 1).
- `name`: Required. Min 2 characters.
- `type`: Required. One of: INCOME, EXPENSE.
- `color`: Optional. Hex color code.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "categoriesCreated": 2,
    "categories": [
      { 
        "id": "clx...", 
        "name": "Food", 
        "type": "EXPENSE", 
        "color": "#4CAF50",
        "isArchived": false,
        "isHolding": false,
        "userId": "clx..."
      },
      { 
        "id": "clx...", 
        "name": "Salary", 
        "type": "INCOME", 
        "color": "#2196F3",
        "isArchived": false,
        "isHolding": false,
        "userId": "clx..."
      }
    ]
  }
}
```

**Errors:**
- 400: Validation error - Invalid input
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 429: Rate limited - Too many requests

---

### POST /api/v1/budgets/quick

Create a budget for specified account, category, and month (used during onboarding).

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx...",
  "categoryId": "clx...",
  "monthKey": "2024-01",
  "planned": 500.00,
  "currency": "USD"
}
```

**Validation:**
- `accountId`: Required. User must own the account.
- `categoryId`: Required. User must own the category.
- `monthKey`: Required. YYYY-MM format.
- `planned`: Required. Min 0.
- `currency`: Optional. Defaults to USD. One of: USD, EUR, ILS.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

**Errors:**
- 400: Validation error - Invalid input
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired or access denied
- 429: Rate limited - Too many requests

---

### POST /api/v1/seed-data

Seed user's account with sample data (default categories, sample transactions, sample budget).

**Auth:** Bearer token required

**Response (201):**
```json
{
  "success": true,
  "data": {
    "categoriesCreated": 14,
    "transactionsCreated": 2,
    "budgetsCreated": 1
  }
}
```

**Sample Data:**
- **Categories**: 8 expense categories (Groceries, Transportation, etc.) + 6 income categories (Salary, etc.)
- **Transactions**: 1 grocery expense ($85.50) + 1 salary income ($3500)
- **Budgets**: 1 grocery budget ($400)

**Errors:**
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired or no account found
- 429: Rate limited - Too many requests

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
      "monthlyPriceCents": 300,
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

## Accounts Endpoints

### GET /api/v1/accounts

Retrieves all accounts for the authenticated user.

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

**Errors:**
- 401: Unauthorized - Invalid or missing auth token
- 429: Rate limited - Too many requests
- 500: Server error - Unable to fetch accounts

---

### PATCH /api/v1/accounts/[id]/activate

Switch the active account for the authenticated user. Updates the user's `activeAccountId` to persist account selection across sessions.

**Auth:** Bearer token required

**Path Parameters:**
- `id`: Account ID to activate (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "activeAccountId": "clx..."
  }
}
```

**Errors:**
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 404: Not found - Account does not exist or user does not own it
- 429: Rate limited - Too many requests

**Security:**
- Users can only activate accounts they own
- Account ownership verified server-side
- Requires active subscription

---

## Holdings Endpoints

### POST /api/v1/holdings

Creates a new stock/investment holding.

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx...",
  "categoryId": "clx...",
  "symbol": "AAPL",
  "quantity": 10.5,
  "averageCost": 150.25,
  "currency": "USD",
  "notes": "Long-term investment"
}
```

**Validation:**
- `accountId`: Required. User must own the account.
- `categoryId`: Required. Category must have `isHolding=true`.
- `symbol`: Required. 1-5 uppercase letters. Validated against external stock API.
- `quantity`: Required. Min 0.000001, max 999999999.
- `averageCost`: Required. Min 0.
- `currency`: Required. One of: USD, EUR, ILS.
- `notes`: Optional. Max 240 characters.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "accountId": "clx...",
    "categoryId": "clx...",
    "symbol": "AAPL",
    "quantity": "10.5",
    "averageCost": "150.25",
    "currency": "USD",
    "notes": "Long-term investment"
  }
}
```

**Errors:**
- 400: Validation error - Invalid input, symbol, or category
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 403: Forbidden - User doesn't own the account
- 404: Not found - Category not found
- 429: Rate limited - Too many requests
- 500: Server error - Holding may already exist

---

### PUT /api/v1/holdings/[id]

Updates an existing holding.

**Auth:** Bearer token required

**Request:**
```json
{
  "quantity": 15.0,
  "averageCost": 145.00,
  "notes": "Updated position"
}
```

**Validation:**
- `quantity`: Required. Min 0.000001, max 999999999.
- `averageCost`: Required. Min 0.
- `notes`: Optional. Max 240 characters.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "accountId": "clx...",
    "categoryId": "clx...",
    "symbol": "AAPL",
    "quantity": "15.0",
    "averageCost": "145.00",
    "currency": "USD",
    "notes": "Updated position"
  }
}
```

**Errors:**
- 400: Validation error - Invalid input data
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 404: Not found - Holding does not exist
- 429: Rate limited - Too many requests

---

### DELETE /api/v1/holdings/[id]

Deletes an existing holding.

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

**Errors:**
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 404: Not found - Holding does not exist
- 429: Rate limited - Too many requests

---

### POST /api/v1/holdings/refresh

Refreshes stock prices for all holdings in an account from external API.

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "updated": 5,
    "errors": []
  }
}
```

**Errors:**
- 400: Validation error - Invalid input data
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 403: Forbidden - User doesn't own the account
- 429: Rate limited - Too many requests
- 500: Server error - Unable to refresh prices

---

## Recurring Template Endpoints

### POST /api/v1/recurring

Creates or updates a recurring transaction template.

**Auth:** Bearer token required

**Request:**
```json
{
  "id": "clx...",
  "accountId": "clx...",
  "categoryId": "clx...",
  "type": "EXPENSE",
  "amount": 50.00,
  "currency": "USD",
  "dayOfMonth": 15,
  "description": "Netflix subscription",
  "startMonthKey": "2024-01",
  "endMonthKey": "2024-12",
  "isActive": true
}
```

**Validation:**
- `id`: Optional. Template ID for updates. If omitted, creates new template.
- `accountId`: Required. User must own the account.
- `categoryId`: Required. Category for generated transactions.
- `type`: Required. One of: INCOME, EXPENSE.
- `amount`: Required. Min 0.01.
- `currency`: Required. One of: USD, EUR, ILS.
- `dayOfMonth`: Required. 1-31. Day of month to generate transaction.
- `description`: Optional. Max 240 characters.
- `startMonthKey`: Required. YYYY-MM format.
- `endMonthKey`: Optional. YYYY-MM format. Must be >= startMonthKey.
- `isActive`: Optional. Default true.

**Response (200/201):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "accountId": "clx...",
    "categoryId": "clx...",
    "type": "EXPENSE",
    "amount": "50.00",
    "currency": "USD",
    "dayOfMonth": 15,
    "description": "Netflix subscription",
    "startMonth": "2024-01-01",
    "endMonth": "2024-12-01",
    "isActive": true
  }
}
```

**Errors:**
- 400: Validation error - Invalid input data
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 403: Forbidden - User doesn't own the account/template
- 429: Rate limited - Too many requests
- 500: Server error - Unable to save template

---

### PATCH /api/v1/recurring/[id]/toggle

Toggles a recurring template's active status.

**Auth:** Bearer token required

**Request:**
```json
{
  "isActive": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "isActive": false
  }
}
```

**Errors:**
- 400: Validation error - Invalid input data
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 404: Not found - Recurring template not found
- 429: Rate limited - Too many requests

---

### POST /api/v1/recurring/apply

Applies recurring templates to generate transactions for a specific month.

**Auth:** Bearer token required

**Request:**
```json
{
  "accountId": "clx...",
  "monthKey": "2024-01",
  "templateIds": ["clx...", "clx..."]
}
```

**Validation:**
- `accountId`: Required. User must own the account.
- `monthKey`: Required. YYYY-MM format. Target month for transaction generation.
- `templateIds`: Optional. Specific template IDs to apply. If omitted, applies all active templates.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "created": 3,
    "skipped": 1,
    "errors": []
  }
}
```

**Errors:**
- 400: Validation error - Invalid input data
- 401: Unauthorized - Invalid or missing auth token
- 402: Payment Required - Subscription expired
- 403: Forbidden - User doesn't own the account
- 429: Rate limited - Too many requests
- 500: Server error - Unable to create transactions

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
