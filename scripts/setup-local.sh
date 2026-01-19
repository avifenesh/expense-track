#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# devskim-ignore: DS162092 - localhost expected for local database setup
LOCAL_DB_URL='postgresql://postgres:postgres@localhost:5432/expense_track?schema=public'
# devskim-ignore: DS162092 - localhost expected for local app URL
LOCAL_APP_URL='http://localhost:3000'

# Ensure dependencies are installed (skip if node_modules present)
if [ ! -d "node_modules" ]; then
  echo "Installing npm dependencies..."
  npm install
fi

# Create .env if missing
if [ ! -f .env ]; then
  echo "Creating .env from template..."
  cp .env.example .env
fi

# Update DATABASE_URL in .env
TMP_ENV="$ROOT_DIR/.env.tmp"
>"$TMP_ENV"
UPDATED_DB=false
while IFS= read -r line || [ -n "$line" ]; do
  if [[ "$line" == DATABASE_URL=* ]]; then
    echo "DATABASE_URL=\"$LOCAL_DB_URL\"" >> "$TMP_ENV"
    UPDATED_DB=true
  elif [[ "$line" == NEXT_PUBLIC_APP_URL=* ]]; then
    echo "NEXT_PUBLIC_APP_URL=\"$LOCAL_APP_URL\"" >> "$TMP_ENV"
  elif [[ -n "$line" ]]; then
    echo "$line" >> "$TMP_ENV"
  fi
done < .env

if [ "$UPDATED_DB" = false ]; then
  echo "DATABASE_URL=\"$LOCAL_DB_URL\"" >> "$TMP_ENV"
fi

if ! grep -q '^NEXT_PUBLIC_APP_URL=' "$TMP_ENV"; then
  echo "NEXT_PUBLIC_APP_URL=\"$LOCAL_APP_URL\"" >> "$TMP_ENV"
fi

mv "$TMP_ENV" .env

# Start Dockerized Postgres
npm run db:up:local

# Wait for database to accept connections
printf 'Waiting for database'
for _ in {1..10}; do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  printf '.'
  sleep 1
done
printf '\n'

dotenv -e .env -- prisma generate
dotenv -e .env -- prisma db push
dotenv -e .env -- prisma db seed

cat <<MSG
✅ Local environment ready.

Next steps:
  npm run dev        # start Next.js (DB already running)
  npm run db:logs:local  # inspect database logs
  npm run db:down:local  # stop database when done
MSG
