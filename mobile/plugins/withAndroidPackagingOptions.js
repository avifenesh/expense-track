/**
 * Expo config plugin to fix duplicate native library issue on Android
 *
 * This fixes the error:
 * "2 files found with path 'lib/arm64-v8a/libfbjni.so' from inputs"
 *
 * The issue occurs when building androidTest configurations with
 * react-native-gesture-handler and React Native 0.81+
 *
 * Applies packaging configuration to both app and all library subprojects
 */
const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

function withAndroidPackagingOptions(config) {
  // First, modify the root build.gradle to apply packaging to all subprojects
  config = withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Check if subprojects packaging config already exists
    if (buildGradle.includes('pickFirsts') && buildGradle.includes('libfbjni.so')) {
      return config;
    }

    // Add subprojects block to apply packaging to all library modules
    const subprojectsBlock = `
// Fix duplicate native library (libfbjni.so) in androidTest builds
// Required for react-native-gesture-handler + RN 0.81+
subprojects {
    afterEvaluate { project ->
        if (project.hasProperty('android')) {
            project.android {
                packaging {
                    jniLibs {
                        pickFirsts += ['lib/arm64-v8a/libfbjni.so']
                        pickFirsts += ['lib/x86/libfbjni.so']
                        pickFirsts += ['lib/x86_64/libfbjni.so']
                        pickFirsts += ['lib/armeabi-v7a/libfbjni.so']
                    }
                }
            }
        }
    }
}
`;

    // Append to the end of the file
    config.modResults.contents = buildGradle + '\n' + subprojectsBlock;

    return config;
  });

  // Also add to app build.gradle for completeness
  config = withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Check if packaging options already exist
    if (buildGradle.includes('packaging {') || buildGradle.includes('packagingOptions {')) {
      return config;
    }

    // Add packaging block with jniLibs configuration
    const packagingBlock = `
    packaging {
        jniLibs {
            pickFirsts += ['lib/arm64-v8a/libfbjni.so']
            pickFirsts += ['lib/x86/libfbjni.so']
            pickFirsts += ['lib/x86_64/libfbjni.so']
            pickFirsts += ['lib/armeabi-v7a/libfbjni.so']
        }
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

  return config;
}

module.exports = withAndroidPackagingOptions;
