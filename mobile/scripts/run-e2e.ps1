# E2E Test Run Script (PowerShell)
# Handles Android emulator lifecycle and test execution
# Note: iOS testing is not supported on Windows

param(
    [string]$Platform = "android",
    [switch]$Build,
    [switch]$Release,
    [string]$Spec = "",
    [switch]$Headless,
    [switch]$Cleanup,
    [switch]$Help
)

# Get script directory
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$MOBILE_DIR = Split-Path -Parent $SCRIPT_DIR

# Configuration
$ANDROID_AVD_NAME = "test"

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
    Write-Host "Usage: .\run-e2e.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Platform <android>  Platform to test (default: android)"
    Write-Host "  -Build               Build app before testing"
    Write-Host "  -Release             Use release build instead of debug"
    Write-Host "  -Spec <file>         Run specific test file"
    Write-Host "  -Headless            Run without GUI"
    Write-Host "  -Cleanup             Clean artifacts after run"
    Write-Host "  -Help                Show this help message"
    Write-Host ""
    Write-Host "Note: iOS testing is not supported on Windows"
    exit 0
}

# Validate platform
if ($Platform -ne "android") {
    Write-Status "error" "Only Android platform is supported on Windows"
    exit 1
}

Set-Location $MOBILE_DIR

# Determine build configuration
$buildConfig = if ($Release) { "release" } else { "debug" }
$detoxConfig = "android.emu.$buildConfig"

Write-Host ""
Write-Status "info" "=== Running Android E2E Tests ==="
Write-Status "info" "Configuration: $buildConfig"

# Get Android SDK path
$ANDROID_SDK = $env:ANDROID_HOME
if (-not $ANDROID_SDK) {
    $ANDROID_SDK = $env:ANDROID_SDK_ROOT
}
if (-not $ANDROID_SDK) {
    $commonPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk",
        "C:\Android\Sdk"
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
    exit 1
}

$env:ANDROID_HOME = $ANDROID_SDK
$env:ANDROID_SDK_ROOT = $ANDROID_SDK
$env:PATH = "$ANDROID_SDK\emulator;$ANDROID_SDK\platform-tools;$env:PATH"

# Start emulator
Write-Status "info" "Starting Android emulator '$ANDROID_AVD_NAME'..."

$emulatorOpts = @("-avd", $ANDROID_AVD_NAME, "-no-snapshot-save", "-no-audio")
if ($Headless) {
    $emulatorOpts += "-no-window"
}

$emulatorProcess = Start-Process -FilePath "emulator" -ArgumentList $emulatorOpts -PassThru -NoNewWindow

# Wait for emulator to boot
Write-Status "info" "Waiting for emulator to boot..."
& adb wait-for-device

$bootTimeout = 300
$bootElapsed = 0
while ($true) {
    $bootCompleted = & adb shell getprop sys.boot_completed 2>$null
    if ($bootCompleted -match "1") {
        break
    }
    Start-Sleep -Seconds 2
    $bootElapsed += 2
    if ($bootElapsed -ge $bootTimeout) {
        Write-Status "error" "Emulator failed to boot within $bootTimeout seconds"
        exit 1
    }
}

Start-Sleep -Seconds 10

# Unlock screen
& adb shell input keyevent 82 2>$null
Write-Status "success" "Emulator booted"

# Build if requested
if ($Build) {
    Write-Status "info" "Building Android app ($buildConfig)..."
    npm run "e2e:build:android:$buildConfig"
    Write-Status "success" "Build complete"
}

# Run tests
Write-Status "info" "Running tests..."
$detoxArgs = @("test", "--configuration", $detoxConfig)
if ($Cleanup) { $detoxArgs += "--cleanup" }
if ($Headless) { $detoxArgs += "--headless" }
if ($Spec) { $detoxArgs += $Spec }

$testResult = 0
try {
    & detox @detoxArgs
    Write-Status "success" "Tests passed"
}
catch {
    Write-Status "error" "Tests failed"
    $testResult = 1
}

# Shutdown emulator
Write-Status "info" "Shutting down emulator..."
& adb emu kill 2>$null
Start-Sleep -Seconds 2

Write-Host ""
Write-Status "info" "=== Test Summary ==="
Write-Status "info" "Platform: android"
Write-Status "info" "Configuration: $buildConfig"

if ($testResult -eq 0) {
    Write-Status "success" "All tests passed ✓"
}
else {
    Write-Status "error" "Tests failed ✗"
    Write-Status "info" "Check artifacts in mobile/artifacts/ for details"
}
Write-Host ""

exit $testResult
