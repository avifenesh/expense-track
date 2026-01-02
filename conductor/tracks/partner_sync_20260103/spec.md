# Track Specification: Simplified Partner Sync

## Goal
Simplify the application for non-technical users by removing the "Joint" account concept and moving to a 2-partner synced model. Enable a "Request Transaction" flow where one partner can log an expense that the other partner must approve/reimburse.

## Core Changes
1.  **Remove "Joint" Account Type:**
    -   Deprecate/Remove `AccountType.JOINT`.
    -   Ensure only `SELF` and `PARTNER` types exist (or strictly 2 accounts per "household").
2.  **Synced Partner Accounts:**
    -   Ensure clear visibility of the other partner's relevant transactions.
3.  **Request Transaction Flow:**
    -   New transaction type or flag for "Pending Approval" / "Reimbursement Request".
    -   UI for Partner A to create a request.
    -   UI for Partner B to approve (turns into expense) or reject.

## Detailed Requirements

### 1. Database Schema Updates
-   Modify `AccountType` enum to remove `JOINT`.
-   Add support for "Transaction Requests" - possibly a new model `TransactionRequest` or a status field on `Transaction` (e.g., `status: PENDING | APPROVED | REJECTED`).
-   Update `Account` model if necessary to strictly link two partners.

### 2. Backend Logic
-   **API/Action:** `createTransactionRequest`
    -   Input: Amount, Description, Category, Date.
    -   Logic: Creates a record visible to the partner as a "Request".
-   **API/Action:** `approveTransactionRequest`
    -   Input: RequestID.
    -   Logic: Converts request to a standard Transaction on the approver's account.
-   **API/Action:** `rejectTransactionRequest`
    -   Input: RequestID.
    -   Logic: Marks request as rejected or deletes it.

### 3. Frontend / UI
-   **Dashboard:**
    -   Remove "Joint" tab/filter.
    -   Show "Partner" tab clearly.
-   **New Component: "Action Center" or "Inbox":**
    -   Display incoming transaction requests from partner.
    -   Buttons for "Approve" and "Reject".
-   **Create Transaction Form:**
    -   Add toggle/mode: "Log for Me" vs "Request from Partner".

## User Experience
-   **Initiator:** "I bought groceries for us, I need you to record this." -> Selects "Request from Partner".
-   **Receiver:** Sees notification/item in Inbox. "Oh right, groceries." -> Clicks "Approve". -> Transaction added to Receiver's ledger (or synced ledger).


