# Balance Beacon

Personal finance SaaS. 14-day trial, $5/month.

Track income and expenses, create budgets, split costs with others, and understand your finances in 30 seconds. Web + mobile (iOS/Android).

## Features

- **Multi-Account Tracking** — Separate accounts (Self, Partner, Joint) to isolate personal vs shared finances
- **Budget Management** — Monthly limits per category with real-time progress tracking
- **Recurring Transactions** — Templates for rent, salary, subscriptions with one-click monthly application
- **Expense Sharing** — Split costs equally, by percentage, or fixed amounts; track payment status and send reminders
- **Multi-Currency** — USD, EUR, ILS with automatic exchange rate conversion via Frankfurter API
- **Holdings Tracker** — Track stocks and crypto with automatic price updates from market data
- **AI Assistant** — Built-in helper for financial insights and transaction management
- **Cross-Platform** — Web dashboard + React Native mobile app with synced data

## Tech Stack

- Next.js 16 App Router + TypeScript + Tailwind CSS
- React Native (Expo) for iOS/Android
- PostgreSQL via Prisma ORM
- JWT auth with email verification
- Paddle for subscriptions

## API

REST API v1 for mobile/integrations. See [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) for specs.

## Development

See `CLAUDE.md` for setup, commands, and contribution guidelines.
