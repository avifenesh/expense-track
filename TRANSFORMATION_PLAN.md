# SaaS Transformation Plan

## Overview

Transform personal finance app into commercial multi-tenant service with mobile support.

**Timeline**: 4 sprints
**Current State**: Personal app for 2 users, hardcoded auth, no isolation
**Target State**: Multi-tenant SaaS with subscription model, polished UX, mobile app

---

## Sprint 1: Production Readiness & Quality

**Goal**: Eliminate all bugs, achieve 90%+ test coverage, polish edge cases

### 1.1 Bug Fixes & Edge Cases

- Fix all known bugs in transaction handling
- Handle edge cases in budget calculations (zero planned, negative amounts)
- Fix currency conversion edge cases
- Proper error handling in all server actions
- Validate all user inputs thoroughly

### 1.2 Test Coverage

- Achieve 90%+ coverage on all action files
- Full coverage for lib/finance.ts (currently 0%)
- Full coverage for lib/currency.ts (currently 2.56%)
- Full coverage for lib/stock-api.ts (currently 0%)
- Integration tests for critical user flows
- Edge case tests for date handling, decimals, currencies

### 1.3 Code Quality

- Remove all console.\* statements
- Add proper error logging
- Eliminate TypeScript any types
- Fix all ESLint warnings
- Code review and refactor for clarity
- Remove hardcoded assumptions

### 1.4 UX Polish

- Consistent error messages across all forms
- Loading states for all async operations
- Optimistic updates where appropriate
- Toast notifications for success/error
- Form validation feedback
- Responsive design fixes

**Deliverables**:

- All tests passing
- 90%+ code coverage
- Zero console.\* in production code
- Clean TypeScript strict mode
- Polished user experience

---

## Sprint 2: Multi-Tenant Infrastructure

**Goal**: Replace hardcoded auth with proper user management, database isolation, subscription system

### 2.1 Database Schema Overhaul

- Add User model (id, email, name, passwordHash, createdAt, etc.)
- Add userId to all existing models (Account, Transaction, Budget, etc.)
- Add Subscription model (userId, status, trialEndsAt, currentPeriodEnd, etc.)
- Migration strategy for existing data
- Row-level security patterns

### 2.2 Authentication System

- Remove hardcoded AUTH_USERS
- Implement proper user registration flow
- Email/password authentication with bcrypt
- Session management with database sessions
- Password reset via email (SendGrid/Resend)
- Email verification on signup
- Rate limiting on auth endpoints

### 2.3 Authorization & Data Isolation

- Middleware to enforce userId on all queries
- Helper functions for user-scoped queries
- Update all server actions to filter by userId
- Prevent cross-user data access
- Account ownership validation

### 2.4 Subscription Management

- Trial period tracking (14 days)
- Subscription status checks
- Grace period handling
- Feature gating based on subscription status
- Admin dashboard for subscription management

### 2.5 OAuth Integration

- Google OAuth setup
- GitHub OAuth setup
- OAuth callback handling
- Link OAuth accounts to existing users

**Deliverables**:

- User registration/login/logout flows
- Email verification working
- OAuth providers integrated
- All data properly isolated by user
- Subscription tracking in place

---

## Sprint 3: Scale & Production Infrastructure

**Goal**: Prepare for scale with caching, monitoring, performance optimization

### 3.1 Database Optimization

- Add indexes for common queries (userId, month, accountId)
- Query optimization for dashboard aggregations
- Connection pooling configuration
- Database backup strategy
- Migration rollback procedures

### 3.2 Caching Layer

- Redis setup for session storage
- Cache exchange rates (refresh daily)
- Cache stock prices (refresh hourly)
- Cache dashboard aggregations (TTL: 5 min)
- Cache invalidation strategies

### 3.3 API & Performance

- API rate limiting (per user)
- Request logging and monitoring
- Slow query detection
- Bundle size optimization
- Image optimization
- Lazy loading for heavy components

### 3.4 Monitoring & Observability

- Error tracking (Sentry)
- Performance monitoring (Vercel Analytics)
- Database query monitoring
- User analytics (PostHog/Mixpanel)
- Uptime monitoring
- Alert system for critical errors

### 3.5 Security Hardening

- CSRF protection
- XSS prevention audit
- SQL injection prevention (Prisma handles this)
- Rate limiting on all endpoints
- Input sanitization
- Security headers (helmet.js)
- Dependency vulnerability scanning

### 3.6 Deployment & DevOps

- CI/CD pipeline refinement
- Staging environment setup
- Database migration automation
- Environment variable management
- Rollback procedures
- Health check endpoints

**Deliverables**:

- Redis caching operational
- Monitoring dashboards configured
- Rate limiting active
- Performance optimized (Lighthouse >90)
- Security audit passed
- Production deployment ready

---

## Sprint 4: Mobile App Foundation

**Goal**: Create React Native mobile app with core features

### 4.1 API Foundation

- Audit existing server actions for mobile compatibility
- Create REST API layer (Next.js API routes)
- Authentication token system (JWT)
- API versioning strategy
- Mobile-specific error responses
- API documentation (Swagger/OpenAPI)

### 4.2 React Native Setup

- Expo/React Native project initialization
- Navigation structure (React Navigation)
- Authentication flow (screens + storage)
- API client setup (axios/fetch)
- State management (Zustand/Redux)
- Offline support strategy

### 4.3 Core Mobile Screens

- Login/Signup screens
- Dashboard (summary view)
- Transactions list and detail
- Add/Edit transaction
- Budgets overview
- Account switcher
- Settings screen

### 4.4 Mobile-Specific Features

- Biometric authentication (Face ID/Touch ID)
- Push notifications setup
- Receipt photo capture
- Offline transaction queue
- Pull-to-refresh
- Dark mode support

### 4.5 Mobile Testing

- Jest unit tests
- Detox E2E tests
- iOS simulator testing
- Android emulator testing
- Real device testing
- Performance profiling

### 4.6 Mobile Deployment

- iOS App Store preparation
- Google Play Store preparation
- App icons and splash screens
- Privacy policy and terms
- App Store screenshots
- Beta testing (TestFlight/Internal Testing)

**Deliverables**:

- Mobile app with core features functional
- Authentication working on mobile
- Dashboard and transactions viewable
- Add/Edit transactions working
- iOS and Android builds ready
- Beta testing group established

---

## Cross-Sprint Considerations

### Documentation

- API documentation for mobile team
- Architecture decision records
- Deployment runbook
- User onboarding guide
- Admin documentation

### Legal & Compliance

- Privacy policy (GDPR, CCPA)
- Terms of service
- Cookie policy
- Data retention policy
- GDPR compliance (right to delete, export)

### Support Infrastructure

- Customer support system
- FAQ documentation
- In-app help system
- Bug reporting mechanism
- Feature request tracking

---

## Success Metrics

**Sprint 1**:

- 90%+ test coverage ✓
- Zero production bugs open ✓
- Lighthouse score >90 ✓

**Sprint 2**:

- User registration working ✓
- Multi-tenant data isolation verified ✓
- OAuth login functional ✓

**Sprint 3**:

- Cache hit rate >80% ✓
- API response time <200ms p95 ✓
- Zero downtime deployments ✓

**Sprint 4**:

- Mobile app functional on iOS/Android ✓
- Core features parity with web ✓
- Beta users onboarded ✓

---

## Risk Management

**Technical Risks**:

- Data migration complexity → Mitigation: Thorough testing, rollback plan
- Performance degradation with multi-tenancy → Mitigation: Caching, query optimization
- Mobile platform differences → Mitigation: Platform-specific testing

**Business Risks**:

- User churn during transition → Mitigation: Maintain backward compatibility
- Delayed mobile launch → Mitigation: Web-first approach, mobile can follow
- Security vulnerabilities → Mitigation: Security audit, penetration testing

**Operational Risks**:

- Database migration failures → Mitigation: Backup strategy, dry runs
- Third-party service outages → Mitigation: Graceful degradation, fallbacks
- Scaling issues → Mitigation: Load testing before launch
