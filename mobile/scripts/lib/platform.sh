#!/usr/bin/env bash

# Platform Detection Utility for E2E Testing Scripts
# Provides cross-platform detection and validation functions

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect current platform
# Returns: "macos", "linux", or "windows"
detect_platform() {
  case "$(uname -s)" in
    Darwin*)
      echo "macos"
      ;;
    Linux*)
      echo "linux"
      ;;
    CYGWIN*|MINGW*|MSYS*)
      echo "windows"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

# Check if iOS development tools are available (macOS only)
# Returns: 0 if available, 1 otherwise
has_ios_support() {
  local platform
  platform=$(detect_platform)

  if [ "$platform" != "macos" ]; then
    return 1
  fi

  # Check for xcode-select
  if ! command -v xcode-select &> /dev/null; then
    return 1
  fi

  # Check if Xcode CLI tools are installed
  if ! xcode-select -p &> /dev/null; then
    return 1
  fi

  return 0
}

# Check if Android development tools are available
# Returns: 0 if available, 1 otherwise
has_android_support() {
  # Check for ANDROID_HOME or ANDROID_SDK_ROOT
  if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    # Try common installation paths
    local common_paths=(
      "$HOME/Library/Android/sdk"
      "$HOME/Android/Sdk"
      "/usr/local/android-sdk"
      "/opt/android-sdk"
      "C:/Users/$USER/AppData/Local/Android/Sdk"
    )

    for path in "${common_paths[@]}"; do
      if [ -d "$path" ]; then
        export ANDROID_HOME="$path"
        export ANDROID_SDK_ROOT="$path"
        break
      fi
    done
  fi

  if [ -z "$ANDROID_HOME" ]; then
    return 1
  fi

  # Check for sdkmanager
  local sdkmanager_paths=(
    "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
    "$ANDROID_HOME/tools/bin/sdkmanager"
  )

  for path in "${sdkmanager_paths[@]}"; do
    if [ -f "$path" ]; then
      return 0
    fi
  done

  return 1
}

# Require a command to be available
# Usage: require_command <command> <error_message>
# Returns: 0 if available, exits with error otherwise
require_command() {
  local cmd="$1"
  local error_msg="$2"

  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}Error: $cmd is not installed.${NC}"
    if [ -n "$error_msg" ]; then
      echo -e "${YELLOW}$error_msg${NC}"
    fi
    return 1
  fi

  return 0
}

# Print colored status message
# Usage: print_status <type> <message>
# Types: success, error, warning, info
print_status() {
  local type="$1"
  local message="$2"

  case "$type" in
    success)
      echo -e "${GREEN}✓ $message${NC}"
      ;;
    error)
      echo -e "${RED}✗ $message${NC}"
      ;;
    warning)
      echo -e "${YELLOW}⚠ $message${NC}"
      ;;
    info)
      echo -e "$message"
      ;;
  esac
}

# Get Android SDK path
# Returns: path to Android SDK or empty string
get_android_sdk_path() {
  if [ -n "$ANDROID_HOME" ]; then
    echo "$ANDROID_HOME"
    return 0
  fi

  if [ -n "$ANDROID_SDK_ROOT" ]; then
    echo "$ANDROID_SDK_ROOT"
    return 0
  fi

  # Try common paths
  local common_paths=(
    "$HOME/Library/Android/sdk"
    "$HOME/Android/Sdk"
    "/usr/local/android-sdk"
    "/opt/android-sdk"
  )

  for path in "${common_paths[@]}"; do
    if [ -d "$path" ]; then
      echo "$path"
      return 0
    fi
  done

  echo ""
  return 1
}
