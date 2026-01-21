#!/usr/bin/env bash

# E2E Test Run Script (Bash)
# Handles device lifecycle (boot/shutdown) and test execution
# Supports iOS and Android with various build configurations

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source platform utilities
# shellcheck source=lib/platform.sh
source "$SCRIPT_DIR/lib/platform.sh"

# Configuration
IOS_SIMULATOR_NAME="iPhone 15"
ANDROID_AVD_NAME="test"

# Default options
PLATFORM=""
BUILD=false
RELEASE=false
SPEC=""
HEADLESS=false
CLEANUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --build)
      BUILD=true
      shift
      ;;
    --release)
      RELEASE=true
      shift
      ;;
    --spec)
      SPEC="$2"
      shift 2
      ;;
    --headless)
      HEADLESS=true
      shift
      ;;
    --no-headless)
      HEADLESS=false
      shift
      ;;
    --cleanup)
      CLEANUP=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --platform <ios|android|both>  Platform to test (default: auto-detect)"
      echo "  --build                        Build app before testing"
      echo "  --release                      Use release build instead of debug"
      echo "  --spec <file>                  Run specific test file"
      echo "  --headless                     Run without GUI (Android only)"
      echo "  --no-headless                  Show simulator/emulator GUI"
      echo "  --cleanup                      Clean artifacts after run"
      echo "  --help                         Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Auto-detect platform if not specified
if [ -z "$PLATFORM" ]; then
  DETECTED_PLATFORM=$(detect_platform)
  if [ "$DETECTED_PLATFORM" = "macos" ]; then
    PLATFORM="ios"
  else
    PLATFORM="android"
  fi
  print_status "info" "Auto-detected platform: $PLATFORM"
fi

# Validate platform
if [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ] && [ "$PLATFORM" != "both" ]; then
  print_status "error" "Invalid platform: $PLATFORM (must be ios, android, or both)"
  exit 1
fi

# Verify iOS is only on macOS
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  CURRENT_PLATFORM=$(detect_platform)
  if [ "$CURRENT_PLATFORM" != "macos" ]; then
    print_status "error" "iOS testing is only available on macOS"
    exit 1
  fi
fi

cd "$MOBILE_DIR"

# Determine build configuration
if [ "$RELEASE" = true ]; then
  BUILD_CONFIG="release"
  IOS_DETOX_CONFIG="ios.sim.release"
  ANDROID_DETOX_CONFIG="android.emu.release"
else
  BUILD_CONFIG="debug"
  IOS_DETOX_CONFIG="ios.sim.debug"
  ANDROID_DETOX_CONFIG="android.emu.debug"
fi

START_TIME=$(date +%s)
TEST_EXIT_CODE=0

# iOS Test Flow
run_ios_tests() {
  echo ""
  print_status "info" "=== Running iOS E2E Tests ==="
  print_status "info" "Configuration: $BUILD_CONFIG"

  # Boot simulator
  print_status "info" "Booting $IOS_SIMULATOR_NAME simulator..."
  xcrun simctl boot "$IOS_SIMULATOR_NAME" 2>/dev/null || true

  # Wait for simulator to boot
  print_status "info" "Waiting for simulator to boot..."
  local timeout=60
  local elapsed=0
  while ! xcrun simctl list devices | grep "$IOS_SIMULATOR_NAME" | grep -q "Booted"; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ $elapsed -ge $timeout ]; then
      print_status "error" "Simulator failed to boot within $timeout seconds"
      return 1
    fi
  done
  print_status "success" "Simulator booted"

  # Build if requested
  if [ "$BUILD" = true ]; then
    print_status "info" "Building iOS app ($BUILD_CONFIG)..."
    npm run "e2e:build:ios:$BUILD_CONFIG"
    print_status "success" "Build complete"
  fi

  # Run tests
  print_status "info" "Running tests..."
  local detox_args=(--configuration "$IOS_DETOX_CONFIG")
  [ "$CLEANUP" = true ] && detox_args+=(--cleanup)
  if [ -n "$SPEC" ]; then
    detox_args+=("$SPEC")
  fi

  if detox test "${detox_args[@]}"; then
    print_status "success" "Tests passed"
    return 0
  else
    print_status "error" "Tests failed"
    return 1
  fi
}

# Android Test Flow
run_android_tests() {
  echo ""
  print_status "info" "=== Running Android E2E Tests ==="
  print_status "info" "Configuration: $BUILD_CONFIG"

  # Get Android SDK path
  ANDROID_SDK=$(get_android_sdk_path)
  if [ -z "$ANDROID_SDK" ]; then
    print_status "error" "Android SDK not found"
    return 1
  fi
  export ANDROID_HOME="$ANDROID_SDK"
  export ANDROID_SDK_ROOT="$ANDROID_SDK"
  export PATH="$ANDROID_SDK/emulator:$ANDROID_SDK/platform-tools:$PATH"

  # Start emulator
  print_status "info" "Starting Android emulator '$ANDROID_AVD_NAME'..."

  local emulator_opts="-avd $ANDROID_AVD_NAME -no-snapshot-save -no-audio"
  if [ "$HEADLESS" = true ]; then
    emulator_opts="$emulator_opts -no-window"
  fi

  # Start emulator in background
  nohup emulator $emulator_opts > /dev/null 2>&1 &
  EMULATOR_PID=$!

  # Wait for emulator to boot
  print_status "info" "Waiting for emulator to boot..."
  adb wait-for-device

  # Wait for boot to complete
  local boot_timeout=300
  local boot_elapsed=0
  while [ -z "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" ]; do
    sleep 2
    boot_elapsed=$((boot_elapsed + 2))
    if [ $boot_elapsed -ge $boot_timeout ]; then
      print_status "error" "Emulator failed to boot within $boot_timeout seconds"
      return 1
    fi
  done

  # Wait additional time for full initialization
  sleep 10

  # Unlock screen
  adb shell input keyevent 82
  print_status "success" "Emulator booted"

  # Build if requested
  if [ "$BUILD" = true ]; then
    print_status "info" "Building Android app ($BUILD_CONFIG)..."
    npm run "e2e:build:android:$BUILD_CONFIG"
    print_status "success" "Build complete"
  fi

  # Run tests
  print_status "info" "Running tests..."
  local detox_args=(--configuration "$ANDROID_DETOX_CONFIG")
  [ "$CLEANUP" = true ] && detox_args+=(--cleanup)
  [ "$HEADLESS" = true ] && detox_args+=(--headless)
  if [ -n "$SPEC" ]; then
    detox_args+=("$SPEC")
  fi

  local test_result=0
  if detox test "${detox_args[@]}"; then
    print_status "success" "Tests passed"
  else
    print_status "error" "Tests failed"
    test_result=1
  fi

  # Shutdown emulator
  print_status "info" "Shutting down emulator..."
  adb emu kill 2>/dev/null || true
  sleep 2

  return $test_result
}

# Run tests based on platform
if [ "$PLATFORM" = "both" ]; then
  print_status "info" "Running tests on both platforms"

  if run_ios_tests; then
    print_status "success" "iOS tests passed"
  else
    TEST_EXIT_CODE=1
    print_status "error" "iOS tests failed"
  fi

  if run_android_tests; then
    print_status "success" "Android tests passed"
  else
    TEST_EXIT_CODE=1
    print_status "error" "Android tests failed"
  fi
elif [ "$PLATFORM" = "ios" ]; then
  if ! run_ios_tests; then
    TEST_EXIT_CODE=1
  fi
elif [ "$PLATFORM" = "android" ]; then
  if ! run_android_tests; then
    TEST_EXIT_CODE=1
  fi
fi

# Report results
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
print_status "info" "=== Test Summary ==="
print_status "info" "Platform: $PLATFORM"
print_status "info" "Configuration: $BUILD_CONFIG"
print_status "info" "Duration: ${DURATION}s"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  print_status "success" "All tests passed ✓"
else
  print_status "error" "Some tests failed ✗"
  print_status "info" "Check artifacts in mobile/artifacts/ for details"
fi
echo ""

exit $TEST_EXIT_CODE
