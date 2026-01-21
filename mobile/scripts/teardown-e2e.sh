#!/usr/bin/env bash

# E2E Test Teardown Script
# Cleans up running emulators/simulators and optionally removes artifacts and builds

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source platform utilities
# shellcheck source=lib/platform.sh
source "$SCRIPT_DIR/lib/platform.sh"

# Parse arguments
CLEAN_ARTIFACTS=false
CLEAN_BUILDS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean-artifacts)
      CLEAN_ARTIFACTS=true
      shift
      ;;
    --clean-builds)
      CLEAN_BUILDS=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --clean-artifacts  Remove test artifacts (mobile/artifacts/)"
      echo "  --clean-builds     Remove build outputs (ios/build, android/app/build)"
      echo "  --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo ""
print_status "info" "=== E2E Test Teardown ==="
echo ""

# Kill iOS simulators (macOS only)
PLATFORM=$(detect_platform)
if [ "$PLATFORM" = "macos" ]; then
  print_status "info" "Shutting down iOS simulators..."
  if pgrep -x "Simulator" > /dev/null; then
    killall Simulator 2>/dev/null || true
    print_status "success" "iOS simulators shut down"
  else
    print_status "info" "No iOS simulators running"
  fi
fi

# Kill Android emulators
print_status "info" "Shutting down Android emulators..."
ANDROID_SDK=$(get_android_sdk_path)
if [ -n "$ANDROID_SDK" ]; then
  export ANDROID_HOME="$ANDROID_SDK"
  export PATH="$ANDROID_SDK/platform-tools:$PATH"

  if command -v adb &> /dev/null; then
    # Get list of running emulators
    RUNNING_EMULATORS=$(adb devices | grep emulator | cut -f1)

    if [ -n "$RUNNING_EMULATORS" ]; then
      while IFS= read -r emulator; do
        adb -s "$emulator" emu kill 2>/dev/null || true
      done <<< "$RUNNING_EMULATORS"
      print_status "success" "Android emulators shut down"
    else
      print_status "info" "No Android emulators running"
    fi
  else
    print_status "warning" "adb not found, cannot shut down emulators"
  fi
else
  print_status "info" "Android SDK not found, skipping emulator shutdown"
fi

# Clean artifacts if requested
if [ "$CLEAN_ARTIFACTS" = true ]; then
  print_status "info" "Cleaning test artifacts..."
  cd "$MOBILE_DIR"
  if [ -d "artifacts" ]; then
    rm -rf artifacts/*
    print_status "success" "Test artifacts cleaned"
  else
    print_status "info" "No artifacts directory found"
  fi
fi

# Clean build outputs if requested
if [ "$CLEAN_BUILDS" = true ]; then
  print_status "info" "Cleaning build outputs..."
  cd "$MOBILE_DIR"

  # iOS builds
  if [ -d "ios/build" ]; then
    rm -rf ios/build
    print_status "success" "iOS build outputs cleaned"
  fi

  # Android builds
  if [ -d "android/app/build" ]; then
    rm -rf android/app/build
    print_status "success" "Android build outputs cleaned"
  fi

  if [ -d "android/.gradle" ]; then
    rm -rf android/.gradle
    print_status "success" "Gradle cache cleaned"
  fi
fi

echo ""
print_status "success" "=== Teardown Complete ==="
echo ""
