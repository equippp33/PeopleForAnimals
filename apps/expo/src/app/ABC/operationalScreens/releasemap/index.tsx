import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AppState,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { api } from "~/utils/api";
import { useTranslation } from "~/utils/LanguageContext";
import { Feather, Ionicons, AntDesign } from "@expo/vector-icons";
import { addSeconds, format } from "date-fns";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 40;
const MAX_SLIDE = SLIDER_WIDTH - 60;
const SLIDE_THRESHOLD = MAX_SLIDE * 0.7; // Lowered to 70% for smoother triggering
const ARRIVAL_RADIUS = 50; // meters, threshold for considering user has arrived
const CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes

// Mock task data (for fallback)
const mockTask = {
  id: "mock-task-id",
  taskType: "release",
  status: "pending",
  createdAt: new Date(),
  location: {
    id: "mock-location-id",
    name: "Mock Location",
    area: "Mock Area",
    notes: "Mock notes about the location",
    coordinates: {
      lat: 37.7749,
      lng: -122.4194,
    },
    circles: [
      {
        name: "Mock Circle",
        circleName: "Mock Circle",
        coordinates: {
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    ],
    volunteers: [
      {
        name: "John Doe",
        phoneNumber: "+1234567890",
        circleName: "Mock Circle",
      },
    ],
  },
  team: {
    id: "mock-team-id",
    name: "Mock Team",
  },
};

// Haversine formula to calculate distance between two coordinates (in meters)
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const TaskScreen = () => {
  const { taskId } = useLocalSearchParams();

  const { language, t } = useTranslation();
  const pickLang = (en: string, hi?: string, te?: string) =>
    language === "hi" ? (hi ?? en) : language === "te" ? (te ?? en) : en;

  // Fetch release task data
  const {
    data: releaseTask,
    isLoading: isReleaseLoading,
    error: releaseError,
    refetch,
  } = api.task.getReleaseById.useQuery(taskId as string, {
    enabled: Boolean(taskId),
  });

  const circleName =
    releaseTask?.circle?.name ?? releaseTask?.location.circles?.[0]?.circleName ?? "Circle";
  // Reanimated 3 shared values
  const dragX = useSharedValue(0);
  const carPositionX = useSharedValue(0); // For car animation
  const surgeryCompletedAt = releaseTask?.surgeryTaskCompleted as string | undefined;
  const dogsReceived = (releaseTask as any)?.dogsReceived ?? 0;
  const doctorComments = (releaseTask as any)?.batchReleaseRemarks?.trim() || "";
  const isReady = !!releaseTask && !isReleaseLoading;
  const [error, setError] = useState<string | null>(null);
  const [taskStarted, setTaskStarted] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<string>("Calculating...");
  const [duration, setDuration] = useState<string>("Calculating...");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [distanceInMeters, setDistanceInMeters] = useState<number>(0);
  const [initialDistance, setInitialDistance] = useState<number>(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExpanded, setIsExpanded] = useState(false);
  const isSliderLocked = useRef(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const [isSliderReady, setIsSliderReady] = useState(false);

  const snapPoints = useMemo(() => ["50%"], []);

  // Update release task status mutation
  const updateReleaseStatus = api.task.updateReleaseStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => {
      setError("Failed to update task status");
    },
  });

  // Mutation for calculating distance
  const calculateDistanceMutation = api.location.calculateDistance.useMutation();

  // Update current time for real-time expected arrival
  useEffect(() => {
    let lastKnownTime = new Date();
    setCurrentTime(lastKnownTime);

    const updateTime = () => {
      const now = new Date();
      if (Math.abs(now.getTime() - lastKnownTime.getTime()) > 1000) {
        setCurrentTime(now);
      }
      lastKnownTime = now;
    };

    const interval = setInterval(updateTime, 1000);
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") updateTime();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  // Calculate expected arrival time
  const expectedArrivalTime = useMemo(() => {
    console.log("expectedArrivalTime calculation:", { durationSeconds, currentTime: currentTime.toISOString() });
    if (durationSeconds !== null && durationSeconds !== undefined && durationSeconds >= 0) {
      const arrivalTime = addSeconds(currentTime, durationSeconds);
      console.log("Calculated arrival time:", format(arrivalTime, "hh:mm a"));
      return format(arrivalTime, "hh:mm a");
    }
    console.log("Returning Calculating...");
    return "Calculating...";
  }, [durationSeconds, currentTime]);

  // Load cached distance and duration
  const loadCachedData = useCallback(async (cacheKey: string) => {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log("Loading cached data:", data);
          setDistance(data.distance);
          setDuration(data.duration);
          setDurationSeconds(data.durationSeconds);
          setDistanceInMeters(data.distanceInMeters);
          setInitialDistance(data.distanceInMeters);
          console.log("Cached durationSeconds set to:", data.durationSeconds);
          return true;
        }
      }
    } catch (err) {
      console.error("Failed to load cached data:", err);
    }
    return false;
  }, []);

  // Save distance and duration to cache
  const saveCachedData = useCallback(async (cacheKey: string, data: any) => {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err) {
      console.error("Failed to save cached data:", err);
    }
  }, []);

  // Fetch initial distance and duration with retry
  const fetchDistanceAndDuration = useCallback(async () => {
    console.log("fetchDistanceAndDuration called");
    setIsFetching(true);
    let fallbackOrigin: { lat: number; lng: number } | null = null;
    let fallbackDestination: { lat: number; lng: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission denied");
      }

      const location =
        (await Location.getLastKnownPositionAsync()) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      setUserLocation(location);

      fallbackOrigin = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      const selectedCircle =
        releaseTask?.location.circles?.find((c) => c.circleName === circleName) ||
        mockTask.location.circles[0];

      if (!(selectedCircle && "coordinates" in selectedCircle && typeof (selectedCircle as any).coordinates?.lat === "number" && typeof (selectedCircle as any).coordinates?.lng === "number")) {
        throw new Error("No valid coordinates found for the selected circle");
      }

      const coords = (selectedCircle as { coordinates: { lat: number; lng: number } }).coordinates;
      const cacheKey = `distance_${location.coords.latitude}_${location.coords.longitude}_to_${coords.lat}_${coords.lng}`;
      fallbackDestination = {
        lat: coords.lat,
        lng: coords.lng,
      };

      const cached = await loadCachedData(cacheKey);
      if (cached) {
        setIsFetching(false);
        return;
      }

      console.log('Fetching distance data...');
      let result;

      try {
        // Try backend tRPC endpoint first
        console.log('Trying backend API...');
        result = await calculateDistanceMutation.mutateAsync({
          origin: {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          },
          destination: {
            lat: coords.lat,
            lng: coords.lng,
          },
        });
        console.log('Backend API response:', result);
      } catch (backendError) {
        console.log('Backend unavailable, using direct API call');

        // Fallback to direct API call if backend fails
        const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${location.coords.latitude},${location.coords.longitude}&destinations=${coords.lat},${coords.lng}&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== "OK") {
          throw new Error(`Google Maps API error: ${data.status}`);
        }

        const element = data.rows?.[0]?.elements?.[0];
        if (element?.status !== "OK") {
          throw new Error("Unable to calculate distance");
        }

        result = {
          distance: {
            text: element.distance.text,
            value: element.distance.value,
          },
          duration: {
            text: element.duration.text,
            value: element.duration.value,
          },
        };
        console.log('Direct API response:', result);
      }

      const travelInfo = {
        distance: result.distance.text,
        duration: result.duration.text,
        durationSeconds: result.duration.value,
        distanceInMeters: result.distance.value,
      };

      console.log("Setting travel info:", travelInfo);
      setDistance(travelInfo.distance);
      setDuration(travelInfo.duration);
      setDurationSeconds(travelInfo.durationSeconds);
      setDistanceInMeters(travelInfo.distanceInMeters);
      setInitialDistance(travelInfo.distanceInMeters);
      console.log("🚗 Initial distance set for car animation:", travelInfo.distanceInMeters, "meters");
      console.log("durationSeconds set to:", travelInfo.durationSeconds);

      await saveCachedData(cacheKey, travelInfo);
    } catch (err: any) {
      console.error("Failed to fetch distance and duration:", err);

      const message = typeof err?.message === "string" ? err.message : "";

      // For Google Maps key / request issues, fall back silently without scary error text
      if (
        message.includes("Google Maps API error") ||
        message.includes("REQUEST_DENIED")
      ) {
        // Clear any previous error so the UI doesn't show a red message
        setError(null);
      } else if (message) {
        // Show a softer, generic message for other failures (network, permissions, etc.)
        setError("Unable to fetch live distance. Showing an estimate.");
      } else {
        setError(null);
      }

      // Haversine-based fallback using same coordinates, so values are still dynamic per task
      if (fallbackOrigin && fallbackDestination) {
        const distanceMeters = haversineDistance(
          fallbackOrigin.lat,
          fallbackOrigin.lng,
          fallbackDestination.lat,
          fallbackDestination.lng,
        );
        const distanceKm = distanceMeters / 1000;

        // Duration estimate at ~30km/h (same as backend fallback)
        const avgSpeedMetersPerSecond = (30 * 1000) / 3600;
        const rawSeconds = distanceMeters / avgSpeedMetersPerSecond;
        const fallbackDurationSeconds = Math.max(60, Math.round(rawSeconds));

        const totalMinutes = Math.round(fallbackDurationSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        let durationText: string;
        if (hours > 0 && minutes > 0) {
          durationText = `${hours} hr ${minutes} min`;
        } else if (hours > 0) {
          durationText = `${hours} hr`;
        } else {
          durationText = `${minutes} min`;
        }

        setDistance(`${distanceKm.toFixed(1)} km`);
        setDuration(durationText);
        setDurationSeconds(fallbackDurationSeconds);
        setDistanceInMeters(distanceMeters);
        setInitialDistance(distanceMeters);
      } else {
        // Absolute last-resort fixed fallback if we couldn't even get coordinates
        setDistance("5 km");
        setDuration("10 mins");
        setDurationSeconds(10 * 60);
        setDistanceInMeters(5000);
        setInitialDistance(5000);
      }
    } finally {
      setIsFetching(false);
    }
  }, [releaseTask, circleName, loadCachedData, saveCachedData]);

  // Real-time location tracking and car animation
  useEffect(() => {
    if (!taskStarted || !releaseTask?.location || !circleName) return;

    const selectedCircle =
      releaseTask.location.circles?.find((c) => c.circleName === circleName) ||
      mockTask.location.circles[0];

    if (!selectedCircle?.coordinates) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 1000,
        },
        (location) => {
          setUserLocation(location);

          const coords = (selectedCircle as { coordinates: { lat: number; lng: number } }).coordinates;
          const remainingDistance = haversineDistance(
            location.coords.latitude,
            location.coords.longitude,
            coords.lat,
            coords.lng,
          );

          setDistanceInMeters(remainingDistance);

          // Update distance text based on remaining distance
          if (remainingDistance >= 1000) {
            setDistance(`${(remainingDistance / 1000).toFixed(1)} km`);
          } else {
            setDistance(`${Math.round(remainingDistance)} m`);
          }

          // Update duration based on remaining distance (assuming ~30km/h average speed)
          const avgSpeedMetersPerSecond = (30 * 1000) / 3600;
          const estimatedSeconds = Math.max(60, Math.round(remainingDistance / avgSpeedMetersPerSecond));
          setDurationSeconds(estimatedSeconds);

          const totalMinutes = Math.round(estimatedSeconds / 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;

          let durationText: string;
          if (hours > 0 && minutes > 0) {
            durationText = `${hours} hr ${minutes} min`;
          } else if (hours > 0) {
            durationText = `${hours} hr`;
          } else {
            durationText = `${minutes} min`;
          }
          setDuration(durationText);

          // Car animation based on actual distance covered
          if (initialDistance > 0 && remainingDistance >= 0) {
            // Calculate how much distance has been covered (0 to 1)
            const distanceCovered = Math.max(0, initialDistance - remainingDistance);
            const progress = Math.max(0, Math.min(1, distanceCovered / initialDistance));

            // Move car smoothly based on actual progress
            const carPosition = progress * MAX_SLIDE;

            // Use smooth timing for realistic movement
            carPositionX.value = withTiming(carPosition, {
              duration: 500, // Slightly longer for smoother movement
            });

            console.log(`🚗 Car Animation - Initial: ${initialDistance}m, Remaining: ${remainingDistance}m, Covered: ${distanceCovered}m, Progress: ${(progress * 100).toFixed(1)}%, CarPos: ${carPosition.toFixed(1)}px`);
          }

          // Handle arrival
          if (remainingDistance <= ARRIVAL_RADIUS && !hasArrived) {
            setHasArrived(true);
            // Ensure car reaches the end
            carPositionX.value = withTiming(MAX_SLIDE, { duration: 300 });
            console.log(`🏁 Arrived! Car moved to end position: ${MAX_SLIDE}px`);
          }
        },
      );
    })();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [taskStarted, releaseTask, circleName, initialDistance, hasArrived]);

  // Fetch distance and duration when the screen is focused
  useFocusEffect(
    useCallback(() => {
      dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
      setError(null);
      fetchDistanceAndDuration();
    }, [fetchDistanceAndDuration, dragX]),
  );

  // Initialize slider readiness after task loads
  useEffect(() => {
    if (!isReleaseLoading && releaseTask) {
      setIsSliderReady(false);
      setTaskStarted(false);
      isSliderLocked.current = false;
      dragX.value = 0;
      carPositionX.value = 0; // Car starts at beginning

      if (releaseTask?.status === "ongoing") {
        setTaskStarted(true);
        isSliderLocked.current = true;
        dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
        // Car position will be updated by location tracking
        console.log(" Task ongoing - car position will be updated by GPS");
      } else {
        console.log(" Task not started - car at starting position");
      }

      setTimeout(() => {
        setIsSliderReady(true);
      }, 100);
    }
  }, [releaseTask, isReleaseLoading]);

  // Helper to navigate to dog list
  const navigateToDogList = useCallback(() => {
    if (!releaseTask) {
      return;
    }

    router.navigate({
      pathname: "/ABC/operationalScreens/releaseDogList",
      params: {
        batchId: releaseTask.batchId ?? "",
        circleId: releaseTask.circleId ?? "",
        circleName,
        distance,
        duration,
        distanceInMeters: distanceInMeters.toString(),
      },
    });
  }, [releaseTask, circleName, distance, duration, distanceInMeters]);

  const handleReopenMaps = useCallback(async () => {
    if (!releaseTask?.location) {
      setError("No task data available");
      return;
    }

    const selectedCircle =
      releaseTask.location.circles?.find((c) => c.circleName === circleName) ||
      mockTask.location.circles[0];

    if (!selectedCircle?.coordinates) {
      setError(`No coordinates found for circle: ${circleName}`);
      return;
    }

    const coords = (selectedCircle as { coordinates: { lat: number; lng: number } }).coordinates;
    const browserUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;

    try {
      if (Platform.OS === "ios") {
        const googleMapsUrl = `comgooglemaps://?daddr=${coords.lat},${coords.lng}&directionsmode=driving`;
        const appleMapsUrl = `http://maps.apple.com/?daddr=${coords.lat},${coords.lng}&dirflg=d`;

        const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
        const canOpenAppleMaps = await Linking.canOpenURL(appleMapsUrl);

        if (canOpenGoogleMaps) {
          await Linking.openURL(googleMapsUrl);
        } else if (canOpenAppleMaps) {
          await Linking.openURL(appleMapsUrl);
        } else {
          await Linking.openURL(browserUrl);
        }
      } else {
        const googleMapsUrl = `comgooglemaps://?daddr=${coords.lat},${coords.lng}&directionsmode=driving`;
        const googleNavigationUrl = `google.navigation:q=${coords.lat},${coords.lng}&mode=d`;
        const geoUrl = `geo:${coords.lat},${coords.lng}?q=${coords.lat},${coords.lng}`;

        if (await Linking.canOpenURL(googleMapsUrl)) {
          await Linking.openURL(googleMapsUrl);
        } else if (await Linking.canOpenURL(googleNavigationUrl)) {
          await Linking.openURL(googleNavigationUrl);
        } else if (await Linking.canOpenURL(geoUrl)) {
          await Linking.openURL(geoUrl);
        } else {
          await Linking.openURL(browserUrl);
        }
      }
    } catch (err) {
      setError("Unable to open maps");
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        subscription.remove();
      }
    });
  }, [releaseTask, circleName, navigateToDogList]);

  const handleStartTask = useCallback(() => {
    if (!releaseTask?.location) {
      setError("No task data available");
      return;
    }

    const selectedCircle =
      releaseTask.location.circles?.find((c) => c.circleName === circleName) ||
      mockTask.location.circles[0];

    if (!selectedCircle?.coordinates) {
      setError(`No coordinates found for circle: ${circleName}`);
      return;
    }

    setTaskStarted(true);
    isSliderLocked.current = true;

    updateReleaseStatus.mutate({
      taskId: releaseTask.id,
      status: "ongoing",
    });

    void handleReopenMaps();

    dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
  }, [releaseTask, circleName, updateReleaseStatus, handleReopenMaps, dragX]);

  // Modern Gesture API
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (!isSliderReady || taskStarted || isSliderLocked.current) return;

      const translationX = Math.max(0, Math.min(event.translationX, MAX_SLIDE));
      dragX.value = translationX;

      // Check if we've reached the threshold
      if (translationX >= SLIDE_THRESHOLD && !taskStarted) {
        if (!isReady || !releaseTask?.location) {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
          runOnJS(setError)("Please wait while we load the task data");
          return;
        }

        const selectedCircle =
          releaseTask.location.circles?.find((c) => c.circleName === circleName) ||
          mockTask.location.circles[0];

        if (!selectedCircle?.coordinates) {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
          runOnJS(setError)(`No coordinates found for circle: ${circleName}`);
          return;
        }

        dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
        runOnJS(handleStartTask)();
      }
    })
    .onEnd((event) => {
      'worklet';
      if (!isSliderReady || taskStarted || isSliderLocked.current) return;

      if (event.translationX >= SLIDE_THRESHOLD) {
        dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
        runOnJS(handleStartTask)();
      } else {
        dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    })
    .enabled(isSliderReady && !taskStarted && !isSliderLocked.current);

  // Animated styles using Reanimated 3
  const sliderBackgroundStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      dragX.value,
      [0, SLIDE_THRESHOLD],
      ["#D1E6FF", "#2f89ff8b"]
    );
    return { backgroundColor };
  });

  const sliderHandleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: dragX.value }],
    };
  });

  const carAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: carPositionX.value }],
    };
  });

  const circleVolunteers = useMemo(() => {
    const circle =
      releaseTask?.location.circles?.find((c) => c.circleName === circleName) ||
      mockTask.location.circles.find((c) => c.circleName === circleName);
    return circle && "volunteers" in circle && Array.isArray((circle as any).volunteers)
      ? ((circle as any).volunteers as any[])
      : [];
  }, [releaseTask, circleName]);

  if (isReleaseLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>{t("Loading...")}</Text>
      </View>
    );
  }

  if (!releaseTask?.location) {
    return (
      <View className="flex-1 items-center justify-center gap-2">
        <AntDesign name="exclamation-circle" size={24} color="black" />
        <Text>{t("No location data available. Please try again later!")}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View className="relative left-4 top-3 z-10 mb-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-2"
        >
          <Feather name="chevron-left" size={28} color="black" />
          <Text className="text-xl font-semibold">{t("Back")}</Text>
        </TouchableOpacity>
      </View>

      <View
        className="mx-4 mt-6"
        style={{
          borderWidth: 0.5,
          borderColor: "#00A5FF",
          borderRadius: 16,
        }}
      >
        <LinearGradient
          colors={["white", "#00A5FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 5 }}
          style={{
            borderRadius: 16,
          }}
          className="px-4 py-5"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={20} color="#1B85F3" />
              <View className="flex-col justify-center">
                <Text
                  className="text-base font-semibold text-black"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {(() => {
                    const circle = releaseTask.location.circles?.find(
                      (c: any) => c.circleName === circleName || (c).name === circleName,
                    );
                    if (circle) {
                      const baseName =
                        (circle as any).name ??
                        (circle as any).circleName ??
                        circleName;
                      return pickLang(
                        baseName,
                        (circle as any).hiCircleName ?? undefined,
                        (circle as any).teCircleName ?? undefined,
                      );
                    }
                    return (
                      circleName ||
                      pickLang(
                        releaseTask.location.name ?? "N/A",
                        (releaseTask.location as any).hi_name ?? undefined,
                        (releaseTask.location as any).te_name ?? undefined,
                      )
                    );
                  })()}
                </Text>
                <Text className="text-sm font-semibold text-black">
                  {isFetching ? "(Calculating...)" : `(${distance || "N/A"})`}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-3 rounded-2xl p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-col  justify-center">
                <Text className="text-sm font-medium text-black mb-2">{t("Circle Volunteers")}</Text>

                <ScrollView
                  style={{ maxHeight: 120 }}
                  scrollEnabled={circleVolunteers.length > 1}
                  showsVerticalScrollIndicator={false}
                >
                  {circleVolunteers.length > 0 ? (
                    circleVolunteers.map((volunteer, index) => (
                      <View key={index} className="mb-2 flex-row gap-1">
                        <Text className="text-sm font-semibold text-black">
                          {volunteer.name} -
                        </Text>
                        <Text className="text-sm font-semibold text-black">
                          {volunteer.phoneNumber}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text className="mb-2 text-sm font-medium text-[#606873]">
                      {t("No volunteers assigned")}
                    </Text>
                  )}
                </ScrollView>
              </View>

              <View className="ml-8 flex-row items-center justify-between gap-2">
                <View className="flex-row items-center justify-center gap-2 rounded-3xl border border-[#1B85F3] p-2">
                  <AntDesign name="clock-circle" size={16} color="#1B85F3" />
                  <Text className="text-sm font-medium text-[#1B85F3]">
                    {isFetching ? "Calculating..." : duration || "N/A"}
                  </Text>
                </View>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-black">{t("Doctor Comments")}</Text>
              <Text className="text-sm font-medium text-[#606873] mt-1">
                {doctorComments ? t(doctorComments) : t("No comments to show")}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Custom Bottom Sheet View Replacement */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: SCREEN_HEIGHT * 0.5,
          backgroundColor: "#fefefe",
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -52 },
          shadowOpacity: 0.4,
          shadowRadius: 52,
          elevation: 18,
        }}
      >
        {/* Handle Indicator */}
        <View
          style={{
            alignItems: "center",
            paddingTop: 10,
            paddingBottom: 10,
          }}
        >
          <View
            style={{
              backgroundColor: "#00000099",
              width: 56,
              height: 7,
              borderRadius: 3.5,
            }}
          />
        </View>

        {/* Content Container - Replaces BottomSheetView */}
        <View
          style={{
            flex: 1,
            backgroundColor: "#fefefe",
            marginHorizontal: 20,
            gap: 6,
            paddingBottom: 40,
          }}
        >
          <View className="mb-4 mt-4 flex-row items-center justify-between px-2">
            <Text className="text-sm font-medium text-black">
              {isFetching ? t("Fetching...") : distance || t("Calculating...")}
            </Text>
            <View className="absolute left-1/2 -translate-x-1/3">
              <Text className="text-sm font-semibold text-black">
                {isFetching ? t("Fetching...") : duration || t("Calculating...")}
              </Text>
            </View>
            <Text className="text-sm font-medium text-black">
              {isFetching ? t("Fetching...") : expectedArrivalTime}
            </Text>
          </View>

          <View className="relative mb-4 flex-row items-center px-2">
            <View
              style={{
                height: 8,
                width: "100%",
                backgroundColor: "#D1E6FF",
                borderRadius: 8,
              }}
            />
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: -10,
                  zIndex: 10,
                },
                carAnimatedStyle,
              ]}
            >
              <Image
                source={require("../../../../../assets/images/car.png")}
                style={{
                  width: 28,
                  height: 28,
                }}
              />
            </Animated.View>
          </View>

          <View>
            <View className="mb-2 flex-row items-center justify-between gap-4 px-2">
              <Text className="text-xl font-semibold">{t("Release task")}</Text>
              <View style={{ flex: 1, maxWidth: "60%" }}>
                <Text
                  className="text-right text-xl font-semibold"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {(() => {
                    const circle = releaseTask.location.circles?.find(
                      (c: any) => c.circleName === circleName || (c).name === circleName,
                    );
                    if (circle) {
                      const baseName =
                        (circle as any).name ??
                        (circle as any).circleName ??
                        circleName;
                      return pickLang(
                        baseName,
                        (circle as any).hiCircleName ?? undefined,
                        (circle as any).teCircleName ?? undefined,
                      );
                    }
                    return (
                      circleName ||
                      pickLang(
                        releaseTask.location.name ?? "N/A",
                        (releaseTask.location as any).hi_name ?? undefined,
                        (releaseTask.location as any).te_name ?? undefined,
                      )
                    );
                  })()}
                </Text>
              </View>
            </View>

            <View className="mt-4 gap-3 px-2">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium text-gray-400">{t("Dogs received")}</Text>
                <Text className="text-sm font-medium text-black">{dogsReceived}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium text-gray-400">{t("Date & Time")}</Text>
                <Text className="text-sm font-medium text-black">
                  {surgeryCompletedAt && (
                    <>
                      {`${format(new Date(surgeryCompletedAt), "MMM do, yyyy")}`} (
                      {format(new Date(surgeryCompletedAt), "hh:mm a")})
                    </>
                  )}
                </Text>
              </View>
            </View>
          </View>

          {error && (
            <Text className="mt-2 text-sm text-red-500 text-center">{error}</Text>
          )}

          <View className="mt-4">
            {taskStarted && (
              <TouchableOpacity
                onPress={handleReopenMaps}
                className="mb-6 items-end justify-center"
              >
                <Text className="text-right text-base font-medium text-blue-500">
                  {t("Reopen Maps?")}
                </Text>
              </TouchableOpacity>
            )}

            {taskStarted ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={navigateToDogList}
                style={{
                  backgroundColor: "#2F88FF",
                  borderRadius: 15,
                  height: 54,
                  width: SLIDER_WIDTH,
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#2F88FF",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t("Continue to Release")}
                </Text>
              </TouchableOpacity>
            ) : (
              <Animated.View
                style={[
                  {
                    height: 54,
                    width: SLIDER_WIDTH,
                    borderRadius: 15,
                    overflow: "hidden",
                  },
                  sliderBackgroundStyle,
                ]}
              >
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-base font-medium text-black">
                    {t("Go to task")}
                  </Text>
                </View>

                <GestureDetector gesture={panGesture}>
                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        height: "100%",
                        width: 70,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#2F88FF",
                        borderRadius: 15,
                      },
                      sliderHandleStyle,
                    ]}
                  >
                    <View className="flex-row items-center justify-center gap-0 px-2">
                      <Ionicons
                        name="chevron-forward-outline"
                        size={16}
                        className="relative left-3.5"
                        color="#FFFFFF99"
                      />
                      <Ionicons
                        name="chevron-forward-outline"
                        size={26}
                        color="white"
                      />
                    </View>
                  </Animated.View>
                </GestureDetector>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

export default React.memo(TaskScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});