# Multi-Currency Feature Test Checklist

## Test Environment
- **URL**: https://expense-track-git-develop-avi-feneshs-projects.vercel.app/?_vercel_share=zdHoSYUbTMTYgo10qfgRhm6HslguQjyV
- **Expires**: Oct 6, 2025, 1:21 PM
- **Database**: Neon develop branch (`br-icy-cell-afr9226h`)

## User Credentials
- **Avi**: `aviarchi1994@gmail.com` / `Af!@#$56789` (Preferred: ILS ₪)
- **Serena**: `serena.bianchi@hotmail.it` / `A76v38i61_7` (Preferred: EUR €)

---

## 1. Authentication & User Preferences

### Test as Avi (ILS Preference)
- [ ] Login with Avi's credentials
- [ ] Verify dashboard loads successfully
- [ ] **Critical**: All amounts should display in ₪ (Shekel), not $
- [ ] Verify account selector shows "Avi" and "Joint"
- [ ] Sign out

### Test as Serena (EUR Preference)
- [ ] Login with Serena's credentials
- [ ] Verify dashboard loads successfully
- [ ] **Critical**: All amounts should display in € (Euro), not $
- [ ] Verify account selector shows "Serena" and "Joint"
- [ ] Sign out

---

## 2. Transaction Form - Currency Selector

### Create Transaction in Different Currencies
- [ ] Login as Avi
- [ ] Navigate to "Transactions" tab
- [ ] Click "Log a transaction" form
- [ ] Verify currency dropdown is visible
- [ ] Verify currency options show: "$ USD", "€ EUR", "₪ ILS"
- [ ] Default currency should be USD

### Test Transaction Creation
- [ ] Select Type: Expense
- [ ] Select Account: Avi
- [ ] Select Category: (any expense category)
- [ ] Enter Amount: 100
- [ ] **Select Currency: EUR** (€)
- [ ] Select today's date
- [ ] Add description: "Test EUR transaction"
- [ ] Click "Save transaction"
- [ ] Verify success message
- [ ] Verify transaction appears in recent activity

### Verify Currency Conversion Display
- [ ] Find the newly created transaction (100 EUR)
- [ ] **Expected**: Should show converted amount in ILS (Avi's preference)
- [ ] **Expected**: Should show original amount: "€100" or dual display format
- [ ] Calculate: 100 EUR ≈ 400-450 ILS (verify reasonable conversion)

---

## 3. Budget Form - Currency Selector

### Create Budget in Different Currency
- [ ] Navigate to "Budgets" tab
- [ ] Scroll to "Add or update a budget" form
- [ ] Verify currency dropdown is visible
- [ ] Select Account: Avi
- [ ] Select Category: (any expense category)
- [ ] Enter Planned amount: 500
- [ ] **Select Currency: USD** ($)
- [ ] Click "Save budget"
- [ ] Verify budget appears in list

### Verify Budget Display
- [ ] Find the newly created budget (500 USD)
- [ ] **Expected**: Should show in ILS if converted, or show original currency
- [ ] Verify budget progress bar works correctly

---

## 4. Recurring Template - Currency Selector

### Create Recurring Template
- [ ] Navigate to "Recurring" tab
- [ ] Scroll to recurring template form
- [ ] Verify currency dropdown is visible
- [ ] Select Type: Expense
- [ ] Select Account: Avi
- [ ] Select Category: (any category)
- [ ] Enter Amount: 50
- [ ] **Select Currency: ILS** (₪)
- [ ] Enter Day of month: 1
- [ ] Enter Description: "Test recurring ILS"
- [ ] Click "Save recurring template"
- [ ] Verify template appears in list

### Apply Recurring Template
- [ ] Find the newly created template
- [ ] Verify it shows correct currency symbol
- [ ] Click "Apply for this month" (if available)
- [ ] Verify transaction is created with correct currency

---

## 5. Exchange Rate Refresh

### Test Refresh Functionality
- [ ] Login as Avi
- [ ] Locate "Update rates" button in dashboard header
- [ ] Verify button shows RefreshCcw icon
- [ ] Check current "Last updated" timestamp
- [ ] Click "Update rates" button
- [ ] Verify button shows loading state
- [ ] Wait for completion
- [ ] Verify "Last updated" timestamp changes to current time
- [ ] Verify format: "MMM DD, HH:MM"

### Verify Exchange Rates Update
- [ ] Create a test transaction in EUR before refresh
- [ ] Note the converted ILS amount
- [ ] Click "Update rates"
- [ ] Create another test transaction in EUR after refresh
- [ ] Compare converted amounts (should be similar unless rates changed significantly)

---

## 6. Dashboard Statistics

### Verify All Stats Use Preferred Currency
- [ ] Login as Avi
- [ ] Check top stats cards:
  - [ ] "Actual net" - should show ₪
  - [ ] "Projected end of month" - should show ₪
  - [ ] "Remaining budgets" - should show ₪
  - [ ] "Planned net" - should show ₪
- [ ] Check cashflow snapshot:
  - [ ] "Income this month" - should show ₪
  - [ ] "Spending this month" - should show ₪
  - [ ] "Change vs last month" - should show ₪

### Test with Serena
- [ ] Logout and login as Serena
- [ ] Verify all stats show € (Euro)
- [ ] Verify no $ (Dollar) symbols appear

---

## 7. Multi-Currency Transaction List

### Verify Transaction Display
- [ ] Create transactions in all three currencies:
  - [ ] 100 USD transaction
  - [ ] 50 EUR transaction
  - [ ] 200 ILS transaction
- [ ] Navigate to transaction list
- [ ] For each transaction, verify:
  - [ ] Amount displays in user's preferred currency (ILS for Avi)
  - [ ] Original currency is shown (if different)
  - [ ] Dual format like: "₪365 (€100)" or similar

---

## 8. Edge Cases & Error Handling

### Test Without Exchange Rates
- [ ] Check if exchange rates exist in database
- [ ] If not, verify graceful fallback behavior
- [ ] Transactions should still create successfully
- [ ] Error messages should be user-friendly

### Test Invalid Currency
- [ ] Try creating transaction without selecting currency (should default to USD)
- [ ] Verify form validation works

### Test Stale Exchange Rates
- [ ] Check "Last updated" timestamp
- [ ] If older than 24 hours, verify warning or indicator
- [ ] Refresh rates and verify update

---

## 9. UI/UX Verification

### Form Design
- [ ] Currency selectors match design system (glassmorphism)
- [ ] Rounded-full styling on selects
- [ ] Translucent background on inputs
- [ ] Proper focus states on currency dropdowns
- [ ] Currency symbols display correctly in options

### Responsive Design
- [ ] Test on mobile viewport (narrow screen)
- [ ] Currency selectors should be readable
- [ ] Forms should remain usable
- [ ] Refresh button accessible on mobile

### Accessibility
- [ ] Currency selectors have proper labels
- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] ARIA labels present on refresh button

---

## 10. Performance & Data Integrity

### Database Verification
- [ ] Check that transactions save with correct currency in database
- [ ] Verify exchange rates are cached (check ExchangeRate table)
- [ ] Confirm conversion calculations are accurate
- [ ] Test concurrent currency operations don't cause conflicts

### API Integration
- [ ] Refresh rates calls Frankfurter API
- [ ] Verify API response includes all three currencies
- [ ] Check rate caching works (shouldn't call API on every page load)
- [ ] Verify 24-hour TTL is respected

---

## Expected Results Summary

✅ **Avi should see everything in ILS (₪)**
✅ **Serena should see everything in EUR (€)**
✅ **Currency selectors work in all forms**
✅ **Exchange rates refresh on demand**
✅ **Original currency preserved in dual display**
✅ **No $ symbols for Avi/Serena (unless explicitly USD transaction)**

---

## Known Issues to Fix

❌ **BUG**: All amounts currently show in $ instead of user's preferred currency
- Root cause: formatCurrency calls need to use displayCurrency/preferredCurrency
- Affected areas: Stats cards, transaction list, budget display
- Priority: **HIGH** - Core feature not working as expected

---

## Regression Testing

After fixing currency display bug:
- [ ] Re-test all items above
- [ ] Verify no $ symbols for Avi (should be ₪)
- [ ] Verify no $ symbols for Serena (should be €)
- [ ] Verify existing transactions still display correctly
- [ ] Check that Joint account respects active user's preference
