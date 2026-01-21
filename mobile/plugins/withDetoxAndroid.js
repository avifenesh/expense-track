/**
 * Expo Config Plugin for Detox Android Setup
 *
 * Adds the necessary Android instrumentation for Detox E2E tests:
 * 1. Modifies android/settings.gradle with Detox maven repository (modern Gradle)
 * 2. Modifies android/build.gradle (root) with Detox maven repository (legacy fallback)
 * 3. Modifies android/app/build.gradle with test configuration
 * 4. Creates DetoxTest.java in androidTest directory
 */
const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withSettingsGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Modify android/settings.gradle to add Detox maven repository
 * Modern Gradle uses dependencyResolutionManagement in settings.gradle
 */
function withDetoxSettingsGradle(config) {
  return withSettingsGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Add Detox maven repository to dependencyResolutionManagement.repositories
    if (!contents.includes('Detox-android')) {
      // Look for dependencyResolutionManagement block
      if (contents.includes('dependencyResolutionManagement')) {
        contents = contents.replace(
          /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{/,
          (match) => `${match}
        maven {
            url(new File(["node_modules", "detox", "Detox-android"].join(File.separator)))
            content {
                includeGroup("com.wix")
            }
        }`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Modify android/build.gradle (root) to add Detox maven repository
 * Legacy fallback for older Gradle configurations
 */
function withDetoxRootBuildGradle(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Add Detox maven repository to allprojects.repositories (if exists)
    if (!contents.includes('Detox-android')) {
      if (contents.includes('allprojects')) {
        contents = contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {
    repositories {
        maven {
            url("$rootDir/../node_modules/detox/Detox-android")
        }`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Modify android/app/build.gradle for Detox
 */
function withDetoxBuildGradle(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Add testBuildType and testInstrumentationRunner to defaultConfig
    if (!contents.includes('testInstrumentationRunner')) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {
        testBuildType System.getProperty('testBuildType', 'debug')
        testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'`
      );
    }

    // Add androidTestImplementation for Detox
    if (!contents.includes("androidTestImplementation('com.wix:detox:+')")) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    androidTestImplementation('com.wix:detox:+')
    androidTestImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test:runner:1.4.0'
    androidTestImplementation 'androidx.test:rules:1.4.0'
    androidTestImplementation 'androidx.test.ext:junit:1.1.3'`
      );
    }

    // Add ProGuard rules for release builds
    if (!contents.includes('proguard-rules-app.pro')) {
      contents = contents.replace(
        /buildTypes\s*\{\s*release\s*\{/,
        `buildTypes {
        release {
            proguardFile "\${rootProject.projectDir}/../node_modules/detox/android/detox/proguard-rules-app.pro"`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

/**
 * Create DetoxTest.java file
 */
function withDetoxTestFile(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android?.package || 'app.balancebeacon.mobile';

      // Create androidTest directory structure
      const androidTestDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'androidTest',
        'java',
        ...packageName.split('.')
      );

      fs.mkdirSync(androidTestDir, { recursive: true });

      // Create DetoxTest.java content
      const detoxTestContent = `package ${packageName};

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
    @Rule
    public ActivityTestRule<MainActivity> mActivityRule = new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
        detoxConfig.rnContextLoadTimeoutSec = (BuildConfig.DEBUG ? 180 : 60);

        Detox.runTests(mActivityRule, detoxConfig);
    }
}
`;

      // Write DetoxTest.java
      const detoxTestPath = path.join(androidTestDir, 'DetoxTest.java');
      fs.writeFileSync(detoxTestPath, detoxTestContent);

      return config;
    },
  ]);
}

/**
 * Main plugin export
 */
module.exports = function withDetoxAndroid(config) {
  config = withDetoxSettingsGradle(config);
  config = withDetoxRootBuildGradle(config);
  config = withDetoxBuildGradle(config);
  config = withDetoxTestFile(config);
  return config;
};
