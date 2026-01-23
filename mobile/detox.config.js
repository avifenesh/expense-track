/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: process.platform === 'win32' ? 'npx jest' : 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },

  // Save screenshots and logs on test failure
  artifacts: {
    rootDir: 'artifacts',
    plugins: {
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: false,
        takeWhen: {
          testStart: true,
          testDone: true,
        },
      },
      log: {
        enabled: true,
      },
      uiHierarchy: 'enabled',
    },
  },

  // Behavior configuration
  behavior: {
    init: {
      exposeGlobals: true,
    },
    launchApp: 'auto',
    cleanup: {
      shutdownDevice: false,
    },
  },

  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/BalanceBeacon.app',
      build:
        'xcodebuild -workspace ios/BalanceBeacon.xcworkspace -scheme BalanceBeacon -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/BalanceBeacon.app',
      build:
        'xcodebuild -workspace ios/BalanceBeacon.xcworkspace -scheme BalanceBeacon -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build:
        process.platform === 'win32'
          ? 'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..'
          : 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleDebugAndroidTest && cd ..',
    },
  },

  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 15' },
    },
    attached: {
      type: 'android.attached',
      device: { adbName: '.*' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'test_avd' },
    },
  },

  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug',
    },
    'android.att.release': {
      device: 'attached',
      app: 'android.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
