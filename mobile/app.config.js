module.exports = {
  expo: {
    name: "OncoConnect",
    slug: "cancer-qa-chatbot",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.cancerqa.chatbot"
    },
    android: {
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      package: "com.cancerqa.chatbot",
      permissions: [
        "INTERNET"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    platforms: ["android", "web"],
    extra: {
      apiUrl: "https://cancer-qa-backend-production-64e1.up.railway.app",
      eas: {
        projectId: "5fc9f108-69ce-4bc2-9965-7dfc19d11ca9"
      }
    },
    plugins: [
      "./plugins/withKotlinVersionFix",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0",
            kotlinVersion: "1.9.25"
          }
        }
      ]
    ]
  }
};
