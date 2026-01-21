# E2E Test Environment Setup Script (PowerShell)
# Automates setup of Android emulator for Detox testing on Windows
# Note: iOS testing is not supported on Windows

param(
    [switch]$Android,
    [switch]$SkipPrebuild,
    [switch]$Help
)

# Configuration
$ANDROID_AVD_NAME = "test"
$ANDROID_API_LEVEL = "31"
$ANDROID_SYSTEM_IMAGE = "system-images;android-31;google_apis;x86_64"
$ANDROID_DEVICE = "pixel_5"
$NODE_MIN_VERSION = 20

# Get script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$MOBILE_DIR = Split-Path -Parent $SCRIPT_DIR

# Helper functions
function Write-Status {
    param(
        [string]$Type,
        [string]$Message
    )

    switch ($Type) {
        "success" { Write-Host "✓ $Message" -ForegroundColor Green }
        "error"   { Write-Host "✗ $Message" -ForegroundColor Red }
        "warning" { Write-Host "⚠ $Message" -ForegroundColor Yellow }
        "info"    { Write-Host "$Message" }
    }
}

# Show help
if ($Help) {
    Write-Host "Usage: .\setup-e2e.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Android         Setup Android emulator"
    Write-Host "  -SkipPrebuild    Skip expo prebuild step"
    Write-Host "  -Help            Show this help message"
    Write-Host ""
    Write-Host "Note: iOS testing is not supported on Windows"
    exit 0
}

# Default to Android if no platform specified
if (-not $Android) {
    $Android = $true
}

Write-Host ""
Write-Status "info" "=== E2E Test Environment Setup (Windows) ==="
Write-Status "info" "Target: Android (AVD: $ANDROID_AVD_NAME)"
Write-Host ""

# Check Node.js version
Write-Status "info" "Checking Node.js version..."
try {
    $nodeVersion = (node -v) -replace 'v', '' -replace '\..*', ''
    if ([int]$nodeVersion -lt $NODE_MIN_VERSION) {
        Write-Status "error" "Node.js version $nodeVersion is too old (minimum: $NODE_MIN_VERSION)"
        exit 1
    }
    Write-Status "success" "Node.js version: $(node -v)"
}
catch {
    Write-Status "error" "Node.js is not installed"
    Write-Status "info" "Please install Node.js $NODE_MIN_VERSION or later from https://nodejs.org/"
    exit 1
}

# Check npm
Write-Status "info" "Checking npm..."
try {
    $npmVersion = npm -v
    Write-Status "success" "npm version: $npmVersion"
}
catch {
    Write-Status "error" "npm is not installed"
    exit 1
}

# Install Detox CLI globally if missing
Write-Status "info" "Checking Detox CLI..."
try {
    $detoxVersion = detox --version
    Write-Status "success" "Detox CLI already installed"
}
catch {
    Write-Status "info" "Installing Detox CLI globally..."
    npm install -g detox-cli
    Write-Status "success" "Detox CLI installed"
}

# Android Setup
Write-Host ""
Write-Status "info" "=== Android Emulator Setup ==="

# Get Android SDK path
$ANDROID_SDK = $env:ANDROID_HOME
if (-not $ANDROID_SDK) {
    $ANDROID_SDK = $env:ANDROID_SDK_ROOT
}
if (-not $ANDROID_SDK) {
    # Try common paths
    $commonPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "C:\Android\Sdk",
        "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
    )

    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $ANDROID_SDK = $path
            break
        }
    }
}

if (-not $ANDROID_SDK) {
    Write-Status "error" "Android SDK not found"
    Write-Status "info" "Please install Android SDK and set ANDROID_HOME environment variable"
    Write-Status "info" "Download from: https://developer.android.com/studio"
    exit 1
}

Write-Status "success" "Android SDK found at: $ANDROID_SDK"
$env:ANDROID_HOME = $ANDROID_SDK
$env:ANDROID_SDK_ROOT = $ANDROID_SDK

# Find sdkmanager
$SDKMANAGER = $null
$sdkmanagerPaths = @(
    "$ANDROID_SDK\cmdline-tools\latest\bin\sdkmanager.bat",
    "$ANDROID_SDK\tools\bin\sdkmanager.bat"
)

foreach ($path in $sdkmanagerPaths) {
    if (Test-Path $path) {
        $SDKMANAGER = $path
        break
    }
}

if (-not $SDKMANAGER) {
    Write-Status "error" "sdkmanager not found in Android SDK"
    Write-Status "info" "Please install Android SDK command-line tools"
    exit 1
}

# Find avdmanager
$AVDMANAGER = $null
$avdmanagerPaths = @(
    "$ANDROID_SDK\cmdline-tools\latest\bin\avdmanager.bat",
    "$ANDROID_SDK\tools\bin\avdmanager.bat"
)

foreach ($path in $avdmanagerPaths) {
    if (Test-Path $path) {
        $AVDMANAGER = $path
        break
    }
}

if (-not $AVDMANAGER) {
    Write-Status "error" "avdmanager not found in Android SDK"
    exit 1
}

# Check for system image
Write-Status "info" "Checking for Android system image..."
$systemImages = & $SDKMANAGER --list 2>&1 | Select-String $ANDROID_SYSTEM_IMAGE
if (-not $systemImages) {
    Write-Status "info" "Downloading Android system image ($ANDROID_SYSTEM_IMAGE)..."
    Write-Output "y" | & $SDKMANAGER $ANDROID_SYSTEM_IMAGE
    Write-Status "success" "System image downloaded"
}
else {
    Write-Status "success" "System image already downloaded"
}

# Check if AVD exists
Write-Status "info" "Checking for AVD '$ANDROID_AVD_NAME'..."
$avdList = & $AVDMANAGER list avd 2>&1 | Select-String "Name: $ANDROID_AVD_NAME"
if ($avdList) {
    Write-Status "success" "AVD '$ANDROID_AVD_NAME' already exists"
}
else {
    Write-Status "info" "Creating AVD '$ANDROID_AVD_NAME'..."
    Write-Output "no" | & $AVDMANAGER create avd `
        -n $ANDROID_AVD_NAME `
        -k $ANDROID_SYSTEM_IMAGE `
        -d $ANDROID_DEVICE `
        --force 2>&1 | Out-Null
    Write-Status "success" "AVD '$ANDROID_AVD_NAME' created"
}

# Install npm dependencies
Write-Host ""
Write-Status "info" "=== Installing Dependencies ==="
Set-Location $MOBILE_DIR

Write-Status "info" "Running npm install..."
npm install --legacy-peer-deps
Write-Status "success" "Dependencies installed"

# Run expo prebuild
if (-not $SkipPrebuild) {
    Write-Host ""
    Write-Status "info" "=== Generating Native Projects (Expo Prebuild) ==="

    Write-Status "info" "Running expo prebuild for Android..."
    npx expo prebuild --clean --platform android
    Write-Status "success" "Native projects generated"
}

Write-Host ""
Write-Status "success" "=== Setup Complete ==="
Write-Host ""
Write-Status "info" "Next steps:"
Write-Status "info" "  • Build Android app: npm run e2e:build:android"
Write-Status "info" "  • Run Android tests: npm run e2e:run:android"
Write-Status "info" "  • Or run full workflow: npm run e2e:full:android"
Write-Host ""
