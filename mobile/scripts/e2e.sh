#!/usr/bin/env bash

# E2E Test All-in-One Script
# Runs complete workflow: setup → run → teardown
# One command to execute full E2E testing lifecycle

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source platform utilities
# shellcheck source=lib/platform.sh
source "$SCRIPT_DIR/lib/platform.sh"

# Parse arguments to pass through to run script
RUN_ARGS=()
SKIP_SETUP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-setup)
      SKIP_SETUP=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Runs complete E2E workflow: setup → run → teardown"
      echo ""
      echo "Options:"
      echo "  --skip-setup               Skip setup step (devices already configured)"
      echo "  --platform <ios|android>   Platform to test"
      echo "  --build                    Build app before testing"
      echo "  --release                  Use release build"
      echo "  --spec <file>              Run specific test file"
      echo "  --headless                 Run without GUI (Android only)"
      echo "  --cleanup                  Clean artifacts after run"
      echo "  --help                     Show this help message"
      echo ""
      echo "All options except --skip-setup are passed to run-e2e.sh"
      exit 0
      ;;
    *)
      RUN_ARGS+=("$1")
      shift
      ;;
  esac
done

echo ""
print_status "info" "=== E2E Test Workflow ==="
echo ""

# Step 1: Setup (unless skipped)
if [ "$SKIP_SETUP" = false ]; then
  print_status "info" "Step 1/3: Running setup..."
  bash "$SCRIPT_DIR/setup-e2e.sh" "${RUN_ARGS[@]}"
else
  print_status "info" "Step 1/3: Skipping setup"
fi

# Step 2: Run tests
echo ""
print_status "info" "Step 2/3: Running tests..."
TEST_EXIT_CODE=0
bash "$SCRIPT_DIR/run-e2e.sh" "${RUN_ARGS[@]}" || TEST_EXIT_CODE=$?

# Step 3: Teardown
echo ""
print_status "info" "Step 3/3: Running teardown..."
bash "$SCRIPT_DIR/teardown-e2e.sh"

# Report final result
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  print_status "success" "=== E2E Workflow Complete ✓ ==="
else
  print_status "error" "=== E2E Workflow Failed ✗ ==="
fi
echo ""

exit $TEST_EXIT_CODE
