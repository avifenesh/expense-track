# Balance Beacon

Personal finance SaaS for managing income, spending, and shared budgets. Create multiple accounts, track expenses, split costs with others, and gain clarity on your finances. 14-day trial, then $5/month.

The dashboard keeps budgets, recurring obligations, and month-to-month performance together so you can replace manual spreadsheets.

## Features

- 🔁 Permanent transaction plans with one-click application into the current month.
- 💰 Budgets per account & category with live progress and remaining allowances.
- 📈 Month-to-month net results, income vs. expense trends, and quick forecasts.
- 📂 Flexible categories that you can archive/reactivate without losing history.
- 🧾 Fast entry forms for expenses and earnings, including recurring flagging.

## Tech Stack

- [Next.js 16 App Router](https://nextjs.org/docs/app) with Server Actions enabled
- TypeScript + Tailwind CSS UI primitives
- [Prisma ORM](https://www.prisma.io/) with PostgreSQL (tested against Neon)
- Zod validation on all server mutations

## Prerequisites

- Node.js **18.18+** (recommended Node 20 LTS). Server Actions and the Prisma client both require modern Node. Use `nvm`, `fnm`, or Volta to switch locally if needed.
- npm 9+ (ships with current Node). Yarn/pnpm work too if you prefer.
- A PostgreSQL database (Neon, Supabase, Render, or local Postgres all work).

## Local Setup

### Quick start

```bash
npm run setup:local
```

The script installs dependencies (if needed), writes `.env` with local defaults, boots the Dockerized Postgres instance, syncs Prisma schema, and seeds starter data. When it completes, start the dev server with `npm run dev` (the database stays running).

### Manual steps

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   - Replace `DATABASE_URL` with your Postgres connection string (Neon will give you one that already includes `sslmode=require`).
   - Set a long, random `AUTH_SESSION_SECRET` (use `openssl rand -hex 32`).
   - Optionally set `NEXT_PUBLIC_APP_URL` for absolute URLs in emails/links.
   - **Paddle Payment Provider (Optional):** For subscription payments, configure Paddle:
     - `PADDLE_API_KEY` - API key from Paddle Dashboard > Developer Tools > Authentication
     - `PADDLE_WEBHOOK_SECRET` - Webhook secret from Paddle Dashboard > Developer Tools > Notifications
     - `PADDLE_PRICE_ID` - Price ID for $5/month subscription from Paddle Dashboard > Catalog > Prices
     - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` - Client-side token for Paddle.js
     - `NEXT_PUBLIC_PADDLE_ENVIRONMENT` - Set to `sandbox` for testing or `production` for live

3. **Start a local Postgres instance (optional)**
   If you don’t already have Postgres running, the repo ships with a Docker compose file:

   ```bash
   npm run db:up:local
   # follow logs (Ctrl+C to detach)
   npm run db:logs:local
   ```

   Credentials default to `postgres:postgres` with the database `expense_track`. Adjust `.env.docker` if you need different values.

4. **Prepare the database schema**
   Choose one of:
   - Use migrations (recommended once you have a persistent DB):
     ```bash
     npx prisma migrate dev --name init
     ```
   - For a throwaway dev database, push the schema directly:
     ```bash
     npm run db:push
     ```

5. **Seed core data** (creates the three base accounts and starter categories):

   ```bash
   npm run db:seed
   ```

6. **Generate the Prisma client** (runs automatically on `npm install`, but kept for completeness):

   ```bash
   npm run prisma:generate
   ```

7. **Start the dev server**

   ```bash
   npm run dev
   ```

   Or run everything (boot Postgres + dev server) in one go:

   ```bash
   npm run dev:local
   ```

   Visit [http://localhost:3000](http://localhost:3000) to use the dashboard.

8. **Stop the local database**
   ```bash
   npm run db:down:local
   ```

## Deployment (Railway)

1. Push this repository to GitHub/GitLab.
2. In Railway, create a new project from the repo and add a PostgreSQL database.
3. Set the required environment variables:
   - `DATABASE_URL` – your Railway Postgres connection string.
   - `AUTH_SESSION_SECRET` – same random 64-char string you used locally.
   - `NEXT_PUBLIC_APP_URL` – your Railway public URL or custom domain.
4. Deploy. Railway uses `railway.json` to run `npm run build`, apply migrations, and start the app.

Detailed, step-by-step notes live in [`docs/railway-deployment.md`](docs/railway-deployment.md).

## Database Model

- **Account** – You, Partner, Joint (seeded) plus optional extras; used for filtering and budgeting.
- **Category** – Income or Expense groupings, soft-archived when no longer needed.
- **Transaction** – Individual earnings/expenses with month snapshots and optional recurring linkage.
- **Budget** – Planned spend/earn for a category + account in a given month.
- **RecurringTemplate** – Permanent plan definitions that can be applied into transactions each month.

## API Documentation

REST API documentation for mobile app development:

- **[API Audit](docs/API_AUDIT.md)** - Server actions vs REST endpoints analysis
- **[API Contracts](docs/API_CONTRACTS.md)** - Request/response formats and endpoint specifications
- **[API Versioning](docs/API_VERSIONING.md)** - Versioning strategy and deprecation policy

## Common Workflows

- Add budgets for the month from the “Monthly Budgets” card, then capture spending as it happens.
- Save rent/salary/etc. as permanent plans. At the start of each month, hit “Apply to {Month}” to pre-populate them.
- Switch between **All**, **Me**, **Partner**, and **Joint** using the account selector to focus on one ledger.

## Scripts Reference

| Command                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `npm run dev`             | Start the Next.js dev server                        |
| `npm run build`           | Production build with type-checking                 |
| `npm run start`           | Start the compiled production server                |
| `npm run lint`            | Run ESLint                                          |
| `npm run prisma:generate` | Regenerate Prisma client types                      |
| `npm run db:push`         | Push Prisma schema to the configured database       |
| `npm run db:migrate`      | Apply pending migrations in production environments |
| `npm run db:seed`         | Seed baseline accounts and categories               |
| `npm run migrate:users`   | Migrate legacy data to user-based model (one-time)  |
| `npm run rollback:users`  | Rollback user migration if needed                   |

## CI Notes

- CI validates migrations against `prisma/schema.prisma` with `prisma migrate diff`.
- CI applies migrations with `prisma migrate deploy` before running tests.

## Next Steps & Ideas

- Create analytics widgets (cash flow by quarter, partner split, etc.).
- Automate monthly rollovers that duplicate all active recurring templates automatically on the 1st.

Enjoy running your finances without juggling multiple spreadsheets! If you bump into anything or want to expand the feature set, consider opening a GitHub issue in your fork to track future enhancements.
