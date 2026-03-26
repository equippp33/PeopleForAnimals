# Distance API Debugging Guide

## Problem Summary
After upgrading to Expo SDK 54, the distance and travel time calculations stopped working in production APK builds, even though they work fine in Expo Dev mode.

## Root Cause Analysis

### Primary Issue: Google Maps Distance Matrix API Architecture
The app is calling the **Google Maps Distance Matrix JSON API directly from the mobile client**, which has several critical problems:

1. **API Design**: This API is designed for **server-side use only**
2. **Network Security**: Android's network security policies in newer SDK versions may block these requests
3. **CORS/Request Blocking**: Google may be blocking direct mobile requests
4. **API Key Exposure**: The API key is exposed in client code (security risk)

### Why It Worked Before
- Older Expo SDK versions had more lenient network policies
- Development mode uses different network stack than production builds
- The API may have been more permissive with mobile requests

### Why It Fails Now (Expo SDK 54)
- Stricter network security configurations
- Enhanced certificate pinning
- Changes to the `fetch` API implementation
- Possible changes to how environment variables are bundled

## Changes Made

### 1. Enhanced Logging (index.tsx)
Added comprehensive logging to diagnose the issue:
- API key presence and length validation
- Request/response status codes
- Full API response data
- Detailed error messages with stack traces
- Timeout handling (10 seconds)

### 2. Improved Error Handling
- Added AbortController for request timeouts
- Better error state management (shows "N/A" or "Error" instead of empty)
- Explicit headers in fetch request
- Separate error logging for different failure types

## How to Debug

### Step 1: Check Logs in Production APK
Build the app and check the console logs:
```bash
# For Android
adb logcat | grep "Distance API"
```

Look for these log messages:
- `[Distance API] Fetching for {key}`
- `[Distance API] API Key present: true/false`
- `[Distance API] Response status: {code}`
- `[Distance API] Response data: {json}`

### Step 2: Verify API Key
Check if the API key is being bundled correctly:
1. Verify `.env` file has `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
2. Check `app.config.ts` is reading the env variable
3. Ensure the key has proper restrictions in Google Cloud Console

### Step 3: Check Google Cloud Console
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Find your API key
3. Check if "Distance Matrix API" is enabled
4. Review API restrictions (HTTP referrers, IP addresses, etc.)
5. Check quota usage and any error logs

## Recommended Solutions

### Solution 1: Create a Backend Proxy (RECOMMENDED)
**Best Practice**: Move the Distance Matrix API calls to your backend server.

#### Benefits:
- ✅ Secure API key storage
- ✅ No client-side exposure
- ✅ Better error handling and retry logic
- ✅ Can cache results to reduce API costs
- ✅ Works reliably across all platforms

#### Implementation:
Create a tRPC endpoint in your backend:

```typescript
// In your backend API
export const locationRouter = createTRPCRouter({
  getDistance: publicProcedure
    .input(z.object({
      origin: z.object({ lat: z.number(), lng: z.number() }),
      destination: z.object({ lat: z.number(), lng: z.number() }),
    }))
    .query(async ({ input }) => {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${input.origin.lat},${input.origin.lng}&destinations=${input.destination.lat},${input.destination.lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status === "OK" && data.rows[0]?.elements[0]?.status === "OK") {
        return {
          distance: data.rows[0].elements[0].distance,
          duration: data.rows[0].elements[0].duration,
        };
      }
      throw new Error(data.error_message || "Failed to fetch distance");
    }),
});
```

Then update your frontend to use this endpoint instead of direct API calls.

### Solution 2: Use Haversine Formula (FALLBACK)
Calculate straight-line distance without API calls:

```typescript
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

**Note**: This gives straight-line distance, not driving distance. For estimated time, use average speed (e.g., 40 km/h in city).

### Solution 3: Check API Key Restrictions
If you want to keep client-side calls (NOT RECOMMENDED):

1. Go to Google Cloud Console
2. Edit your API key restrictions
3. Under "Application restrictions", select "None" temporarily to test
4. Under "API restrictions", ensure "Distance Matrix API" is listed
5. If using Android restrictions, add your app's package name and SHA-1 certificate fingerprint

## Testing Checklist

- [ ] Check console logs for `[Distance API]` messages
- [ ] Verify API key is present and correct length
- [ ] Check Google Cloud Console for API errors
- [ ] Test with API key restrictions temporarily disabled
- [ ] Verify network connectivity in production APK
- [ ] Check if other API calls work (to rule out general network issues)
- [ ] Test on different Android versions
- [ ] Compare behavior between dev and production builds

## Next Steps

1. **Immediate**: Build the APK with enhanced logging and check what errors appear
2. **Short-term**: Implement backend proxy for Distance Matrix API calls
3. **Long-term**: Review all client-side API calls and move sensitive ones to backend

## Additional Resources

- [Google Maps Distance Matrix API Documentation](https://developers.google.com/maps/documentation/distance-matrix)
- [Expo Network Security](https://docs.expo.dev/guides/using-custom-fonts/#network-security-configuration)
- [React Native Network Debugging](https://reactnative.dev/docs/network)

## Contact
If issues persist after trying these solutions, check:
1. Expo SDK 54 breaking changes documentation
2. React Native 0.79.5 network-related changes
3. Consider posting in Expo forums with the console logs
