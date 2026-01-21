#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔧 Setting up E2E test environment..."

# E2E database configuration
E2E_DB_USER="${E2E_DB_USER:-e2e_user}"
E2E_DB_PASSWORD="${E2E_DB_PASSWORD:-e2e_password}"
E2E_DB_NAME="${E2E_DB_NAME:-balance_beacon_e2e}"
E2E_DB_PORT="${E2E_DB_PORT:-5434}"

# Create .env.e2e if it doesn't exist
if [ ! -f .env.e2e ]; then
  echo "📝 Creating .env.e2e file..."
  cat > .env.e2e << 'EOF'
DATABASE_URL=postgresql://e2e_user:e2e_password@localhost:5434/balance_beacon_e2e
NODE_ENV=test
JWT_SECRET=e2e-test-jwt-secret-32chars-minimum-for-validation
AUTH_SESSION_SECRET=e2e-test-session-secret-32chars-minimum-valid

# E2E test users - passwords: E2ETestPassword123!
AUTH_USER1_EMAIL=e2e-user1@test.local
AUTH_USER1_DISPLAY_NAME=E2E Test User
AUTH_USER1_PASSWORD_HASH=$2b$10$EMmOLPQ/5Ei4WQyBKbOkmeJz8cHH/eB50wZ3m6KoIi0vBY2fvyQ4a
AUTH_USER2_EMAIL=e2e-user2@test.local
AUTH_USER2_DISPLAY_NAME=E2E Test User 2
AUTH_USER2_PASSWORD_HASH=$2b$10$EMmOLPQ/5Ei4WQyBKbOkmeJz8cHH/eB50wZ3m6KoIi0vBY2fvyQ4a
EOF
fi

# Create docker-compose.e2e.yml if it doesn't exist
if [ ! -f docker-compose.e2e.yml ]; then
  echo "📝 Creating docker-compose.e2e.yml file..."
  cat > docker-compose.e2e.yml << 'EOF'
services:
  db-e2e:
    image: postgres:16-alpine
    container_name: balance-beacon-e2e-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: balance_beacon_e2e
      POSTGRES_USER: e2e_user
      POSTGRES_PASSWORD: e2e_password
    ports:
      - "5434:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-d", "balance_beacon_e2e", "-U", "e2e_user"]
      interval: 5s
      timeout: 5s
      retries: 5
EOF
fi

# Install root dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing root dependencies..."
  npm ci
fi

# Start E2E database
echo "🐘 Starting E2E PostgreSQL database..."
docker compose -f docker-compose.e2e.yml up -d

# Wait for database
echo "⏳ Waiting for E2E database to be ready..."
for i in {1..30}; do
  if docker compose -f docker-compose.e2e.yml exec -T db-e2e pg_isready -U e2e_user >/dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  echo "   Waiting... ($i/30)"
  sleep 1
done

# Generate Prisma client
echo "🔨 Generating Prisma client..."
dotenv -e .env.e2e -- npm run prisma:generate

# Push database schema
echo "📊 Pushing database schema..."
dotenv -e .env.e2e -- npm run db:push

# Seed E2E database
echo "🌱 Seeding E2E database..."
dotenv -e .env.e2e -- npm run db:seed:e2e

# Install mobile dependencies
if [ ! -d "mobile/node_modules" ]; then
  echo "📦 Installing mobile dependencies..."
  cd mobile
  npm install --legacy-peer-deps
  cd ..
fi

cat << 'MSG'

✅ E2E environment ready!

Next steps:
  1. Start backend: dotenv -e .env.e2e -- npm run dev
  2. In another terminal, run mobile E2E tests:
     cd mobile
     npm run e2e:build:android:release  # or e2e:build:ios:release
     npm run e2e:test:android:release   # or e2e:test:ios:release

Cleanup:
  docker compose -f docker-compose.e2e.yml down  # Stop E2E database
MSG
