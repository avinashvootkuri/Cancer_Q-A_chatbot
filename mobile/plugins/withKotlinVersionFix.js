const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

const KOTLIN_VERSION = '1.9.25';

const withKotlinVersionFix = (config) => {
  // Step 1: Add properties to gradle.properties
  config = withGradleProperties(config, (config) => {
    // Remove any existing kotlin version properties first
    config.modResults = config.modResults.filter(
      (item) => item.type !== 'property' || 
        !['kotlinVersion', 'kotlin.version', 'android.kotlinVersion'].includes(item.key)
    );
    
    // Add the correct Kotlin version properties
    config.modResults.push(
      { type: 'property', key: 'android.kotlinVersion', value: KOTLIN_VERSION },
      { type: 'property', key: 'kotlinVersion', value: KOTLIN_VERSION },
      { type: 'property', key: 'kotlin.version', value: KOTLIN_VERSION }
    );
    
    return config;
  });

  // Step 2: Modify build.gradle to force Kotlin version everywhere
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      
      // Replace the kotlinVersion line in ext block to force our version
      contents = contents.replace(
        /kotlinVersion\s*=\s*findProperty\(['"]android\.kotlinVersion['"]\)\s*\?:\s*['"][^'"]+['"]/,
        `kotlinVersion = '${KOTLIN_VERSION}'`
      );
      
      // Force the Kotlin Gradle Plugin version in buildscript dependencies
      contents = contents.replace(
        /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)/,
        `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}")`
      );
      
      // Add resolution strategy in buildscript to force kotlin plugin version
      if (!contents.includes('buildscript') || !contents.includes('resolutionStrategy')) {
        contents = contents.replace(
          /(buildscript\s*\{[\s\S]*?repositories\s*\{[\s\S]*?\})/,
          `$1
    configurations.classpath {
        resolutionStrategy {
            force "org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}"
        }
    }`
        );
      }
      
      // Add resolution strategy in allprojects block
      if (!contents.includes('allprojects') || !contents.match(/allprojects[\s\S]*?resolutionStrategy/)) {
        contents = contents.replace(
          /(allprojects\s*\{\s*\n\s*repositories\s*\{)/,
          `allprojects {
    configurations.all {
        resolutionStrategy {
            force "org.jetbrains.kotlin:kotlin-stdlib:${KOTLIN_VERSION}"
            force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:${KOTLIN_VERSION}"
            force "org.jetbrains.kotlin:kotlin-reflect:${KOTLIN_VERSION}"
        }
    }
    repositories {`
        );
      }
      
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withKotlinVersionFix;
