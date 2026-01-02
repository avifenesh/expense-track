# Track Plan: Simplified Partner Sync

## Phase 1: Database & Backend Refactor
- [ ] Task: Remove JOINT account type and update Prisma schema
    - [ ] Sub-task: Write migration to remove JOINT type (handle data migration/deletion policy)
    - [ ] Sub-task: Update `AccountType` enum in `schema.prisma`
    - [ ] Sub-task: Run migration
- [ ] Task: Implement Transaction Request Schema
    - [ ] Sub-task: Add `TransactionRequest` model or update `Transaction` with status
    - [ ] Sub-task: Generate and run migration
- [ ] Task: Backend Actions for Requests
    - [ ] Sub-task: Write Tests for `createTransactionRequest`
    - [ ] Sub-task: Implement `createTransactionRequest` server action
    - [ ] Sub-task: Write Tests for `approveTransactionRequest`
    - [ ] Sub-task: Implement `approveTransactionRequest` server action
    - [ ] Sub-task: Write Tests for `rejectTransactionRequest`
    - [ ] Sub-task: Implement `rejectTransactionRequest` server action
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Database & Backend Refactor' (Protocol in workflow.md)

## Phase 2: Frontend Dashboard Update
- [ ] Task: Remove Joint View from Dashboard
    - [ ] Sub-task: Remove "Joint" tab from `dashboard-page.tsx`
    - [ ] Sub-task: Update `dashboard-ux.ts` to handle only 2 accounts
- [ ] Task: Implement "Inbox" for Requests
    - [ ] Sub-task: Create `RequestList` component
    - [ ] Sub-task: Implement Approve/Reject UI interactions
    - [ ] Sub-task: Write component tests
- [ ] Task: Update Transaction Creation Form
    - [ ] Sub-task: Add "Request from Partner" toggle
    - [ ] Sub-task: Wire up form to new `createTransactionRequest` action
    - [ ] Sub-task: Write E2E test for full request flow
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Frontend Dashboard Update' (Protocol in workflow.md)

## Phase 3: Cleanup & Polish
- [ ] Task: Remove legacy Joint account code
    - [ ] Sub-task: Search and remove dead code related to "Joint"
- [ ] Task: Final E2E Verification
    - [ ] Sub-task: Run full regression suite
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Cleanup & Polish' (Protocol in workflow.md)

