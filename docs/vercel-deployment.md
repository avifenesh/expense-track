# Deploying to Vercel

This project targets PostgreSQL via Prisma and Server Actions in the Next.js App Router. Deployments succeed as long as a publicly reachable Postgres instance and two environment secrets are configured.

## 1. Provision a production database

Any managed Postgres works (Neon, Supabase, Render, Railway, etc.). Copy the connection string; it must allow traffic from Vercel.

> **Tip:** Neon’s free tier provides connection pooling that works out of the box with Prisma on Vercel.

## 2. Create secrets in Vercel

In your project settings (Environment Variables), add:

| Name                  | Value / Notes                                                         | Environment |
| --------------------- | --------------------------------------------------------------------- | ----------- |
| `DATABASE_URL`        | Managed Postgres connection string (`sslmode=require` preferred).     | Production  |
| `AUTH_SESSION_SECRET` | 64-byte random string (`openssl rand -hex 32`).                        | Production  |
| `NEXT_PUBLIC_APP_URL` | Deployed hostname, e.g. `https://balance-beacon.vercel.app`.           | Production  |

Add the same variables for Preview deployments if you need branch builds.

## 3. Import the repo in Vercel

- Framework: **Next.js** (auto-detected).
- Root directory: repository root.
- Build command: `npm run build` (from `vercel.json`).
- Install command: `npm install`.

Custom settings live in `vercel.json`, including an explicit `npm run build` so Prisma generates the client before Next builds.

## 4. Prepare the database schema

Pipelines do **not** run Prisma migrations automatically. After the first deploy:

```bash
# Using the Vercel shell or locally with the production DATABASE_URL
npx prisma migrate deploy
npm run db:seed          # optional, seeds Avi, Serena, and Joint accounts
```

Alternatively, add a CI step or managed migration service to run `prisma migrate deploy` before promoting a release.

## 5. Trigger deployment

Push to the main branch or press **Deploy** in Vercel. The build pipeline executes:

```
npm install
npm run build   # runs `prisma generate` then `next build`
```

Once the build completes, the deployment will serve the dashboard. The login form expects the seeded Avi/Serena accounts; if you skip the seed step, create equivalent records manually.

## Troubleshooting

- `Category.isHolding does not exist`: run `prisma migrate deploy` against the production database.
- Cookie/session issues: confirm `AUTH_SESSION_SECRET` is set and the runtime time is >= Node 18.18.
- Cold starts or long-running queries: adjust function limits in `vercel.json` (`memory`, `maxDuration`).

