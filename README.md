# Balance Beacon

Personal finance workspace tailored for managing income, spending, and shared budgets across three accounts (you, partner, and joint). The dashboard keeps budgets, recurring obligations, and month-to-month performance together so you can replace manual spreadsheets.

## Features

- 🔁 Permanent transaction plans with one-click application into the current month.
- 💰 Budgets per account & category with live progress and remaining allowances.
- 📈 Month-to-month net results, income vs. expense trends, and quick forecasts.
- 📂 Flexible categories that you can archive/reactivate without losing history.
- 🧾 Fast entry forms for expenses and earnings, including recurring flagging.

## Tech Stack

- [Next.js 13 App Router](https://nextjs.org/docs/app) with Server Actions enabled
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

## Deployment (Vercel)

1. Push this repository to GitHub/GitLab.
2. In Vercel, import the project and choose the `main` branch (App Router detected automatically).
3. Add the following environment variables in the Vercel dashboard:
   - `DATABASE_URL` – your production Postgres URL (Neon free tier works great).
   - `AUTH_SESSION_SECRET` – same random 64-char string you used locally.
   - `NEXT_PUBLIC_APP_URL` – e.g. `https://your-app.vercel.app`.
4. (Optional) Wire up a [Vercel Postgres or Neon integration](https://vercel.com/integrations) for managed credentials.
5. Trigger a production deploy. The build runs `npm run build`, which executes `prisma generate` automatically (see `package.json`).

Detailed, step-by-step notes live in [`docs/vercel-deployment.md`](docs/vercel-deployment.md).

## Database Model

- **Account** – You, Partner, Joint (seeded) plus optional extras; used for filtering and budgeting.
- **Category** – Income or Expense groupings, soft-archived when no longer needed.
- **Transaction** – Individual earnings/expenses with month snapshots and optional recurring linkage.
- **Budget** – Planned spend/earn for a category + account in a given month.
- **RecurringTemplate** – Permanent plan definitions that can be applied into transactions each month.

## Common Workflows

- Add budgets for the month from the “Monthly Budgets” card, then capture spending as it happens.
- Save rent/salary/etc. as permanent plans. At the start of each month, hit “Apply to {Month}” to pre-populate them.
- Switch between **All**, **Me**, **Partner**, and **Joint** using the account selector to focus on one ledger.

## Scripts Reference

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build with type-checking |
| `npm run start` | Start the compiled production server |
| `npm run lint` | Run ESLint |
| `npm run prisma:generate` | Regenerate Prisma client types |
| `npm run db:push` | Push Prisma schema to the configured database |
| `npm run db:migrate` | Apply pending migrations in production environments |
| `npm run db:seed` | Seed baseline accounts and categories |

## Next Steps & Ideas

- Add authentication if you plan to expose this beyond personal use.
- Attach receipt uploads to transactions (S3, Cloudinary, etc.).
- Create analytics widgets (cash flow by quarter, partner split, etc.).
- Automate monthly rollovers that duplicate all active recurring templates automatically on the 1st.

Enjoy running your finances without juggling multiple spreadsheets! If you bump into anything or want to expand the feature set, consider opening a GitHub issue in your fork to track future enhancements.
