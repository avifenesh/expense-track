# Repository Guidelines

## Project Structure & Module Organization
Next.js App Router code lives in `src/app` (layouts, server actions, global styles) with reusable UI in `src/components` and domain helpers in `src/lib` and `src/utils`. Prisma assets (`schema.prisma`, migrations, `seed.ts`) reside in `prisma/`, while static files stay under `public/`. Onboarding scripts sit in `scripts/`, and Docker orchestration for local Postgres is defined in `docker-compose.yml` plus `.env.docker`.

## Build, Test, and Development Commands
- `npm run setup:local`: scaffold `.env`, boot Docker Postgres, sync Prisma, seed demo data.
- `npm run dev:local`: refresh Prisma client then launch the dev server; use `npm run dev` when the DB is already running.
- `npm run build` / `npm run start`: production compile and serve.
- `npm run lint`: enforce ESLint + Next.js rules; run with `--fix` before committing.
- Database utilities: `npm run db:up:local`, `db:down:local`, `db:logs:local`, `db:push`, `db:migrate`, `db:seed`, `npm run prisma:generate`.

## Coding Style & Naming Conventions
Use TypeScript everywhere, export components in PascalCase, and keep files focused—UI in `src/components`, state or calculations in `src/lib`. Prefer named exports, two-space indentation, Tailwind utilities for styling, and short helper functions. Match existing formatting (no bundled Prettier) and leave server-only code within `src/app` or `lib` modules that avoid browser-only APIs.

## Testing Guidelines
No automated runner ships today. If you add one, colocate specs as `*.test.ts` or `*.test.tsx`, expose it via `npm test`, and document setup in the PR. Meanwhile, rely on `npm run lint`, TypeScript checks, and manual walkthroughs of budgeting, seeding, and recurring-plan flows; capture reproduction steps or screenshots when filing issues.

## Commit & Pull Request Guidelines
Write imperative commit subjects under ~60 characters (e.g., `Add joint balance widget`) and group schema changes with regenerated Prisma client files. Pull requests should summarize the change, link relevant issues, note migrations or seeds to run, and include screenshots or GIFs for UI work plus manual verification notes. Rebase on `main` before opening to keep history linear.

## Environment & Security Notes
Copy `.env.example` to `.env` and keep secrets local; Docker defaults are tracked in `.env.docker`. After any schema edit run `npm run prisma:generate` to prevent stale types. Remove real financial data from logs, seeds, and screenshots prior to sharing.
