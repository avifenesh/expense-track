# Implementation Plan: Settlement Summary for Expense Sharing (#275)

## Overview

The settlement summary component already exists (`src/components/dashboard/settlement-summary.tsx`) and displays basic net balances. This task completes the feature by adding:
1. Quick "Settle All" action buttons to mark all pending shares with a person as paid
2. "Send Reminder" button for people who owe you money
3. Payment history showing when settlements occurred

## Architecture Decision

**Approach**: Extend the existing `SettlementSummary` component with action buttons and add a new `settleAllWithUserAction` server action. This follows existing patterns from `SharedExpensesList` component which already has similar action handling.

**Why this approach**:
- Minimizes changes - builds on existing infrastructure
- Follows established patterns (action buttons, useTransition, toast feedback)
- No schema changes needed - `paidAt` field already exists in ExpenseParticipant

---

## Step 1: Add `settleAllWithUserSchema` to schemas

**Goal**: Create Zod validation schema for the new action

**Files to modify**:
- `src/schemas/index.ts` - Add new schema and type export

**Implementation**:
- Add `settleAllWithUserSchema` with `targetUserId`, `currency`, and `csrfToken` fields
- Export `SettleAllWithUserInput` type
- Place after `markSharePaidSchema` for logical grouping

---

## Step 2: Create `settleAllWithUserAction` server action

**Goal**: Mark all PENDING expenses with a specific user as PAID in a single operation

**Files to modify**:
- `src/app/actions/expense-sharing.ts` - Add new action

**Implementation**:
1. Follow standard action pipeline (parse, CSRF, subscription, auth)
2. Find all PENDING ExpenseParticipants where:
   - The current user owns the expense AND participant is targetUserId, OR
   - The current user is targetUserId (for expenses shared with them)
3. Filter by currency to match the settlement balance row
4. Update all matching participants to PAID with `paidAt: new Date()`
5. Return count of settled expenses
6. Revalidate cache

**Security**:
- Only settle expenses the user has authority over
- CSRF protection
- Subscription check

---

## Step 3: Export new action from actions barrel

**Goal**: Make the action available for import

**Files to modify**:
- `src/app/actions.ts` - Add export

**Implementation**:
- Add `settleAllWithUserAction` to exports

---

## Step 4: Update SettlementSummary component with actions

**Goal**: Add interactive Settle All and Send Reminder buttons to each person row

**Files to modify**:
- `src/components/dashboard/settlement-summary.tsx` - Add action buttons and handlers

**Implementation**:
1. Add 'use client' (already present)
2. Import hooks: `useTransition`, `useRouter`, `useCsrfToken`
3. Import actions: `settleAllWithUserAction`, `sendPaymentReminderAction`
4. Import icons: `Check`, `Bell` from lucide-react
5. Import toast and Button component
6. Add state and handlers:
   - `handleSettleAll(userId, currency)` - calls settleAllWithUserAction
   - `handleSendReminder(userId)` - sends reminder for pending amounts
7. Update each person row to show action buttons:
   - If they owe you (netBalance > 0): Show "Remind" button
   - If you owe them (netBalance < 0): Show "Settle" button
   - If settled (netBalance = 0): Show checkmark, no buttons

**UI Changes**:
- Add button container to the right of each person's balance
- Use same button styling as SharedExpensesList (ghost variant, colored icons)
- Show loading state when action is pending

---

## Step 5: Add payment history section

**Goal**: Show recent payment activity (last 10 settlements)

**Files to modify**:
- `src/lib/finance/expense-sharing.ts` - Add `getPaymentHistory` function
- `src/lib/finance/types.ts` - Add `PaymentHistoryItem` type
- `src/lib/finance/index.ts` - Export new function and type

**Implementation**:
1. Create `PaymentHistoryItem` type with: participantId, userDisplayName, userEmail, amount, currency, paidAt, direction ('paid'|'received')
2. Create `getPaymentHistory(userId, limit = 10)` function:
   - Query ExpenseParticipants where status = PAID and paidAt not null
   - Include both where user is owner (received) and participant (paid)
   - Order by paidAt DESC, limit results
3. Add optional `paymentHistory` prop to SettlementSummary
4. Display collapsible "Recent Activity" section at bottom

---

## Step 6: Update dashboard data fetching

**Goal**: Include payment history in dashboard data

**Files to modify**:
- `src/lib/finance/dashboard.ts` - Add getPaymentHistory call
- `src/lib/finance/types.ts` - Add paymentHistory to DashboardData type

**Implementation**:
- Add `getPaymentHistory(userId)` to Promise.all in getDashboardData
- Add `paymentHistory?: PaymentHistoryItem[]` to DashboardData type

---

## Step 7: Update SharingTab to pass new props

**Goal**: Wire up payment history prop

**Files to modify**:
- `src/components/dashboard/tabs/sharing-tab.tsx` - Pass paymentHistory prop

**Implementation**:
- Add paymentHistory from dashboardData to SettlementSummary props

---

## Step 8: Add unit tests for new action

**Goal**: 90%+ test coverage for settleAllWithUserAction

**Files to modify**:
- `tests/expense-sharing-actions.test.ts` - Add test cases

**Test cases**:
1. Success: Settles all pending expenses with target user
2. Error: Invalid CSRF token
3. Error: No active subscription
4. Error: Target user not found in any pending expenses
5. Success: Only settles for specified currency
6. Success: Returns count of settled expenses

---

## Step 9: Add unit tests for payment history

**Goal**: Test getPaymentHistory function

**Files to create**:
- `tests/expense-sharing-finance.test.ts` - New test file for finance functions

**Test cases**:
1. Returns payment history ordered by date
2. Includes both paid and received directions
3. Respects limit parameter
4. Returns empty array when no history

---

## Critical Paths

**High Risk**: None - building on proven patterns

**Needs Review**:
- `settleAllWithUserAction` - bulk update logic needs careful testing
- Currency filtering - must match exact currency to avoid cross-currency issues

**Performance**:
- Payment history query should use index on `paidAt`
- Limited to 10 items by default

**Security**:
- All actions protected by CSRF
- Subscription check required
- Authorization: users can only settle their own expenses

---

## Complexity Assessment

**Overall**: Medium
**Confidence**: High
**Reasoning**: All patterns are established in the codebase. This is feature completion, not new architecture. The main complexity is the bulk settle action which requires careful handling of the bi-directional ownership (user as owner vs user as participant).

---

## Files Summary

**Modified files**:
1. `src/schemas/index.ts` - Add settleAllWithUserSchema
2. `src/app/actions/expense-sharing.ts` - Add settleAllWithUserAction
3. `src/app/actions.ts` - Export new action
4. `src/components/dashboard/settlement-summary.tsx` - Add action buttons & payment history UI
5. `src/lib/finance/expense-sharing.ts` - Add getPaymentHistory
6. `src/lib/finance/types.ts` - Add PaymentHistoryItem type
7. `src/lib/finance/index.ts` - Export new function & type
8. `src/lib/finance/dashboard.ts` - Include payment history in data fetch
9. `src/components/dashboard/tabs/sharing-tab.tsx` - Pass paymentHistory prop
10. `tests/expense-sharing-actions.test.ts` - Add action tests

**New files**:
1. `tests/expense-sharing-finance.test.ts` - Tests for getPaymentHistory

---

## Acceptance Criteria

1. Each person row in settlement summary shows appropriate action button:
   - "Remind" button when they owe you
   - "Settle" button when you owe them
2. Clicking "Settle All" marks all pending expenses with that person as paid
3. Toast feedback confirms action success/failure
4. Payment history section shows recent settlements
5. All tests pass with 90%+ coverage
6. No TypeScript errors
7. Build succeeds
