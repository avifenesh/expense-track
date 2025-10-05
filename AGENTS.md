# Repository Guidelines

## Project Structure & Module Organization
- **src/** holds all Next.js App Router code, UI components, and TypeScript helpers. Key entry points: `src/app` (routes, server actions), `src/components` (shared UI), `src/lib` (domain logic), and `src/utils` (formatters).
- **prisma/** contains `schema.prisma`, generated client output, and `seed.ts` for Avi/Serena account data.
- **tests/** houses Vitest unit suites and Playwright end-to-end specs; `tests/e2e` drives browser flows.
- **docs/** captures deployment notes (`docs/vercel-deployment.md`). Static assets live under `public/`.

## Build, Test, and Development Commands
- `npm run setup:local` – installs deps, boots Docker Postgres, syncs schema, seeds data.
- `npm run dev` / `npm run dev:local` – starts Next dev server (the latter also ensures Docker DB is up).
- `npm run build` – runs `prisma generate` then `next build` (mirrors Vercel).
- `npm test` – executes Vitest suites; `npm run test:e2e` drives Playwright (requires running app & seeded DB).
- `npm run lint` – Next.js ESLint pass.

## Coding Style & Naming Conventions
- TypeScript-first; client components opt into `'use client'` when needed.
- Two-space indentation, Tailwind utility classes for styling, named exports over default.
- Keep server-only utilities in `src/lib` or `src/app`; avoid browser APIs in server code.

## Testing Guidelines
- Unit tests live beside helpers (`tests/*.test.ts`) using Vitest. Prefer deterministic data builders over fixtures.
- Playwright specs in `tests/e2e` cover login, account switching, and CRUD flows; run against seeded DB: `npm run build && npm run test:e2e`.
- Add new suites when touching auth, finance calculations, or dashboard layout state.

## Commit & Pull Request Guidelines
- Use imperative commit subjects under ~60 characters (e.g., `Add joint account filters`). Group schema changes with regenerated Prisma client.
- PRs should summarize intent, list environment or migration steps (`prisma migrate deploy`, `npm run db:seed`), and attach screenshots/GIFs for UI tweaks. Link relevant issues and note manual test coverage (lint/build/tests executed).

## Security & Configuration Tips
- Secrets: set `DATABASE_URL` and `AUTH_SESSION_SECRET` locally and on Vercel; never commit real credentials.
- After schema edits run `npm run prisma:generate` and reseed (`npm run db:seed`) so Playwright tests reflect new data.
