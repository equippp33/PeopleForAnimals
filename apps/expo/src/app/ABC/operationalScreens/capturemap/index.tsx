import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import type MapView from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import {
  AntDesign,
  Feather,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
// Removed BottomSheet imports to fix layout state issues
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addSeconds, format } from "date-fns";

import { api } from "~/utils/api";
import { useTranslation } from "~/utils/LanguageContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 40;
const MAX_SLIDE = SLIDER_WIDTH - 60;
const SLIDE_THRESHOLD = MAX_SLIDE * 0.7; // Lowered to 70% for smoother triggering
const ARRIVAL_RADIUS = 50; // meters, threshold for considering user has arrived
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.5;

interface TaskLocation {
  id: string;
  name: string;
  hi_name?: string;
  te_name?: string;
  area: string;
  notes: string | null;
  hi_notes?: string;
  te_notes?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  circles: {
    name: string;
    hiCircleName?: string;
    teCircleName?: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  }[];
  volunteers: {
    name: string;
    hiName?: string;
    teName?: string;
    phoneNumber: string;
    circleName: string;
    circleCoordinates: {
      lat: number;
      lng: number;
    };
  }[];
}

interface Team {
  id: string;
  name: string;
}

interface Task {
  id: string;
  taskType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  location: TaskLocation;
  team: Team;
}

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
  const { language, t } = useTranslation();
  const pickLang = (en: string, hi?: string, te?: string) =>
    language === "hi" ? (hi ?? en) : language === "te" ? (te ?? en) : en;

  const {
    id,
    circleName: circleNameParam,
    clickedAt: clickedAtParam,
  } = useLocalSearchParams<{
    id?: string;
    circleName?: string;
    clickedAt?: string;
  }>();

  const {
    data: task,
    isLoading,
    refetch,
  } = api.task.getById.useQuery(id!, {
    enabled: !!id,
  });

  // Determine active circle name
  const circleName = useMemo(() => {
    if (
      typeof circleNameParam === "string" &&
      circleNameParam.trim().length > 0
    ) {
      return circleNameParam.trim();
    }
    // fall back to first volunteer's circleName if available
    const vName =
      task?.location &&
      "volunteers" in task.location &&
      (task.location as { volunteers: { circleName?: string }[] })
        ?.volunteers?.[0]?.circleName;
    if (vName && vName.trim().length > 0) return vName.trim();
    // otherwise first circle's name
    return task?.location?.circles?.[0]?.name ?? "";
  }, [circleNameParam, task]);

  // Prefer clickedAt from params, fallback to task.createdAt
  const displayDateTime = useMemo(() => {
    if (typeof clickedAtParam === "string" && Date.parse(clickedAtParam)) {
      const d = new Date(clickedAtParam);
      return `${format(d, "MMM do, yyyy")} (${format(d, "hh:mm a")})`;
    }
    if (task?.createdAt) {
      const d = new Date(task.createdAt);
      return `${format(d, "MMM do, yyyy")} (${format(d, "hh:mm a")})`;
    }
    return "N/A";
  }, [clickedAtParam, task]);

  // Reanimated 3 shared values
  const dragX = useSharedValue(0); // For slider
  const carPositionX = useSharedValue(0); // For car
  const [taskStarted, setTaskStarted] = useState(false);
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [durationInSeconds, setDurationInSeconds] = useState<number | null>(
    null,
  );
  const [distanceInMeters, setDistanceInMeters] = useState<number>(0);
  const [initialDistance, setInitialDistance] = useState<number>(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [isSliderReady, setIsSliderReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const isSliderLocked = useRef(false);
  const hasSubmittedRef = useRef(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );

  const updateTaskStatus = api.task.updateStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => {
      console.error("Failed to update task status:", err);
      setError("Failed to update task status");
    },
  });

  const createBatch = api.task.createBatch.useMutation({
    onSuccess: (data) => {
      if (data.batch) {
        setCurrentBatchId(data.batch.id);
        updateTaskStatus.mutate(
          {
            taskId: id!,
            status: "ongoing",
          },
          {
            onSuccess: () => {
              router.navigate({
                pathname: "/ABC/operationalScreens/capturedog",
                params: {
                  id,
                  location: task?.location?.name,
                  team: task?.team?.name,
                  distance: distance,
                  distanceInMeters: distanceInMeters.toString(),
                  status: "ongoing",
                  requestId: task?.id,
                  dogs: task?.location?.notes,
                  date: new Date().toLocaleDateString(),
                  time: new Date().toLocaleTimeString(),
                  requestedby: task?.team?.name,
                  distanceTime: duration,
                  batchId: data.batch.id,
                },
              });
            },
          },
        );
      }
    },
    onError: (err) => {
      console.error("Failed to create batch:", err);
      setError("Failed to create batch");
    },
  });

  // Mutation for calculating distance
  const calculateDistanceMutation = api.location.calculateDistance.useMutation();

  // Initialize slider readiness after task loads
  useEffect(() => {
    if (!isLoading && task) {
      // Reset states when component mounts or task changes
      setIsSliderReady(false);
      setTaskStarted(false);
      isSliderLocked.current = false;

      // Reset animations
      dragX.value = 0;
      carPositionX.value = 0;

      (async () => {
        try {
          const flag = await AsyncStorage.getItem(`task_started_${task.id}`);
          const hasLocalStarted = flag === "true" && task.status === "ongoing";

          if (hasLocalStarted) {
            setTaskStarted(true);
            isSliderLocked.current = true;
            dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
          }
        } catch (e) {
          console.error("Failed to read task_started flag:", e);
        } finally {
          setTimeout(() => {
            setIsSliderReady(true);
          }, 300);
        }
      })();
    }
  }, [task, isLoading]);

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

  // Fetch initial location and distance data
  useEffect(() => {
    const fetchWithRetry = async (url: string, retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`Fetching distance data (attempt ${i + 1}/${retries})...`);

          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          });

          clearTimeout(timeoutId);
          console.log(`Response status: ${response.status}`);

          if (response.ok) {
            console.log('API request successful');
            return response;
          }

          if (response.status === 429) {
            console.log(`Rate limited, retrying in ${delay * (i + 1)}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
            continue;
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
          console.error(`Attempt ${i + 1} failed:`, error);
          if (i === retries - 1) throw error;
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        }
      }
      throw new Error("Max retries reached");
    };

    (async () => {
      if (!task?.location || !circleName) return;

      setIsFetching(true);
      try {
        console.log("Requesting location permissions...");

        // Check current permission status first
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        console.log("Existing permission status:", existingStatus);

        let finalStatus = existingStatus;

        // Request permission if not already granted
        if (existingStatus !== 'granted') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          finalStatus = status;
          console.log("New permission status:", finalStatus);
        }

        if (finalStatus !== "granted") {
          console.error("Location permission denied:", finalStatus);
          setError("Permission to access location was denied");
          return;
        }

        const location =
          (await Location.getLastKnownPositionAsync()) ||
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          }));
        setUserLocation(location);

        const selectedCircle = task.location.circles?.find(
          (c) => c.name === circleName,
        );
        const targetCoords = selectedCircle?.coordinates;

        if (!targetCoords) {
          setError("No valid coordinates available for the selected circle");
          return;
        }

        const cacheKey = `capturemap_distance_${location.coords.latitude}_${location.coords.longitude}_to_${targetCoords.lat}_${targetCoords.lng}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);

        if (cachedData) {
          const { distance, duration, durationInSeconds, distanceInMeters } =
            JSON.parse(cachedData);
          console.log('📦 Capturemap using cached data:', { distance, duration, durationInSeconds, distanceInMeters });

          // Validate cache data format - ensure it has proper Google Maps format
          if (distance && duration && distance.includes('km') && (duration.includes('min') || duration.includes('hour'))) {
            setDistance(distance);
            setDuration(duration);
            setDurationInSeconds(durationInSeconds);
            setDistanceInMeters(distanceInMeters);
            setInitialDistance(distanceInMeters);
            setIsFetching(false);
            return;
          } else {
            console.log('⚠️ Invalid cache format detected, clearing cache and fetching fresh data');
            await AsyncStorage.removeItem(cacheKey);
          }
        }

        let apiResult;

        try {
          // Try backend tRPC endpoint first
          console.log('Trying backend API...');
          apiResult = await calculateDistanceMutation.mutateAsync({
            origin: {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            },
            destination: {
              lat: targetCoords.lat,
              lng: targetCoords.lng,
            },
          });
          console.log('Backend API response:', apiResult);
        } catch (backendError) {
          console.log('Backend unavailable, using direct API call');

          // Fallback to direct API call if backend fails
          const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${location.coords.latitude},${location.coords.longitude}&destinations=${targetCoords.lat},${targetCoords.lng}&key=${GOOGLE_MAPS_API_KEY}`;

          const response = await fetch(url);
          const data = await response.json();

          if (data.status !== "OK") {
            throw new Error(`Google Maps API error: ${data.status}`);
          }

          const element = data.rows?.[0]?.elements?.[0];
          if (element?.status !== "OK") {
            throw new Error("Unable to calculate distance");
          }

          apiResult = {
            distance: {
              text: element.distance.text,
              value: element.distance.value,
            },
            duration: {
              text: element.duration.text,
              value: element.duration.value,
            },
          };
          console.log('Direct API response:', apiResult);
        }

        const result = {
          distance: apiResult.distance.text,
          duration: apiResult.duration.text,
          durationInSeconds: apiResult.duration.value,
          distanceInMeters: apiResult.distance.value,
        };

        setDistance(result.distance);
        setDuration(result.duration);
        setDurationInSeconds(result.durationInSeconds);
        setDistanceInMeters(result.distanceInMeters);
        setInitialDistance(result.distanceInMeters);

        await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (err) {
        console.error("Error fetching distance:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setIsFetching(false);
      }
    })();
  }, [task, circleName]);

  // Real-time location tracking and car animation
  useEffect(() => {
    if (!taskStarted || !task?.location || !circleName) return;

    const selectedCircle = task.location.circles?.find(
      (c) => c.name === circleName,
    );
    const targetCoords = selectedCircle?.coordinates;

    if (!targetCoords) return;

    (async () => {
      try {
        console.log("Requesting location permissions for tracking...");

        // Check current permission status first
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        console.log("Existing permission status:", existingStatus);

        let finalStatus = existingStatus;

        // Request permission if not already granted
        if (existingStatus !== 'granted') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          finalStatus = status;
          console.log("New permission status:", finalStatus);
        }

        if (finalStatus !== "granted") {
          console.error("Location permission denied:", finalStatus);
          setError("Permission to access location was denied");
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

            // Calculate remaining distance using haversine
            const remainingDistance = haversineDistance(
              location.coords.latitude,
              location.coords.longitude,
              targetCoords.lat,
              targetCoords.lng,
            );

            setDistanceInMeters(remainingDistance);

            // Update car position based on progress
            if (initialDistance > 0) {
              const progress = Math.max(
                0,
                Math.min(1, 1 - remainingDistance / initialDistance),
              );
              const carPosition = progress * MAX_SLIDE;
              carPositionX.value = withTiming(carPosition, { duration: 100 });
            }

            // Check if user has arrived
            if (remainingDistance <= ARRIVAL_RADIUS && !hasArrived) {
              setHasArrived(true);
              carPositionX.value = withTiming(MAX_SLIDE, { duration: 100 });
            }
          },
        );
      } catch (error) {
        console.error("Error setting up location tracking:", error);
        setError("Failed to set up location tracking");
      }
    })();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [taskStarted, task, circleName, initialDistance, hasArrived]);

  // Animated styles using Reanimated 3
  const sliderBackgroundStyle = useAnimatedStyle(
    () => {
      const backgroundColor = interpolateColor(
        dragX.value,
        [0, SLIDE_THRESHOLD],
        ["#D1E6FF", "#2f89ff8b"],
      );
      return { backgroundColor };
    },
    [taskStarted],
  );

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

  const expectedArrivalTime = useMemo(() => {
    if (durationInSeconds !== null && durationInSeconds !== undefined) {
      const arrivalTime = addSeconds(currentTime, durationInSeconds);
      return format(arrivalTime, "hh:mm a");
    }
    return "Calculating...";
  }, [durationInSeconds, currentTime]);

  const handleOpenMaps = async () => {
    console.log("handleOpenMaps called, circleName:", circleName);
    console.log("Task data:", task);

    if (isLoading || !task) {
      console.log("Task is still loading or not available");
      setError("Please wait while we load the task data");
      return;
    }

    if (!task?.location) {
      console.log("No location data in task");
      setError("No location data available for this task");
      return;
    }

    if (!circleName) {
      console.log("No circle name provided");
      setError("No circle information available");
      return;
    }

    const selectedCircle = task.location.circles?.find(
      (c) => c.name === circleName,
    );
    console.log("Selected circle:", selectedCircle);

    if (!selectedCircle?.coordinates) {
      console.log("No coordinates found for circle:", circleName);
      setError(`No coordinates found for circle: ${circleName}`);
      return;
    }

    const { lat, lng } = selectedCircle.coordinates;
    const browserUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    try {
      if (Platform.OS === "ios") {
        const googleMapsUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
        const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
        const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
        await Linking.openURL(canOpenGoogleMaps ? googleMapsUrl : appleMapsUrl);
      } else {
        const googleMapsUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
        const googleNavigationUrl = `google.navigation:q=${lat},${lng}&mode=d`;
        const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}`;

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
      console.error("Failed to open maps:", err);
      setError("Unable to open maps");
    }
  };

  const handleStartCapturing = () => {
    if (!task?.id) {
      setError("No task ID available");
      return;
    }

    if (hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    handleOpenMaps();
    createBatch.mutate({
      operationTaskId: task.id,
    });
  };

  // Gesture handler for smooth sliding
  const handleSlideSubmit = () => {
    if (hasSubmittedRef.current) {
      return;
    }

    hasSubmittedRef.current = true;
    setTaskStarted(true);
    isSliderLocked.current = true;

    handleOpenMaps();
    createBatch.mutate({
      operationTaskId: task?.id || "",
    });
  };

  // Modern Gesture API
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (!isSliderReady || taskStarted || isSliderLocked.current) return;

      const translationX = Math.max(0, Math.min(event.translationX, MAX_SLIDE));
      dragX.value = translationX;

      // Check if we've reached the threshold
      if (translationX >= SLIDE_THRESHOLD && !taskStarted) {
        if (isLoading || !task?.location || !circleName) {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
          runOnJS(setError)("Please wait while we load the task data");
          return;
        }

        const selectedCircle = task.location.circles?.find(
          (c) => c.name === circleName,
        );

        if (!selectedCircle?.coordinates) {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
          runOnJS(setError)(`No coordinates found for circle: ${circleName}`);
          return;
        }

        dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
        runOnJS(handleSlideSubmit)();
      }
    })
    .onEnd((event) => {
      'worklet';
      if (!isSliderReady || taskStarted || isSliderLocked.current) return;

      if (event.translationX >= SLIDE_THRESHOLD) {
        dragX.value = withTiming(MAX_SLIDE, { duration: 300 });
        runOnJS(handleSlideSubmit)();
      } else {
        dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    })
    .enabled(isSliderReady && !taskStarted && !isSliderLocked.current);

  // Removed renderBackdrop function as we're not using BottomSheet anymore

  // Extract volunteers associated with the active circle.
  // 1️⃣ Primary source   : location.volunteers (flat list)
  // 2️⃣ Fallback source  : volunteers stored inside each circle object (as used in ReleaseMap)
  const circleVolunteers = useMemo(() => {
    if (!task?.location) return [];

    interface Volunteer {
      name?: string;
      phoneNumber?: string;
      circleName?: string;
    }
    const flatVols: Volunteer[] =
      "volunteers" in task.location &&
        Array.isArray((task.location as any).volunteers)
        ? ((task.location as any).volunteers as Volunteer[])
        : [];
    const normalized = circleName?.trim().toLowerCase();
    let filtered: typeof flatVols = [];
    if (flatVols.length > 0) {
      filtered = normalized
        ? flatVols.filter(
          (v: Volunteer) =>
            (v.circleName ?? "").trim().toLowerCase() === normalized,
        )
        : flatVols;
    }

    if (
      filtered.length === 0 &&
      Array.isArray(task.location.circles) &&
      task.location.circles.length
    ) {
      const matchCircle = task.location.circles.find((c: any) => {
        const name = (c.name ?? c.circleName ?? "").trim().toLowerCase();
        return normalized ? name === normalized : true;
      });

      if (matchCircle?.volunteers?.length) {
        filtered = Array.isArray((matchCircle as any)?.volunteers)
          ? ((matchCircle as any).volunteers as Volunteer[])
          : [];
      }
    }

    return filtered;
  }, [task, circleName]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!task?.location) {
    return (
      <View className="flex-1 items-center justify-center gap-2">
        <MaterialIcons name="error-outline" size={24} color="black" />
        <Text>No location data available. Please Try Later!</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Uncomment MapView if needed */}
      {/*
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude:
              task.location.circles?.find((c) => c.name === circleName)
                ?.coordinates.lat ?? 0,
            longitude:
              task.location.circles?.find((c) => c.name === circleName)
                ?.coordinates.lng ?? 0,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {userLocation && (
            <Marker
              coordinate={{
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
              }}
              title="Your Location"
            />
          )}
          <Marker
            coordinate={{
              latitude:
                task.location.circles?.find((c) => c.name === circleName)
                  ?.coordinates.lat ?? 0,
              longitude:
                task.location.circles?.find((c) => c.name === circleName)
                  ?.coordinates.lng ?? 0,
            }}
            apikey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
            strokeWidth={3}
            strokeColor="#1B85F3"
          />
          {userLocation && (
            <MapViewDirections
              origin={{
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
              }}
              destination={{
                latitude:
                  task.location.circles?.find((c) => c.name === circleName)
                    ?.coordinates.lat ?? 0,
                longitude:
                  task.location.circles?.find((c) => c.name === circleName)
                    ?.coordinates.lng ?? 0,
              }}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={3}
              strokeColor="#1B85F3"
            />
          )}
        </MapView>
        */}

      <View className="relative left-4 top-3 z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-2"
        >
          <Feather name="chevron-left" size={28} color="black" />
          <Text className="text-xl font-semibold">{t("Back")}</Text>
        </TouchableOpacity>
      </View>

      <View
        className="mx-4 mb-4 mt-6"
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
                    const circle = task?.location?.circles?.find(
                      (c) => c.name === circleName,
                    );
                    if (circle) {
                      return pickLang(
                        circle.name,
                        circle.hiCircleName ?? undefined,
                        circle.teCircleName ?? undefined,
                      );
                    }
                    return (
                      circleName ||
                      pickLang(
                        task?.location?.name ?? "N/A",
                        task?.location?.hi_name ?? undefined,
                        task?.location?.te_name ?? undefined,
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
            <View className="ml-4">
              <Text className="text-sm font-semibold text-black">
                {t("Admin Comments")}
              </Text>
              <Text
                className="mb-2 text-sm font-medium text-[#606873]"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {pickLang(
                  task.location.notes ?? "",
                  task.location.hi_notes ?? undefined,
                  task.location.te_notes ?? undefined,
                ) || "N/A"}
              </Text>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="mb-2 text-sm font-semibold text-black">
                    {t("Circle Volunteers")}
                  </Text>
                  <ScrollView
                    style={{ maxHeight: 120 }}
                    scrollEnabled={circleVolunteers.length > 1}
                    showsVerticalScrollIndicator={false}
                  >
                    {circleVolunteers.length > 0 ? (
                      circleVolunteers.map((volunteer, index) => (
                        <View key={index} className="mb-2 flex-row gap-1">
                          <Text className="text-sm font-semibold text-black">
                            {pickLang(
                              volunteer.name ?? "N/A",
                              undefined,
                              undefined,
                            )}{" "}
                            -
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

              <View className="flex-row items-center justify-between">
                {/* <View>
                    <Text className="text-sm font-medium text-black">
                      Last visited
                    </Text>
                    <Text className="text-sm font-medium text-[#00000099]">
                      20 Jan, 2025
                    </Text>
                  </View> */}
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Replace BottomSheet with a fixed bottom container */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#fefefe",
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -52 },
          shadowOpacity: 0.4,
          shadowRadius: 52,
          elevation: 18,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 40,
          maxHeight: "50%",
        }}
      >
        <View className="mb-4 mt-4 flex-row items-center justify-between px-2">
          <Text className="text-sm font-medium text-black">
            {isFetching ? "Fetching..." : distance || "Calculating..."}
          </Text>
          <View className="absolute left-1/2 -translate-x-1/3">
            <Text className="text-sm font-semibold text-black">
              {isFetching ? "Fetching..." : duration || "Calculating..."}
            </Text>
          </View>
          <Text className="text-sm font-medium text-black">
            {isFetching ? "Fetching..." : expectedArrivalTime}
          </Text>
        </View>

        <View className="relative mb-4 flex-row items-center px-2">
          <Animated.View
            style={{
              transform: [{ translateX: carPositionX }],
              position: "absolute",
              left: 0,
              top: -12,
              zIndex: 10,
            }}
          >
            <Image
              source={require("../../../../../assets/images/car.png")}
              style={{ width: 28, height: 28 }}
            />
          </Animated.View>
          <View className="h-2 w-full rounded-full bg-blue-200" />
        </View>

        <View>
          <View className="mb-2 flex-row items-center justify-between gap-4 px-2">
            <Text className="text-xl font-semibold">{t("Capture task")}</Text>
            <View style={{ flex: 1, maxWidth: "60%" }}>
              <Text
                className="text-right text-xl font-semibold"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {(() => {
                  const circle = task?.location?.circles?.find(
                    (c) => c.name === circleName,
                  );
                  if (circle) {
                    return pickLang(
                      circle.name,
                      circle.hiCircleName ?? undefined,
                      circle.teCircleName ?? undefined,
                    );
                  }
                  return (
                    circleName ||
                    pickLang(
                      task?.location?.name ?? "N/A",
                      task?.location?.hi_name ?? undefined,
                      task?.location?.te_name ?? undefined,
                    )
                  );
                })()}
              </Text>
            </View>
          </View>

          {/* Car Progress Bar */}
          {/* <View className="relative mb-4 flex-row items-center px-2">
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: -12,
                  zIndex: 10,
                },
                carAnimatedStyle,
              ]}
            >
              <Image
                source={require("../../../../../assets/images/car.png")}
                style={{ width: 28, height: 28 }}
              />
            </Animated.View>
            <View className="h-2 w-full rounded-full bg-blue-200" />
          </View> */}

          {/* Task Information */}
          <View className="mb-6">
            {/* <View className="mb-2 flex-row items-center justify-between gap-4 px-2">
              <Text className="text-xl font-semibold">Capture task</Text>
              <View style={{ flex: 1, maxWidth: "60%" }}>
                <Text
                  className="text-right text-xl font-semibold"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {task?.location?.circles?.find((c) => c.name === circleName)
                    ?.name ||
                    circleName ||
                    task?.location?.name ||
                    "N/A"}
                </Text>
              </View>
            </View> */}

            <View className="mt-4 gap-3 px-2">
              <View className="flex-row justify-between">
                <Text className="text-sm font-medium text-gray-400">
                  Date & Time
                </Text>
                <Text className="text-sm font-medium text-black">
                  {displayDateTime}
                </Text>
              </View>
            </View>
            {/* <View className="flex-row justify-between">
                  <Text className="text-sm font-medium text-gray-400">
                    Location Notes
                  </Text>
                  <View style={{ maxWidth: "65%", height: 58 }}>
                    <ScrollView>
                      <Text
                        className="text-sm font-medium text-black"
                        numberOfLines={isExpanded ? 0 : 1}
                      >
                        {task.location.notes || "No notes available"}
                      </Text>
                    </ScrollView>
                    {task.location.notes && task.location.notes.length > 30 && (
                      <TouchableOpacity
                        className="flex items-end"
                        onPress={() => setIsExpanded(!isExpanded)}
                      >
                        <Text className="text-sm text-blue-500">
                          {isExpanded ? "Show Less" : "Show More"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View> */}
          </View>
        </View>

        {/* Reopen Maps + Slider / Action Button */}
        <View>
          {taskStarted && (
            <TouchableOpacity
              onPress={() => {
                console.log("Reopen Maps pressed!");
                handleOpenMaps();
              }}
              className="mb-6 items-end justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-right text-base font-medium text-blue-500">
                {t("Reopen Maps?")}
              </Text>
            </TouchableOpacity>
          )}

          {/* Slider / Action Button */}
          <View>
            {taskStarted ? (
              <TouchableOpacity
                onPress={() => {
                  console.log("Continue capturing pressed!");
                  handleStartCapturing();
                }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#2F88FF",
                  borderRadius: 15,
                  height: 54,
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
                  {task?.status === "ongoing"
                    ? t("Continue capturing")
                    : t("Start capturing")}
                </Text>
              </TouchableOpacity>
            ) : (
              <Animated.View
                style={[
                  {
                    height: 54,
                    borderRadius: 15,
                    position: "relative",
                    overflow: "hidden",
                  },
                  sliderBackgroundStyle,
                ]}
                className="w-full"
              >
                {/* Background Text Layer */}
                <View className="absolute left-0 right-0 top-0 h-full items-center justify-center">
                  <Text className="text-base font-medium text-black">
                    {task?.status === "ongoing"
                      ? t("Continue task")
                      : t("Go to task")}
                  </Text>
                </View>

                {/* Slider Handle */}
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

export default TaskScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "65%",
  },
});
