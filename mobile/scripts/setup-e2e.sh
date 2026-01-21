#!/usr/bin/env bash

# E2E Test Environment Setup Script (Bash)
# Automates setup of iOS simulator and/or Android emulator for Detox testing
# Supports macOS, Linux, and Windows (Git Bash)

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
ANDROID_API_LEVEL="31"
ANDROID_SYSTEM_IMAGE="system-images;android-31;google_apis;x86_64"
ANDROID_DEVICE="pixel_5"
NODE_MIN_VERSION="20"

# Parse arguments
SETUP_IOS=false
SETUP_ANDROID=false
SKIP_PREBUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --ios)
      SETUP_IOS=true
      shift
      ;;
    --android)
      SETUP_ANDROID=true
      shift
      ;;
    --skip-prebuild)
      SKIP_PREBUILD=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --ios              Setup iOS simulator only (macOS only)"
      echo "  --android          Setup Android emulator only"
      echo "  --skip-prebuild    Skip expo prebuild step"
      echo "  --help             Show this help message"
      echo ""
      echo "If no platform is specified, will auto-detect and setup all available platforms."
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
PLATFORM=$(detect_platform)

if [ "$SETUP_IOS" = false ] && [ "$SETUP_ANDROID" = false ]; then
  print_status "info" "No platform specified, auto-detecting..."

  if has_ios_support; then
    SETUP_IOS=true
    print_status "success" "iOS development tools detected"
  fi

  if has_android_support; then
    SETUP_ANDROID=true
    print_status "success" "Android SDK detected"
  fi

  if [ "$SETUP_IOS" = false ] && [ "$SETUP_ANDROID" = false ]; then
    print_status "error" "No development tools detected. Please install Xcode (macOS) or Android SDK."
    exit 1
  fi
fi

# Verify iOS is only requested on macOS
if [ "$SETUP_IOS" = true ] && [ "$PLATFORM" != "macos" ]; then
  print_status "error" "iOS simulator setup is only available on macOS"
  exit 1
fi

echo ""
print_status "info" "=== E2E Test Environment Setup ==="
print_status "info" "Platform: $PLATFORM"
[ "$SETUP_IOS" = true ] && print_status "info" "Target: iOS ($IOS_SIMULATOR_NAME)"
[ "$SETUP_ANDROID" = true ] && print_status "info" "Target: Android (AVD: $ANDROID_AVD_NAME)"
echo ""

# Check Node.js version
print_status "info" "Checking Node.js version..."
if ! command -v node &> /dev/null; then
  print_status "error" "Node.js is not installed"
  print_status "info" "Please install Node.js $NODE_MIN_VERSION or later from https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
  print_status "error" "Node.js version $NODE_VERSION is too old (minimum: $NODE_MIN_VERSION)"
  exit 1
fi
print_status "success" "Node.js version: $(node -v)"

# Check npm
print_status "info" "Checking npm..."
if ! command -v npm &> /dev/null; then
  print_status "error" "npm is not installed"
  exit 1
fi
print_status "success" "npm version: $(npm -v)"

# Install Detox CLI globally if missing
print_status "info" "Checking Detox CLI..."
if ! command -v detox &> /dev/null; then
  print_status "info" "Installing Detox CLI globally..."
  npm install -g detox-cli
  print_status "success" "Detox CLI installed"
else
  print_status "success" "Detox CLI already installed"
fi

# iOS Setup (macOS only)
if [ "$SETUP_IOS" = true ]; then
  echo ""
  print_status "info" "=== iOS Simulator Setup ==="

  # Check for Xcode command line tools
  print_status "info" "Checking Xcode command line tools..."
  if ! xcode-select -p &> /dev/null; then
    print_status "error" "Xcode command line tools not installed"
    print_status "info" "Run: xcode-select --install"
    exit 1
  fi
  print_status "success" "Xcode command line tools installed"

  # Check for applesimutils
  print_status "info" "Checking applesimutils..."
  if ! command -v applesimutils &> /dev/null; then
    if command -v brew &> /dev/null; then
      print_status "info" "Installing applesimutils via Homebrew..."
      brew tap wix/brew
      brew install applesimutils
      print_status "success" "applesimutils installed"
    else
      print_status "warning" "Homebrew not found. Please install applesimutils manually:"
      print_status "info" "  brew tap wix/brew"
      print_status "info" "  brew install applesimutils"
    fi
  else
    print_status "success" "applesimutils already installed"
  fi

  # Check if simulator exists
  print_status "info" "Checking for $IOS_SIMULATOR_NAME simulator..."
  if xcrun simctl list devices | grep -q "$IOS_SIMULATOR_NAME"; then
    print_status "success" "$IOS_SIMULATOR_NAME simulator already exists"
  else
    print_status "info" "Creating $IOS_SIMULATOR_NAME simulator..."
    xcrun simctl create "$IOS_SIMULATOR_NAME" "com.apple.CoreSimulator.SimDeviceType.iPhone-15"
    print_status "success" "$IOS_SIMULATOR_NAME simulator created"
  fi
fi

# Android Setup
if [ "$SETUP_ANDROID" = true ]; then
  echo ""
  print_status "info" "=== Android Emulator Setup ==="

  # Get Android SDK path
  ANDROID_SDK=$(get_android_sdk_path)
  if [ -z "$ANDROID_SDK" ]; then
    print_status "error" "Android SDK not found"
    print_status "info" "Please install Android SDK and set ANDROID_HOME environment variable"
    print_status "info" "Download from: https://developer.android.com/studio"
    exit 1
  fi
  print_status "success" "Android SDK found at: $ANDROID_SDK"
  export ANDROID_HOME="$ANDROID_SDK"
  export ANDROID_SDK_ROOT="$ANDROID_SDK"

  # Find sdkmanager
  SDKMANAGER=""
  if [ -f "$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
    SDKMANAGER="$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager"
  elif [ -f "$ANDROID_SDK/tools/bin/sdkmanager" ]; then
    SDKMANAGER="$ANDROID_SDK/tools/bin/sdkmanager"
  else
    print_status "error" "sdkmanager not found in Android SDK"
    print_status "info" "Please install Android SDK command-line tools"
    exit 1
  fi

  # Find avdmanager
  AVDMANAGER=""
  if [ -f "$ANDROID_SDK/cmdline-tools/latest/bin/avdmanager" ]; then
    AVDMANAGER="$ANDROID_SDK/cmdline-tools/latest/bin/avdmanager"
  elif [ -f "$ANDROID_SDK/tools/bin/avdmanager" ]; then
    AVDMANAGER="$ANDROID_SDK/tools/bin/avdmanager"
  else
    print_status "error" "avdmanager not found in Android SDK"
    exit 1
  fi

  # Check for system image
  print_status "info" "Checking for Android system image..."
  if ! "$SDKMANAGER" --list | grep -q "$ANDROID_SYSTEM_IMAGE"; then
    print_status "info" "Downloading Android system image ($ANDROID_SYSTEM_IMAGE)..."
    yes | "$SDKMANAGER" "$ANDROID_SYSTEM_IMAGE"
    print_status "success" "System image downloaded"
  else
    print_status "success" "System image already downloaded"
  fi

  # Check if AVD exists
  print_status "info" "Checking for AVD '$ANDROID_AVD_NAME'..."
  if "$AVDMANAGER" list avd | grep -q "Name: $ANDROID_AVD_NAME"; then
    print_status "success" "AVD '$ANDROID_AVD_NAME' already exists"
  else
    print_status "info" "Creating AVD '$ANDROID_AVD_NAME'..."
    echo "no" | "$AVDMANAGER" create avd \
      -n "$ANDROID_AVD_NAME" \
      -k "$ANDROID_SYSTEM_IMAGE" \
      -d "$ANDROID_DEVICE" \
      --force
    print_status "success" "AVD '$ANDROID_AVD_NAME' created"
  fi
fi

# Install npm dependencies
echo ""
print_status "info" "=== Installing Dependencies ==="
cd "$MOBILE_DIR"

print_status "info" "Running npm install..."
npm install --legacy-peer-deps
print_status "success" "Dependencies installed"

# Run expo prebuild
if [ "$SKIP_PREBUILD" = false ]; then
  echo ""
  print_status "info" "=== Generating Native Projects (Expo Prebuild) ==="

  if [ "$SETUP_IOS" = true ] && [ "$SETUP_ANDROID" = true ]; then
    print_status "info" "Running expo prebuild for both platforms..."
    npx expo prebuild --clean
  elif [ "$SETUP_IOS" = true ]; then
    print_status "info" "Running expo prebuild for iOS..."
    npx expo prebuild --clean --platform ios
  elif [ "$SETUP_ANDROID" = true ]; then
    print_status "info" "Running expo prebuild for Android..."
    npx expo prebuild --clean --platform android
  fi
  print_status "success" "Native projects generated"

  # Install CocoaPods for iOS
  if [ "$SETUP_IOS" = true ]; then
    echo ""
    print_status "info" "Installing CocoaPods dependencies..."
    cd "$MOBILE_DIR/ios"
    pod install
    cd "$MOBILE_DIR"
    print_status "success" "CocoaPods dependencies installed"
  fi
fi

echo ""
print_status "success" "=== Setup Complete ==="
echo ""
print_status "info" "Next steps:"
if [ "$SETUP_IOS" = true ]; then
  print_status "info" "  • Build iOS app: npm run e2e:build:ios"
  print_status "info" "  • Run iOS tests: npm run e2e:run:ios"
fi
if [ "$SETUP_ANDROID" = true ]; then
  print_status "info" "  • Build Android app: npm run e2e:build:android"
  print_status "info" "  • Run Android tests: npm run e2e:run:android"
fi
print_status "info" "  • Or run full workflow: npm run e2e:full:ios (or :android)"
echo ""
