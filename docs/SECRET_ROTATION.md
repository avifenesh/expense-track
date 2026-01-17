# Secret Rotation Guide

This document describes the procedures for rotating secrets in Balance Beacon.

## Secret Inventory

| Secret | Location | Rotation Frequency | Impact |
|--------|----------|-------------------|--------|
| `JWT_SECRET` | Environment variable | 90 days | All active sessions invalidated |
| `AUTH_SESSION_SECRET` | Environment variable | 90 days | All sessions invalidated |
| `DATABASE_URL` | Environment variable | As needed | Requires deployment |
| `PADDLE_API_KEY` | Environment variable | 365 days | Payment processing affected |
| `PADDLE_WEBHOOK_SECRET` | Environment variable | 365 days | Webhooks fail until updated |
| `SMTP_PASSWORD` | Environment variable | 90 days | Email sending affected |
| `SENTRY_AUTH_TOKEN` | CI/CD secrets | 365 days | Source map uploads fail |
| `CRON_SECRET` | Environment variable | 90 days | Cron endpoints blocked |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Environment variable | 365 days | AI chat disabled |
| `ALPHA_VANTAGE_API_KEY` | Environment variable | 365 days | Stock prices unavailable |

## Rotation Procedures

### JWT_SECRET

The JWT secret is used to sign authentication tokens. Rotation invalidates all existing tokens.

**Preparation:**
1. Generate new secret: `openssl rand -hex 64`
2. Schedule rotation during low-traffic period
3. Notify users of upcoming session refresh requirement

**Rotation Steps:**
1. Update `JWT_SECRET` in production environment
2. Deploy the application
3. All users will need to re-authenticate on next request

**Rollback:**
- If issues occur, restore the previous secret
- Users with old tokens will regain access

### AUTH_SESSION_SECRET

Used for signing session cookies with HMAC-SHA256.

**Preparation:**
1. Generate new secret: `openssl rand -hex 32`
2. Schedule during low-traffic period

**Rotation Steps:**
1. Update `AUTH_SESSION_SECRET` in production environment
2. Deploy the application
3. Existing sessions become invalid
4. Users must re-authenticate

**Rollback:**
- Restore previous secret to restore sessions

### DATABASE_URL

Database credentials should be rotated when:
- A team member with access leaves
- Credentials may have been exposed
- Security policy requires periodic rotation

**Preparation:**
1. Create new database user in PostgreSQL
2. Grant identical permissions to new user
3. Test connection with new credentials locally

**Rotation Steps:**
1. Update `DATABASE_URL` with new credentials
2. Update `DIRECT_URL` if using Prisma migrations
3. Deploy the application
4. Verify application connects successfully
5. After 24 hours, revoke old database user

**PostgreSQL Commands:**
```sql
-- Create new user
CREATE USER app_user_new WITH ENCRYPTED PASSWORD 'new_secure_password';

-- Grant minimal required permissions (principle of least privilege)
-- Avoid GRANT ALL PRIVILEGES - it includes dangerous permissions like DROP, TRUNCATE, ALTER
GRANT CONNECT ON DATABASE expense_track TO app_user_new;
GRANT USAGE ON SCHEMA public TO app_user_new;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user_new;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user_new;

-- For future objects created by migrations (run as superuser/migration user)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user_new;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user_new;

-- After rotation is confirmed working
DROP USER app_user_old;
```

**Note:** Schema migrations should be run by a separate privileged user (e.g., `migration_user`) that has `CREATE`, `ALTER`, and `DROP` permissions. The application user should only have CRUD permissions.

### PADDLE_API_KEY

Paddle API key for payment processing.

**Preparation:**
1. Generate new API key in Paddle Dashboard > Developer Tools > Authentication
2. Do NOT revoke old key yet

**Rotation Steps:**
1. Update `PADDLE_API_KEY` in production environment
2. Deploy the application
3. Verify subscription operations work (create test subscription in sandbox)
4. Revoke old API key in Paddle Dashboard

**Testing:**
- Test subscription creation in sandbox environment
- Verify webhook signature validation still works

### PADDLE_WEBHOOK_SECRET

Used to verify Paddle webhook signatures.

**Preparation:**
1. Generate new webhook secret in Paddle Dashboard > Developer Tools > Notifications
2. Note: Paddle may send webhooks signed with both old and new secrets during transition

**Rotation Steps:**
1. Create new webhook endpoint or update existing one in Paddle
2. Update `PADDLE_WEBHOOK_SECRET` in production
3. Deploy the application
4. Send test webhook from Paddle Dashboard
5. Verify webhook is received and processed
6. Remove old webhook endpoint if created new one

### SMTP Credentials (Email)

**Preparation:**
1. Generate new SMTP credentials from email provider
2. Test new credentials with a simple send

**Rotation Steps:**
1. Update SMTP environment variables
2. Deploy the application
3. Trigger test email (password reset request to test account)
4. Revoke old credentials

### CRON_SECRET

Authenticates cron job requests.

**Preparation (Zero-Downtime):**
1. Generate new secret: `openssl rand -hex 32`
2. Add the new secret to your environment as `CRON_SECRET_NEW`
3. Update application code to accept tokens authorized by either `CRON_SECRET` or `CRON_SECRET_NEW`

**Rotation Steps:**
1. Deploy the application with support for both secrets
2. Update the cron job caller (Vercel Cron, GitHub Actions, etc.) to use the new secret
3. Verify that cron executions are succeeding with the new secret
4. In a future deployment, set `CRON_SECRET` to the new value and remove `CRON_SECRET_NEW`
5. Deploy to clean up the old secret support

**Note:** This zero-downtime approach prevents any cron job failures during rotation. The application temporarily accepts both the old and new secrets, ensuring continuity.

### GOOGLE_GENERATIVE_AI_API_KEY

Used for AI chat functionality.

**Preparation:**
1. Generate new API key in Google AI Studio
2. Verify quota and permissions match

**Rotation Steps:**
1. Update `GOOGLE_GENERATIVE_AI_API_KEY` in production
2. Deploy the application
3. Test AI chat functionality
4. Delete old API key in Google AI Studio

### ALPHA_VANTAGE_API_KEY

Used for stock price data.

**Preparation:**
1. Generate new API key from Alpha Vantage
2. Verify API tier and rate limits

**Rotation Steps:**
1. Update `ALPHA_VANTAGE_API_KEY` in production
2. Deploy the application
3. Verify holdings tab loads stock prices
4. Old key auto-expires or can be deleted

## CI/CD Secrets

### GitHub Actions Secrets

Located in: Repository Settings > Secrets > Actions

| Secret | Purpose |
|--------|---------|
| `CI_DB_USER` | CI database username |
| `CI_DB_PASSWORD` | CI database password |
| `CI_AUTH_SESSION_SECRET` | Test session signing |
| `CI_JWT_SECRET` | Test JWT signing |
| `SENTRY_AUTH_TOKEN` | Source map uploads |

**Rotation:**
1. Go to Repository Settings > Secrets and variables > Actions
2. Click on the secret to update
3. Enter new value and save
4. Verify next CI run succeeds

### Vercel/Railway Secrets

Update via platform dashboard or CLI:

```bash
# Vercel
vercel env rm JWT_SECRET production
vercel env add JWT_SECRET production

# Railway
railway variables set JWT_SECRET=new_value
```

## Emergency Rotation

If a secret is compromised:

1. **Immediately** rotate the compromised secret
2. Review access logs for unauthorized activity
3. If database credentials compromised:
   - Rotate credentials
   - Review database audit logs
   - Check for unauthorized data access
4. If JWT_SECRET compromised:
   - Rotate immediately (all sessions invalidated)
   - Review authentication logs for suspicious activity
5. Document the incident and rotation in the incident log

## Rotation Schedule

| Frequency | Secrets |
|-----------|---------|
| 90 days | JWT_SECRET, AUTH_SESSION_SECRET, CRON_SECRET, SMTP credentials |
| 365 days | PADDLE_*, SENTRY_AUTH_TOKEN, API keys |
| As needed | DATABASE_URL (on team changes or exposure) |

## Automation

Consider automating secret rotation with:
- HashiCorp Vault for centralized secret management
- AWS Secrets Manager with automatic rotation
- 1Password or similar for team secret sharing

## Audit Checklist

- [ ] All secrets use strong random values (min 32 bytes)
- [ ] No secrets committed to version control
- [ ] Secrets stored only in environment variables or secret managers
- [ ] Rotation history documented
- [ ] Emergency rotation procedure tested
- [ ] Team access to secrets reviewed quarterly
