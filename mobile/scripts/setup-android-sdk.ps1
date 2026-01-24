# Android SDK Setup Script for E2E Testing
# Sets up Android SDK command line tools, emulator, and creates test_avd

$ErrorActionPreference = "Stop"

$SdkPath = "$env:LOCALAPPDATA\Android\Sdk"
$CmdlineToolsPath = "$SdkPath\cmdline-tools\latest"
$PlatformToolsPath = "$SdkPath\platform-tools"
$EmulatorPath = "$SdkPath\emulator"

Write-Host "=== Android SDK Setup for E2E Testing ===" -ForegroundColor Cyan

# Create SDK directory
if (-not (Test-Path $SdkPath)) {
    Write-Host "Creating SDK directory at $SdkPath..."
    New-Item -ItemType Directory -Path $SdkPath -Force | Out-Null
}

# Download command line tools if not present
if (-not (Test-Path $CmdlineToolsPath)) {
    Write-Host "Downloading Android command line tools..."

    $ToolsZipUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    $ToolsZipPath = "$env:TEMP\cmdline-tools.zip"
    $ExtractPath = "$env:TEMP\cmdline-tools-extract"

    # Download
    Write-Host "Downloading from $ToolsZipUrl..."
    Invoke-WebRequest -Uri $ToolsZipUrl -OutFile $ToolsZipPath -UseBasicParsing

    # Extract
    Write-Host "Extracting..."
    if (Test-Path $ExtractPath) { Remove-Item -Recurse -Force $ExtractPath }
    Expand-Archive -Path $ToolsZipPath -DestinationPath $ExtractPath -Force

    # Move to proper location
    $CmdlineToolsDir = "$SdkPath\cmdline-tools"
    if (-not (Test-Path $CmdlineToolsDir)) {
        New-Item -ItemType Directory -Path $CmdlineToolsDir -Force | Out-Null
    }

    Move-Item -Path "$ExtractPath\cmdline-tools" -Destination $CmdlineToolsPath -Force

    # Cleanup
    Remove-Item -Path $ToolsZipPath -Force
    Remove-Item -Path $ExtractPath -Recurse -Force

    Write-Host "Command line tools installed." -ForegroundColor Green
} else {
    Write-Host "Command line tools already present."
}

# Set environment variables for this session
$env:ANDROID_SDK_ROOT = $SdkPath
$env:ANDROID_HOME = $SdkPath
$env:PATH = "$CmdlineToolsPath\bin;$PlatformToolsPath;$EmulatorPath;$env:PATH"

Write-Host "Environment variables set for this session."

# Accept licenses
Write-Host "Accepting licenses..."
$SdkManager = "$CmdlineToolsPath\bin\sdkmanager.bat"

# Create a file with 'y' responses for licenses
$LicenseResponses = "y`ny`ny`ny`ny`ny`ny`ny"
$LicenseResponses | & $SdkManager --licenses 2>$null

# Install required packages
Write-Host "`nInstalling SDK packages (this may take several minutes)..." -ForegroundColor Yellow

$Packages = @(
    "platform-tools",
    "emulator",
    "platforms;android-34",
    "build-tools;34.0.0",
    "system-images;android-34;google_apis;x86_64"
)

foreach ($Package in $Packages) {
    Write-Host "Installing $Package..."
    & $SdkManager --install $Package 2>&1 | Out-Null
}

Write-Host "SDK packages installed." -ForegroundColor Green

# Create AVD
$AvdManager = "$CmdlineToolsPath\bin\avdmanager.bat"
$AvdName = "test_avd"

Write-Host "`nCreating AVD: $AvdName..."

# Delete existing AVD if present
& $AvdManager delete avd -n $AvdName 2>$null

# Create new AVD
$CreateAvdScript = @"
no
"@
$CreateAvdScript | & $AvdManager create avd -n $AvdName -k "system-images;android-34;google_apis;x86_64" -d "pixel_6" --force 2>&1 | Out-Null

Write-Host "AVD '$AvdName' created." -ForegroundColor Green

# Verify installation
Write-Host "`n=== Verification ===" -ForegroundColor Cyan

Write-Host "Checking adb..."
$AdbPath = "$PlatformToolsPath\adb.exe"
if (Test-Path $AdbPath) {
    & $AdbPath version
    Write-Host "adb: OK" -ForegroundColor Green
} else {
    Write-Host "adb: NOT FOUND" -ForegroundColor Red
}

Write-Host "`nChecking emulator..."
$EmulatorExe = "$EmulatorPath\emulator.exe"
if (Test-Path $EmulatorExe) {
    Write-Host "emulator: OK" -ForegroundColor Green
} else {
    Write-Host "emulator: NOT FOUND" -ForegroundColor Red
}

Write-Host "`nChecking AVD..."
$AvdList = & $AvdManager list avd 2>&1
if ($AvdList -match "test_avd") {
    Write-Host "test_avd: OK" -ForegroundColor Green
} else {
    Write-Host "test_avd: NOT FOUND" -ForegroundColor Red
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host @"

To use the Android SDK in new terminal sessions, add these environment variables:

  ANDROID_SDK_ROOT = $SdkPath
  ANDROID_HOME = $SdkPath

And add to PATH:
  $PlatformToolsPath
  $EmulatorPath
  $CmdlineToolsPath\bin

To start the emulator:
  emulator -avd test_avd

"@ -ForegroundColor Gray
