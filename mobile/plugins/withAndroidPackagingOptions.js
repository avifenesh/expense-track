/**
 * Expo config plugin to fix duplicate native library issue on Android
 *
 * This fixes the error:
 * "2 files found with path 'lib/arm64-v8a/libfbjni.so' from inputs"
 *
 * The issue occurs when building androidTest configurations with
 * react-native-gesture-handler and React Native 0.81+
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidPackagingOptions(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Check if packaging options already exist
    if (buildGradle.includes('packagingOptions')) {
      return config;
    }

    // Add packaging options to exclude duplicate .so files
    const packagingBlock = `
    packagingOptions {
        // Fix duplicate native libraries in androidTest
        pickFirst 'lib/arm64-v8a/libfbjni.so'
        pickFirst 'lib/x86/libfbjni.so'
        pickFirst 'lib/x86_64/libfbjni.so'
        pickFirst 'lib/armeabi-v7a/libfbjni.so'
    }
`;

    // Insert after android { block
    const androidBlockRegex = /android\s*\{/;
    if (androidBlockRegex.test(buildGradle)) {
      config.modResults.contents = buildGradle.replace(
        androidBlockRegex,
        `android {\n${packagingBlock}`
      );
    }

    return config;
  });
}

module.exports = withAndroidPackagingOptions;
