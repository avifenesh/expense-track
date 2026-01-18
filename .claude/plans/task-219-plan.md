# Implementation Plan: Wire Onboarding Screens to onboardingStore

**Task**: #219 - Wire onboarding screens to onboardingStore  
**Complexity**: High  
**Estimated Steps**: 8 major steps  
**Confidence Level**: High

## Overview

This task wires the 5 onboarding screens to a new Zustand store and creates the necessary REST API endpoints. Currently, screens are static mockups with no state management. The server actions exist but REST endpoints do not.

**Architecture Decision**: Create REST API endpoints wrapping existing server actions rather than duplicating logic. This ensures mobile and web use the same validated business logic while maintaining the JWT authentication pattern used by other mobile endpoints.

## Critical Dependencies

**BLOCKER**: Issues #198-203 describe the REST endpoints that should be created, but those issues may not have been implemented yet. This plan creates those endpoints as part of this task.

**Existing Server Actions** (src/app/actions/onboarding.ts):
- updatePreferredCurrencyAction() - Updates user.preferredCurrency
- createInitialCategoriesAction() - Bulk creates categories
- createQuickBudgetAction() - Creates budget for account/category/month
- seedSampleDataAction() - Creates sample transactions, categories, budgets
- completeOnboardingAction() - Sets user.hasCompletedOnboarding = true
- skipOnboardingAction() - Also sets hasCompletedOnboarding = true

## Step 1: Create REST API Endpoints

**Goal**: Create 6 REST API endpoints that wrap existing server actions with JWT authentication.

**Files to create**:
1. src/app/api/v1/onboarding/complete/route.ts - POST endpoint
2. src/app/api/v1/users/me/currency/route.ts - PATCH endpoint
3. src/app/api/v1/categories/bulk/route.ts - POST endpoint
4. src/app/api/v1/budgets/quick/route.ts - POST endpoint
5. src/app/api/v1/seed-data/route.ts - POST endpoint

**Implementation Pattern**:
Each endpoint follows JWT auth + rate limiting + validation pattern used by existing mobile endpoints.

**Risks**: 
- Server actions require subscription check via requireActiveSubscription(), but mobile users may not have subscriptions set up yet during onboarding
- May need to skip subscription checks for onboarding endpoints

**Validation**:
- Use existing schemas from src/schemas/onboarding.ts
- Omit csrfToken field for API versions (JWT auth instead)

## Step 2: Create Onboarding Store

**Goal**: Create Zustand store to manage onboarding state across 5 screens.

**File to create**: mobile/src/stores/onboardingStore.ts

**State shape**:
- selectedCurrency: Currency (default: USD)
- selectedCategories: string[] (category names)
- monthlyBudget: number | null (null = skipped)
- wantsSampleData: boolean (default: false)
- isCompleting: boolean (true during API orchestration)
- error: string | null

**Actions**:
- setCurrency(currency: Currency)
- toggleCategory(name: string)
- setBudget(amount: number | null)
- setSampleData(wants: boolean)
- completeOnboarding() - orchestrates all API calls
- reset()

**completeOnboarding() flow**:
1. PATCH /users/me/currency with selectedCurrency
2. POST /categories/bulk with selectedCategories
3. POST /budgets/quick if monthlyBudget \!== null (fetch first account ID)
4. POST /seed-data if wantsSampleData === true
5. POST /onboarding/complete to set hasCompletedOnboarding
6. Update authStore user state
7. On error, set error and throw

**Critical Decision**: Where to get accountId for budget?
- Recommendation: Fetch user first account in completeOnboarding() since budget is optional

**Risks**: Sequential API calls mean partial completion on error

## Step 3: Export Store from Index

**Goal**: Add onboardingStore to store exports.

**File to modify**: mobile/src/stores/index.ts

**Changes**: Add export statements following existing pattern

## Step 4: Wire CurrencyScreen to Store

**Goal**: Connect OnboardingCurrencyScreen to read/write store state.

**File to modify**: mobile/src/screens/onboarding/OnboardingCurrencyScreen.tsx

**Changes**:
1. Import useOnboardingStore and Currency type
2. Read selectedCurrency from store
3. Call setCurrency(currency) when option is pressed
4. Apply optionSelected style based on selectedCurrency

**Risks**: None - straightforward state binding

## Step 5: Wire CategoriesScreen to Store

**Goal**: Connect OnboardingCategoriesScreen to toggle category selection.

**File to modify**: mobile/src/screens/onboarding/OnboardingCategoriesScreen.tsx

**Changes**:
1. Import useOnboardingStore
2. Read selectedCategories array
3. Define hardcoded list of categories
4. Call toggleCategory(name) on press
5. Show checkmark if selectedCategories.includes(name)

**Decision**: Use hardcoded category list (Groceries, Transport, Entertainment, Bills, Shopping, Food & Dining)

**Risks**: Category names must match backend validation

## Step 6: Wire BudgetScreen to Store

**Goal**: Connect OnboardingBudgetScreen to capture budget input or skip.

**File to modify**: mobile/src/screens/onboarding/OnboardingBudgetScreen.tsx

**Changes**:
1. Add TextInput for amount entry
2. Call setBudget(amount) on Set Budget press
3. Call setBudget(null) on Skip press
4. Input validation for positive numbers

**Risks**: Currency symbol should match selected currency from store

## Step 7: Wire SampleData and Complete Screens

**Goal**: Wire last 2 screens and trigger onboarding completion.

**Files to modify**:
1. mobile/src/screens/onboarding/OnboardingSampleDataScreen.tsx
2. mobile/src/screens/onboarding/OnboardingCompleteScreen.tsx

**SampleDataScreen changes**:
- Call setSampleData(true/false) based on user choice
- Navigate to Complete screen

**CompleteScreen changes**:
- Display summary of all selections
- Show loading state during isCompleting
- Call completeOnboarding() on Continue press
- Display error if set
- Navigation happens automatically after success

**Risks**: 
- Network errors during multi-step API calls
- Partial completion leaves user in inconsistent state

## Step 8: Create Comprehensive Tests

**Goal**: Achieve 90%+ test coverage for store and API endpoints.

**Files to create**:
1. mobile/__tests__/stores/onboardingStore.test.ts - Store unit tests

**Test cases for onboardingStore**:

Initial state:
- Default currency is USD
- No categories selected
- Budget is null
- wantsSampleData is false

Actions:
- setCurrency updates selectedCurrency
- toggleCategory adds/removes category
- setBudget sets numeric or null
- setSampleData sets boolean

completeOnboarding:
- Sets isCompleting to true during execution
- Calls all APIs in correct order
- Calls currency API with selectedCurrency
- Calls categories API with selectedCategories
- Calls budget API only if monthlyBudget is set
- Calls seed-data API only if wantsSampleData is true
- Calls complete API
- Updates authStore.user.hasCompletedOnboarding
- Sets isCompleting to false after success
- Sets error on API failure
- Handles partial completion gracefully

**Screen test updates**:
All 5 onboarding screen test files need updates to mock useOnboardingStore and verify store methods are called

## Verification Checklist

Before marking complete:
- [ ] All 6 API endpoints created and follow JWT auth pattern
- [ ] API endpoints properly wrap server action logic
- [ ] onboardingStore created with all actions
- [ ] Store exported from index.ts
- [ ] CurrencyScreen wired (visual selection, setCurrency called)
- [ ] CategoriesScreen wired (multi-select, toggleCategory called)
- [ ] BudgetScreen wired (input + skip, setBudget called)
- [ ] SampleDataScreen wired (setSampleData called)
- [ ] CompleteScreen wired (summary + completeOnboarding called)
- [ ] Store tests pass with 90%+ coverage
- [ ] All screen tests updated and passing
- [ ] Manual testing: complete flow end-to-end
- [ ] Manual testing: skip budget flow
- [ ] Manual testing: with/without sample data
- [ ] Error states display correctly
- [ ] Loading states show during API calls
- [ ] Navigation works after completion

## Critical Paths

**High Risk**:
- completeOnboarding() multi-step orchestration - partial failures possible
- Account ID resolution for budget creation - may not exist
- Subscription requirement during onboarding - may block new users

**Needs Extra Review**:
- Error recovery strategy in completeOnboarding()
- Rate limiting configuration for onboarding endpoints
- Category name consistency between frontend and backend

**Performance Considerations**:
- Sequential API calls add latency (3-6 requests)
- Mobile users may have slow connections - need good loading UX

**Security Considerations**:
- JWT authentication on all endpoints
- Rate limiting prevents abuse
- Input validation via Zod schemas

## Complexity Assessment

**Overall**: High

**By Step**:
| Step | Complexity | Time Estimate |
|------|------------|---------------|
| Step 1: API Endpoints | High | 2-3 hours |
| Step 2: Onboarding Store | High | 2 hours |
| Step 3: Export Store | Low | 5 minutes |
| Step 4: Wire Currency | Low | 30 minutes |
| Step 5: Wire Categories | Medium | 45 minutes |
| Step 6: Wire Budget | Medium | 45 minutes |
| Step 7: Wire Final Screens | Medium | 1 hour |
| Step 8: Tests | High | 2-3 hours |

**Total Estimate**: 8-12 hours

**Confidence Level**: High

Pattern is well-established (existing stores + API endpoints to reference). Main complexity is orchestration and error handling.

## Success Criteria

A user can:
1. Select currency (persisted to store)
2. Select categories (visual feedback)
3. Set or skip budget (input validation)
4. Choose sample data option
5. See summary of selections
6. Tap Get Started and see loading state
7. Land on main app after successful completion
8. See error message if any step fails
9. Go back through screens and see previous selections preserved
