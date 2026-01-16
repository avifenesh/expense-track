# Railway Deployment

This project is ready to deploy on Railway with `railway.json` configuration and Prisma migrations.

## 1) Create the Railway Project

1. Push this repository to GitHub/GitLab.
2. In Railway, create a new project from the repo.
3. Add a PostgreSQL database to the project.

## 2) Configure Environment Variables

Set these variables in the Railway service:

### Required
- `DATABASE_URL` – Railway Postgres connection string
- `AUTH_SESSION_SECRET` – random 64+ character secret
- `NEXT_PUBLIC_APP_URL` – Railway public URL or custom domain

### Migration Script Variables (Optional - Legacy)

**Note**: The following `AUTH_USER*` variables are legacy environment variables used only for the one-time data migration script (`npm run migrate:users`). After Sprint 2 migration is complete, users authenticate through the standard registration/login flow. Only set these if you need to run the migration script:

- `AUTH_USER1_EMAIL`
- `AUTH_USER1_DISPLAY_NAME`
- `AUTH_USER1_PASSWORD_HASH`
- `AUTH_USER1_PREFERRED_CURRENCY` (e.g., `USD`, `EUR`, `ILS`)
- `AUTH_USER2_EMAIL`
- `AUTH_USER2_DISPLAY_NAME`
- `AUTH_USER2_PASSWORD_HASH`
- `AUTH_USER2_PREFERRED_CURRENCY` (e.g., `USD`, `EUR`, `ILS`)

### Optional Features
- `ALPHA_VANTAGE_API_KEY` – stock prices (free at alphavantage.co)
- `STOCK_PRICE_MAX_AGE_HOURS` – defaults to 24
- `AWS_BEDROCK_ACCESS_KEY_ID`, `AWS_BEDROCK_SECRET_ACCESS_KEY`, `AWS_BEDROCK_REGION` – for AI assistant
- `NEXT_PUBLIC_AI_ENABLED` – `true`/`false`

## 3) Build & Deploy

`railway.json` in the repo handles:
- **Build**: `npm run build`
- **Migrations**: `npm run db:migrate`
- **Start**: `npm run start`

After the deploy succeeds, open the Railway URL and sign in with the configured users.

## 4) Post-Deploy Checks

- Run `npm run db:seed` locally if you need demo data in a fresh database.
- Verify currency preferences show correctly for Avi/Serena.
- Confirm recurring templates and budgets load.
