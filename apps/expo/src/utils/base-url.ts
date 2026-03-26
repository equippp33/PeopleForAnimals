import Constants from "expo-constants";

/**
 * Returns the base URL for the API.
 * In production, this returns the production deployment URL.
 * In development, it returns the local development server URL.
 */
export const getBaseUrl = () => {
  // For production builds, prefer the API_URL environment variable (set via EAS) and fall back to the default URL
  if (process.env.NODE_ENV === "production") {
    return process.env.API_URL ?? "https://abc-arv.in";
  }

  // For development, use the local server
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
    throw new Error(
      "Failed to get localhost. Please point to your production server.",
    );
  }
  return `http://${localhost}:3000`;
};
