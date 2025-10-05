# Repository Guidelines

## Project Structure & Module Organization
- `src/app` defines Next.js routes, server actions, and API handlers.
- `src/components` stores reusable UI backed by Tailwind utilities; `src/lib` holds domain logic; `src/utils` contains helpers like formatters.
- Database schema, Prisma client, and seeds live in `prisma/`; static assets remain in `public/`.
- Vitest specs run from `tests/`, with browser scenarios scoped to `tests/e2e/`; long-form docs stay under `docs/`.

## Build, Test, and Development Commands
- `npm run setup:local` installs deps, boots Dockerized Postgres, runs Prisma sync, and seeds demo data.
- `npm run dev` starts the app against your local DB; use `npm run dev:local` when the Docker stack must launch first.
- `npm run build` mirrors production by invoking `prisma generate` and `next build`.
- `npm test` executes the Vitest suite; `npm run test:e2e` launches Playwright once the dev server is ready.
- `npm run lint` applies the Next.js ESLint ruleset and checks Tailwind usage.

## Coding Style & Naming Conventions
- Write TypeScript with named exports, two-space indentation, and module-scoped constants in ALL_CAPS.
- Client components declare `'use client'`; keep server-only utilities in `src/lib` or route handlers to avoid bundling browser APIs.
- Prefer descriptive file names (e.g., `account-summary.tsx`) and keep Tailwind class lists readable and composable.

## Testing Guidelines
- Cover new logic with Vitest unit specs; co-locate builders alongside tests instead of global fixtures.
- Name files after behaviors under test (e.g., `dashboard-layout.test.ts`).
- For browser flows, build, ensure the seeded DB is up, run the dev server, then execute `npm run test:e2e`.
- Update seeds if feature coverage depends on new data states.

## Commit & Pull Request Guidelines
- Use imperative commit subjects under ~60 characters, such as `Add joint account filters`.
- Document schema changes by regenerating Prisma (`npm run prisma:generate`) and including relevant artifacts.
- PRs should summarize intent, link issues, call out required migrations or seeds (`prisma migrate deploy`, `npm run db:seed`), and list manual verification (lint, build, tests).

## Security & Configuration Tips
- Never commit secrets; configure `DATABASE_URL` and `AUTH_SESSION_SECRET` locally and in Vercel.
- After schema updates, rerun generation and seeds so Vitest and Playwright stay deterministic.
- Keep `.env` files out of version control and redact credentials from logs, screenshots, and PR notes.
