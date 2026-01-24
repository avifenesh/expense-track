#!/usr/bin/env node
/**
 * E2E Test Runner Script
 * Sets up Android SDK environment variables before running Detox tests
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Set up Android SDK paths
if (process.platform === 'win32') {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const androidSdkPath = path.join(localAppData, 'Android', 'Sdk');

  // Also check common alternative locations
  const altPath = path.join(os.homedir(), 'Android', 'Sdk');

  const fs = require('fs');
  let sdkPath = null;

  if (fs.existsSync(androidSdkPath)) {
    sdkPath = androidSdkPath;
  } else if (fs.existsSync(altPath)) {
    sdkPath = altPath;
  }

  if (sdkPath) {
    process.env.ANDROID_SDK_ROOT = sdkPath;
    process.env.ANDROID_HOME = sdkPath;
    console.log(`[E2E Setup] ANDROID_SDK_ROOT set to: ${sdkPath}`);

    // Add platform-tools to PATH for adb
    const platformTools = path.join(sdkPath, 'platform-tools');
    process.env.PATH = `${platformTools}${path.delimiter}${process.env.PATH}`;
  } else {
    console.error('[E2E Setup] Warning: Android SDK not found');
  }
}

// Get configuration from args (default to android.emu.release)
const args = process.argv.slice(2);
let config = 'android.emu.release';

const configIndex = args.findIndex(arg => arg === '--configuration' || arg === '-c');
if (configIndex !== -1 && args[configIndex + 1]) {
  config = args[configIndex + 1];
  args.splice(configIndex, 2);
}

// Build detox command
const detoxArgs = ['test', '--configuration', config, ...args];

console.log(`[E2E Setup] Running: detox ${detoxArgs.join(' ')}`);

// Run detox
const detox = spawn('npx', ['detox', ...detoxArgs], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

detox.on('close', (code) => {
  process.exit(code);
});
