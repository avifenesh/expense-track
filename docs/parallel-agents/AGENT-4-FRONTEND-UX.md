# Agent 4: Frontend & UX

## Overview

You are one of 4 parallel agents working on tech debt. Your focus is **Frontend & UX** - React components, hooks, accessibility, and performance optimizations in the UI layer.

**Your worktree branch**: `tech-debt/agent-4-frontend`
**Your scope**: `src/components/*`, `src/hooks/*`

## Parallel Agent Awareness

Three other agents are working simultaneously:
- **Agent 1** (Security & DevOps): Working in `tech-debt/agent-1-security` - touches `.github/*`, security-related lib files
- **Agent 2** (Test Quality): Working in `tech-debt/agent-2-tests` - touches `tests/*` only
- **Agent 3** (Backend Architecture): Working in `tech-debt/agent-3-backend` - touches `src/lib/*`, `src/app/actions/*`, `prisma/*`

**Collision avoidance**: Your files (`src/components/*`, `src/hooks/*`) don't overlap with other agents. You can safely work independently.

## Setup

```bash
# Create worktree from main
git worktree add ../expense-track-agent-4 -b tech-debt/agent-4-frontend origin/main
cd ../expense-track-agent-4
npm install
```

## Rules

1. **Follow CLAUDE.md** - Read and follow all project conventions
2. **PR Review Protocol** - Every PR gets reviewed by 4 agents (Copilot, Claude, Gemini, Codex). Wait 3 minutes, address ALL comments, iterate until clean
3. **Pull main regularly** - Before starting each session and before creating PR: `git fetch origin main && git rebase origin/main`
4. **Reference main doc** - Full issue details in `TECHNICAL_DEBT.md`
5. **Mobile-first** - Primary users are on mid-range Android with unstable internet
6. **Accessibility** - Follow WCAG guidelines, proper ARIA attributes

---

## Session 1: Dashboard & Forms (PR #1)

**Branch**: `tech-debt/agent-4-frontend-session-1`

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| High | Keyboard navigation missing on settings menu | `src/components/dashboard/dashboard-page.tsx:341-400` | Add focus trap and arrow key navigation |
| Medium | Modal backdrop clickable during submission | `src/components/dashboard/share-expense-form.tsx:156-313` | Add pointer-events-none when pending |
| Medium | CSRF token fetch failure not handled | `src/hooks/useCsrfToken.ts` | Track loading/error state, show toast |
| Medium | PropDrilling in dashboard tabs | `src/components/dashboard/dashboard-page.tsx:561-631` | Create DashboardContext |
| Medium | Modal focus not trapped | `src/components/settings/delete-account-dialog.tsx` | Add focus trap useEffect |
| Medium | Settings menu can overflow viewport | `src/components/dashboard/dashboard-page.tsx:341-402` | Add position management |

### Implementation Guide

1. **Settings Menu Keyboard Navigation** (`dashboard-page.tsx:341-400`)

   ```typescript
   // Add keyboard handler
   const handleMenuKeyDown = (e: KeyboardEvent) => {
     const items = menuRef.current?.querySelectorAll('[role="menuitem"]')
     if (!items) return

     switch (e.key) {
       case 'ArrowDown':
         e.preventDefault()
         focusNextItem(items, currentIndex)
         break
       case 'ArrowUp':
         e.preventDefault()
         focusPrevItem(items, currentIndex)
         break
       case 'Escape':
         closeMenu()
         break
       case 'Tab':
         closeMenu()
         break
     }
   }

   // Add focus trap
   useEffect(() => {
     if (isMenuOpen) {
       const firstItem = menuRef.current?.querySelector('[role="menuitem"]')
       firstItem?.focus()
     }
   }, [isMenuOpen])
   ```

2. **Modal Backdrop Fix** (`share-expense-form.tsx`)

   ```tsx
   <div
     className={cn(
       "fixed inset-0 bg-black/50",
       isPending && "pointer-events-none"
     )}
     onClick={!isPending ? onClose : undefined}
   />
   ```

3. **CSRF Token Error Handling** (`useCsrfToken.ts`)

   ```typescript
   export function useCsrfToken() {
     const [token, setToken] = useState<string | null>(null)
     const [isLoading, setIsLoading] = useState(true)
     const [error, setError] = useState<Error | null>(null)

     useEffect(() => {
       fetchCsrfToken()
         .then(setToken)
         .catch((err) => {
           setError(err)
           toast.error('Failed to load security token. Please refresh.')
         })
         .finally(() => setIsLoading(false))
     }, [])

     return { token, isLoading, error }
   }
   ```

4. **Dashboard Context** (new file: `src/components/dashboard/dashboard-context.tsx`)

   ```typescript
   interface DashboardContextValue {
     selectedAccount: Account | null
     setSelectedAccount: (account: Account) => void
     selectedMonth: string
     setSelectedMonth: (month: string) => void
     refreshData: () => Promise<void>
     // ... other shared state
   }

   export const DashboardContext = createContext<DashboardContextValue | null>(null)

   export function useDashboard() {
     const ctx = useContext(DashboardContext)
     if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
     return ctx
   }
   ```

5. **Modal Focus Trap** (`delete-account-dialog.tsx`)

   ```typescript
   useEffect(() => {
     if (!isOpen) return

     const dialog = dialogRef.current
     const focusableElements = dialog?.querySelectorAll(
       'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
     )
     const firstElement = focusableElements?.[0] as HTMLElement
     const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement

     const handleTab = (e: KeyboardEvent) => {
       if (e.key !== 'Tab') return

       if (e.shiftKey && document.activeElement === firstElement) {
         e.preventDefault()
         lastElement?.focus()
       } else if (!e.shiftKey && document.activeElement === lastElement) {
         e.preventDefault()
         firstElement?.focus()
       }
     }

     document.addEventListener('keydown', handleTab)
     firstElement?.focus()

     return () => document.removeEventListener('keydown', handleTab)
   }, [isOpen])
   ```

6. **Settings Menu Overflow** (`dashboard-page.tsx:341-402`)

   ```typescript
   // Calculate position to keep menu in viewport
   const calculateMenuPosition = useCallback(() => {
     if (!buttonRef.current || !menuRef.current) return

     const buttonRect = buttonRef.current.getBoundingClientRect()
     const menuRect = menuRef.current.getBoundingClientRect()
     const viewportHeight = window.innerHeight

     // If menu would overflow bottom, position above button
     if (buttonRect.bottom + menuRect.height > viewportHeight) {
       setMenuPosition({ bottom: viewportHeight - buttonRect.top })
     } else {
       setMenuPosition({ top: buttonRect.bottom })
     }
   }, [])
   ```

### PR Checklist

- [ ] All issues from this session fixed
- [ ] Tests pass: `npm test`
- [ ] Type check passes: `npm run check-types`
- [ ] Manual testing: keyboard navigation works, focus traps work
- [ ] Accessibility: test with screen reader or axe DevTools
- [ ] Rebased on latest main
- [ ] PR created with clear description
- [ ] Waited 3+ minutes for reviewer comments
- [ ] Addressed ALL reviewer comments

---

## Session 2: Performance & Polish (PR #2)

**Branch**: `tech-debt/agent-4-frontend-session-2`

**Prerequisite**: Session 1 PR merged to main. Pull latest main before starting.

### Issues to Fix

| Level | Issue | File | Fix |
|-------|-------|------|-----|
| Medium | React settings menu re-adds event listener | `src/components/dashboard/dashboard-page.tsx:193-203` | Use useCallback for stable handler |
| Medium | Holdings tab refetches on currency change | `src/components/dashboard/holdings-tab.tsx:54-97` | Remove preferredCurrency from loadHoldings deps |
| Medium | Optimistic updates use router.refresh | `src/components/dashboard/tabs/transactions-tab.tsx:360-377` | Use rollback() instead |
| Low | Holdings delete button no loading state | `src/components/dashboard/holdings-tab.tsx:138-155` | Pass disabled={isPendingAction} |
| Low | No loading skeleton for transaction form | `src/components/dashboard/tabs/transactions-tab.tsx:407-609` | Add isLoading placeholder |
| Low | useOptimisticList no unmount cleanup | `src/hooks/useOptimisticList.ts` | Track mounted ref |
| Low | Tab panel missing aria-controls | `src/components/dashboard/tabs/transactions-tab.tsx:402` | Add aria-controls to tab buttons |
| Low | Refresh button icon doesn't animate | `src/components/dashboard/dashboard-page.tsx:526-547` | Add animate-spin when pending |

### Implementation Guide

1. **Stable Event Handler** (`dashboard-page.tsx:193-203`)

   ```typescript
   // Before: handler recreated on every render
   useEffect(() => {
     const handler = () => { ... }
     window.addEventListener('click', handler)
     return () => window.removeEventListener('click', handler)
   })

   // After: stable handler with useCallback
   const handleClickOutside = useCallback((e: MouseEvent) => {
     if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
       setIsMenuOpen(false)
     }
   }, [])

   useEffect(() => {
     window.addEventListener('click', handleClickOutside)
     return () => window.removeEventListener('click', handleClickOutside)
   }, [handleClickOutside])
   ```

2. **Fix Holdings Refetch** (`holdings-tab.tsx:54-97`)

   ```typescript
   // Remove preferredCurrency from deps - it's only for display
   const loadHoldings = useCallback(async () => {
     const data = await fetchHoldings(accountId)
     setHoldings(data)
   }, [accountId]) // preferredCurrency not needed here

   // Format currency in render, not in data fetch
   const formattedValue = formatCurrency(holding.value, preferredCurrency)
   ```

3. **Fix Optimistic Rollback** (`transactions-tab.tsx:360-377`)

   ```typescript
   // Before: router.refresh() on error
   // After: use rollback from optimistic hook
   const handleDelete = async (id: string) => {
     const rollback = optimisticRemove(id)
     try {
       const result = await deleteTransaction({ id, csrfToken })
       if ('error' in result) {
         rollback() // Restore item on error
         toast.error(result.error.general?.[0] || 'Delete failed')
       }
     } catch {
       rollback()
       toast.error('Network error')
     }
   }
   ```

4. **Holdings Delete Loading State** (`holdings-tab.tsx:138-155`)

   ```tsx
   <Button
     variant="ghost"
     size="sm"
     onClick={() => handleDelete(holding.id)}
     disabled={isPendingAction || deletingId === holding.id}
   >
     {deletingId === holding.id ? (
       <Loader2 className="h-4 w-4 animate-spin" />
     ) : (
       <Trash2 className="h-4 w-4" />
     )}
   </Button>
   ```

5. **Transaction Form Skeleton** (`transactions-tab.tsx:407-609`)

   ```tsx
   {isLoadingCategories ? (
     <div className="space-y-4">
       <Skeleton className="h-10 w-full" />
       <Skeleton className="h-10 w-full" />
       <Skeleton className="h-10 w-1/2" />
     </div>
   ) : (
     <TransactionForm ... />
   )}
   ```

6. **Unmount Cleanup** (`useOptimisticList.ts`)

   ```typescript
   export function useOptimisticList<T>(initialItems: T[]) {
     const [items, setItems] = useState(initialItems)
     const mountedRef = useRef(true)

     useEffect(() => {
       return () => { mountedRef.current = false }
     }, [])

     const safeSetItems = useCallback((updater: SetStateAction<T[]>) => {
       if (mountedRef.current) {
         setItems(updater)
       }
     }, [])

     // Use safeSetItems in all operations
   }
   ```

7. **ARIA Controls** (`transactions-tab.tsx:402`)

   ```tsx
   <button
     role="tab"
     aria-selected={activeTab === 'transactions'}
     aria-controls="transactions-panel"
     id="transactions-tab"
   >
     Transactions
   </button>

   <div
     role="tabpanel"
     id="transactions-panel"
     aria-labelledby="transactions-tab"
   >
     {/* Tab content */}
   </div>
   ```

8. **Refresh Button Animation** (`dashboard-page.tsx:526-547`)

   ```tsx
   <Button
     variant="ghost"
     size="sm"
     onClick={handleRefresh}
     disabled={isRefreshing}
   >
     <RefreshCw
       className={cn(
         "h-4 w-4",
         isRefreshing && "animate-spin"
       )}
     />
   </Button>
   ```

### PR Checklist

- [ ] Session 1 PR merged
- [ ] Rebased on latest main
- [ ] All issues from this session fixed
- [ ] Tests pass
- [ ] Manual testing: animations, loading states work
- [ ] Accessibility audit passes
- [ ] PR created and reviewed
- [ ] All reviewer comments addressed

---

## Files You Own (Complete Isolation)

```
src/components/dashboard/dashboard-page.tsx
src/components/dashboard/dashboard-context.tsx (new)
src/components/dashboard/holdings-tab.tsx
src/components/dashboard/tabs/transactions-tab.tsx
src/components/dashboard/share-expense-form.tsx
src/components/settings/delete-account-dialog.tsx
src/hooks/useCsrfToken.ts
src/hooks/useOptimisticList.ts
```

## Coordination Notes

- You have clean isolation - no other agent modifies component or hook files
- Agent 3 may change the shape of data returned from actions - pull main between sessions
- If Agent 3 creates new error types, update components to handle them appropriately
- Focus on user experience - loading states, error handling, accessibility
