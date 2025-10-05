# Repository Guidelines

## Project Structure & Module Organization
Source first lives in `src/`: `src/app` for routes and server actions, `src/components` for shared UI, `src/lib` for domain logic, and `src/utils` for formatters. Database schema, generated Prisma client, and seeds sit under `prisma/`. Vitest and Playwright suites reside in `tests/`, with browser flows in `tests/e2e`. Deployment notes are in `docs/`, while static assets remain in `public/`.

## Build, Test, and Development Commands
Run `npm run setup:local` to install dependencies, start Docker Postgres, sync Prisma, and seed demo accounts. Use `npm run dev` (or `npm run dev:local` when you need the Docker DB bootstrapped) to iterate locally. `npm run build` executes `prisma generate` and `next build` to mirror Vercel. Execute `npm test` for Vitest and `npm run test:e2e` for Playwright after a successful build and seeded DB. Lint with `npm run lint`.

## Coding Style & Naming Conventions
Write TypeScript modules with named exports and two-space indentation. Client-side files opt into `'use client'`; server-only helpers belong in `src/lib` or route handlers to avoid bundling browser APIs. Styling relies on Tailwind utility classes; keep classlists readable and composable. Let the Next.js ESLint rules guide formatting and import order.

## Testing Guidelines
Unit suites use Vitest; place builders alongside tests instead of fixtures. Ensure new logic ships with deterministic coverage by extending files in `tests/`. For end-to-end coverage, build the app, seed data, then run `npm run test:e2e` while the dev server is live. Name tests after the behavior under verification (e.g., `dashboard-layout.test.ts`).

## Commit & Pull Request Guidelines
Compose imperative commit subjects under ~60 characters such as `Add joint account filters`. When schema changes occur, regenerate Prisma client and include the output. Pull requests should summarize intent, note migrations or seeding steps (`prisma migrate deploy`, `npm run db:seed`), link issues, and document manual verification (lint/build/tests).

## Security & Configuration Tips
Never commit secrets; set `DATABASE_URL` and `AUTH_SESSION_SECRET` locally and in Vercel. After altering schema, re-run `npm run prisma:generate` and `npm run db:seed` so tests and Playwright flows stay accurate. Keep environment files out of version control and scrub any credentials from logs or screenshots before sharing.
