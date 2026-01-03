# Track Plan: Simplified Partner Sync

## Phase 1: Database & Backend Refactor [checkpoint: 467b65f]
- [x] Task: Remove JOINT account type and update Prisma schema (33a1655)
    - [x] Sub-task: Write migration to remove JOINT type (handle data migration/deletion policy)
    - [x] Sub-task: Update `AccountType` enum in `schema.prisma`
    - [x] Sub-task: Run migration
- [x] Task: Implement Transaction Request Schema (33a1655)
    - [x] Sub-task: Add `TransactionRequest` model or update `Transaction` with status
    - [x] Sub-task: Generate and run migration
- [x] Task: Backend Actions for Requests (938e83e)
    - [x] Sub-task: Write Tests for `createTransactionRequest`
    - [x] Sub-task: Implement `createTransactionRequest` server action
    - [x] Sub-task: Write Tests for `approveTransactionRequest`
    - [x] Sub-task: Implement `approveTransactionRequest` server action
    - [x] Sub-task: Write Tests for `rejectTransactionRequest`
    - [x] Sub-task: Implement `rejectTransactionRequest` server action
- [x] Task: Conductor - User Manual Verification 'Phase 1: Database & Backend Refactor' (Protocol in workflow.md) (467b65f)

## Phase 2: Frontend Dashboard Update [checkpoint: c1b4640]
- [x] Task: Remove Joint View from Dashboard (938e83e+)
    - [x] Sub-task: Remove "Joint" tab from `dashboard-page.tsx`
    - [x] Sub-task: Update `dashboard-ux.ts` to handle only 2 accounts
- [x] Task: Implement "Inbox" for Requests (e7df4ed+)
    - [x] Sub-task: Create `RequestList` component
    - [x] Sub-task: Implement Approve/Reject UI interactions
    - [x] Sub-task: Write component tests
- [x] Task: Update Transaction Creation Form (b8f92f2+)
    - [x] Sub-task: Add "Request from Partner" toggle
    - [x] Sub-task: Wire up form to new `createTransactionRequestAction` action
    - [x] Sub-task: Write E2E test for full request flow
- [x] Task: Conductor - User Manual Verification 'Phase 2: Frontend Dashboard Update' (Protocol in workflow.md) (c1b4640)

## Phase 3: Cleanup & Polish
- [x] Task: Remove legacy Joint account code (425e7ea+)
    - [x] Sub-task: Search and remove dead code related to "Joint"
- [ ] Task: Final E2E Verification
    - [ ] Sub-task: Run full regression suite
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Cleanup & Polish' (Protocol in workflow.md)

