export default ({ config }: any) => ({
  ...config,
  name: "People For Animals",
  slug: "people-for-animals",
  scheme: "peopleforanimals",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/app_icon-1.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/app_icon-1.png",
    resizeMode: "contain",
  },
  updates: {
    url: "https://u.expo.dev/0da834f9-a57c-4050-a658-a945c885f12a",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  assetBundlePatterns: ["**/*", "./assets/fonts/*"],
  ios: {
    bundleIdentifier: "com.peopleforanimals.app",
    supportsTablet: true,
    icon: "./assets/images/app_icon-1.png",
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    },
    infoPlist: {
      LSApplicationQueriesSchemes: ["googlemaps", "comgooglemaps"],
    },
  },
  android: {
    package: "com.peopleforanimals.app",

    adaptiveIcon: {
      foregroundImage: "./assets/images/app_icon-1.png",
      backgroundColor: "#1F104A",
    },
    jsEngine: "hermes",
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "INTERNET",
      "ACCESS_NETWORK_STATE",
    ],
  },
  extra: {
    eas: {
      projectId: "0da834f9-a57c-4050-a658-a945c885f12a",
    },
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
  },
  owner: "equipppdeveloper",
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    ["@react-native-community/datetimepicker", { mode: "spinner" }],
    [
      "expo-camera",
      { cameraPermission: "Allow $(PRODUCT_NAME) to access your camera" },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "The app accesses your photos to let you share them with your friends.",
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
        savePhotosPermission:
          "Allow $(PRODUCT_NAME) to save photos to your gallery.",
      },
    ],
    "expo-location",
    "expo-font",
    "expo-web-browser",
    "expo-splash-screen",
  ],
});
