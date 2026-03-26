// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { EvilIcons, Feather, Entypo, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { api } from "~/utils/api";
import { Linking } from 'react-native';
import { useTranslation } from "~/utils/LanguageContext";

// Timeout helper for fetch requests
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Haversine formula for distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 40;
const MAX_SLIDE = SLIDER_WIDTH - 60;
const SLIDE_THRESHOLD = MAX_SLIDE;

const styles = StyleSheet.create({
  mapContainer: {
    height: 150,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

interface HistoryItem {
  id: string;
  location: string;
  team: string;
  requestId: string;
  dogs: string;
  date: string;
  time: string;
  distance: string;
  distanceTime: string;
  requestedby: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface DogLocation {
  fullAddress: string;
  coordinates: Coordinates;
}

interface Dog {
  id: string;
  gender: string;
  image: string | { uri: string };
  dogImageUrl: string;
  createdAt: Date | null;
  location: {
    fullAddress: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
}

interface DogCardProps {
  dog: Dog;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isWithinRange: boolean;
}

const DogCard = ({
  dog,
  isSelected,
  onSelect,
  isWithinRange,
}: DogCardProps) => {
  const address =
    typeof dog.location === "string" ? dog.location : dog.location.fullAddress;

  return (
    <TouchableOpacity
      onPress={() => onSelect(dog.id)}
      style={{
        padding: 10,
        backgroundColor: isSelected ? "#e0e0e0" : "white",
        borderRadius: 8,
        marginBottom: 10,
        opacity: isWithinRange ? 1 : 0.5,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Image
          source={{
            uri: typeof dog.image === "string" ? dog.image : dog.image.uri,
          }}
          style={{ width: 60, height: 60, borderRadius: 30 }}
        />
        <View style={{ marginLeft: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold" }}>{dog.gender}</Text>
          <Text style={{ fontSize: 14, color: "#666" }}>{address}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const TaskScreen = () => {
  interface ReleasedogRouteParams {
    id?: string;
    location?: string;
    team?: string;
    requestId?: string;
    dogs?: string;
    date?: string;
    time?: string;
    requestedby?: string;
    distance?: string;
    distanceTime?: string;
    distanceInMeters?: string;
  }

  const params = useLocalSearchParams();

  const { id: operationTaskId, dog_tag_id } = params;
  const dogIdParam = params?.id as string | undefined;
  const { t } = useTranslation();

  // Fetch single dog details if dogId present
  const { data: dogDetails, isLoading: isDogLoading } = api.dogs.getDogById.useQuery(
    { dogId: dogIdParam! },
    { enabled: !!dogIdParam },
  );
  const isFemale = dogDetails?.gender === "Female";
  const captureDate = dogDetails?.createdAt ? new Date(dogDetails.createdAt) : null;
  const formattedCaptureDate = captureDate
    ? captureDate.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : "";
  const formattedCaptureTime = captureDate
    ? captureDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    : "";

  const {
    id: operationTaskId_unused,
    location,
    team,
    requestId,
    distance,
    dogs,
    date,
    time,
    requestedby,
    distanceTime,
    distanceInMeters: paramsDistanceInMeters,
  } = useLocalSearchParams();

  const [selectedDogs, setSelectedDogs] = useState<string[]>(dogIdParam ? [dogIdParam] : []);
  const [isWithinRadius, setIsWithinRadius] = useState(false); // Restored to false
  const [error, setError] = useState<string | null>(null);
  const [releaseProgress, setReleaseProgress] = useState<string | null>(null); // Progress indicator
  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height),
  ).current;
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [distanceLeft, setDistanceLeft] = useState<number | null>(null);

  const { data: capturedDogsFromDB } = api.task.getCapturedDogs.useQuery(
    { operationTaskId: operationTaskId as string },
    { enabled: !!operationTaskId },
  );

  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();

  // trpc context for cache manipulation
  const ctx = api.useContext();

  const releaseDogsMutation = api.task.updateDogStatus.useMutation({
    onSuccess: async () => {
      setReleaseProgress(null);
      Alert.alert(t("Success"), t("Dogs have been released successfully"));

      setSelectedDogs([]);

      // Invalidate captured dogs query so released dogs disappear from list
      await ctx.task.getCapturedDogs.invalidate({ operationTaskId: operationTaskId as string });

      // Determine batchId from any captured dog (they all belong to same batch)
      const batchIdParam = capturedDogsFromDB?.[0]?.batchId as string | undefined;

      // Redirect to Release Dog List screen with batchId fallback to operationTaskId
      router.back();
    },
    onError: () => {
      setReleaseProgress(null);
      Alert.alert(t("Error"), t("Failed to save release. Please check your connection and try again."));
    },
  });

  // Transform database data to match our UI format
  const dogsData: Dog[] =
    capturedDogsFromDB
      ?.filter((dog) => dog.status === "captured")
      .map((dog) => ({
        id: dog.id,
        image: { uri: dog.dogImageUrl },
        gender: dog.gender,
        status: dog.status || "captured",
        location: {
          fullAddress: dog.fullAddress || "Location not available",
          coordinates: dog.coordinates as Coordinates,
        },
        createdAt: dog.createdAt,
        dogImageUrl: dog.dogImageUrl,
      })) ?? [];

  // Cleaned release handler
  const handleReleaseDogs = async () => {
    if (selectedDogs.length === 0) {
      Alert.alert(t("Error"), t("Please select dogs to release"));
      return;
    }

    if (!isWithinRadius) {
      Alert.alert(
        t("Error"),
        t("You must be within 1.5 km of the selected dog(s). Current distance:") +
        ` ${(distanceLeft || 0).toFixed(2)} km`,
      );
      return;
    }

    // Camera permission
    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus !== "granted") {
      Alert.alert(t("Permission denied"), t("Camera permission is required"));
      return;
    }

    try {
      // Launch camera with reduced quality for faster uploads
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const photoUri = result.assets[0].uri;
      const extension = photoUri.split(".").pop()?.toLowerCase() || "jpg";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      // Step 1: Get signed upload URL
      setReleaseProgress(t("Preparing upload..."));
      let uploadUrlResponse;
      try {
        uploadUrlResponse = await getUploadURL({ folderName: "release-dog", contentType });
        if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
          throw new Error("Invalid upload URL response");
        }
      } catch (err) {
        console.error("Upload URL error:", err);
        setReleaseProgress(null);
        Alert.alert(t("Error"), t("Failed to prepare upload. Please check your internet connection."));
        return;
      }

      // Step 2: Convert image to blob
      setReleaseProgress(t("Processing photo..."));
      let imageBlob;
      try {
        const blobResponse = await fetchWithTimeout(photoUri, {}, 15000);
        imageBlob = await blobResponse.blob();
      } catch (err) {
        console.error("Blob conversion error:", err);
        setReleaseProgress(null);
        Alert.alert(t("Error"), t("Failed to process photo. Please try again."));
        return;
      }

      // Step 3: Upload to S3 with timeout
      setReleaseProgress(t("Uploading photo..."));
      try {
        const uploadResponse = await fetchWithTimeout(
          uploadUrlResponse.data.uploadParams,
          {
            method: "PUT",
            body: imageBlob,
            headers: { "Content-Type": contentType },
          },
          30000
        );
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status: ${uploadResponse.status}`);
        }
      } catch (err: any) {
        console.error("S3 upload error:", err);
        setReleaseProgress(null);
        if (err.name === "AbortError") {
          Alert.alert(t("Error"), t("Upload timed out. Please check your internet connection and try again."));
        } else {
          Alert.alert(t("Error"), t("Failed to upload photo. Please try again."));
        }
        return;
      }

      // Step 4: Update database
      setReleaseProgress(t("Saving..."));
      releaseDogsMutation.mutate({
        dogIds: selectedDogs,
        status: "released",
        releasePhoto: uploadUrlResponse.data.fileUrl,
        releaseDate: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Release error:", err);
      setReleaseProgress(null);
      Alert.alert(t("Error"), t("Failed to release dog(s). Please try again."));
    }
  };

  const isLoading = releaseDogsMutation.status === "pending" || releaseProgress !== null;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const checkLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError(t("Location permission not granted"));
          setError(t("Location permission denied"));
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High, // Request high accuracy
        });
        setUserLocation(location);
        setLocationError("");
        console.log("User Location:", location.coords);
      } catch (error) {
        setLocationError(t("Error getting location"));
        setError(t("Failed to fetch location"));
        console.error("Location Error:", error);
      }
    };

    checkLocation();
    const interval = setInterval(checkLocation, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userLocation || (!dogsData.length && !dogDetails)) {
      console.log("Missing data:", { userLocation, dogsData, dogDetails });
      setIsWithinRadius(false);
      setDistanceLeft(null);
      return;
    }

    let minDistance = Number.POSITIVE_INFINITY;

    // Check distance for a specific dog if dogDetails is available
    const dogCoords = dogDetails?.coordinates as Coordinates | undefined;

    if (dogCoords) {
      const dist = calculateDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        dogCoords.latitude,
        dogCoords.longitude,
      );
      minDistance = dist;
      console.log(`Dog ${dogDetails?.id} distance: ${dist} km`);
    } else if (dogsData.length > 0) {
      // Check distances for all dogs if no specific dog is selected
      dogsData.forEach((dog) => {
        if (!dog.location.coordinates) {
          console.log(`Dog ${dog.id} has no coordinates`);
          return;
        }
        const dist = calculateDistance(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          dog.location.coordinates.latitude,
          dog.location.coordinates.longitude,
        );
        minDistance = Math.min(minDistance, dist);
        console.log(`Dog ${dog.id} distance: ${dist} km`);
      });
    }

    const within = minDistance <= 1.5; // 1500 meters
    setIsWithinRadius(within);
    setDistanceLeft(minDistance);
    console.log("Nearest distance (km):", minDistance, "Within 1.5 km :", within);
  }, [userLocation, dogsData, dogDetails]);

  const historyList: HistoryItem[] = [
    {
      id: "1",
      location: "Shankarpalle",
      team: "Team A",
      requestId: "#BC01052025",
      dogs: "80",
      date: "Feb 2nd, 2025",
      time: "11.47 am",
      distance: "5km",
      distanceTime: "15 min",
      requestedby: "Anonymous",
    },
  ];

  return (
    <View className="relative flex-1 bg-gray-100">
      {/* Dog profile header when navigating with specific dog */}
      {dogDetails ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
          {/* Back button */}
          <View className="flex-row relative z-10 top-14 items-center">
            <TouchableOpacity onPress={() => router.back()} className="flex-row left-4 top-2 rounded-full bg-[#00000035] p-1 items-center">
              <Feather name="chevron-left" size={28} color="white" />
            </TouchableOpacity>
          </View>
          {/* Image */}
          <View className="relative items-center mb-8">
            <Image
              source={{ uri: dogDetails.dogImageUrl }}
              style={{ width: SCREEN_WIDTH * 0.9, height: SCREEN_WIDTH * 0.9 }}
              className="rounded-2xl"
              resizeMode="cover"
            />
            <View className="absolute bottom-4 left-4 p-4">
              <View className="mb-4 flex-row items-center">
                <Text className="mr-2 text-2xl font-bold text-white">
                  {dogDetails.dog_tag_id ?? dogDetails.id.slice(0, 6)}
                </Text>
                <View className="rounded-full bg-[#1B85F3] h-6 w-6 items-center justify-center">
                  <Entypo name="check" size={10} color="white" />
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <View className={`flex-row items-center justify-center rounded-full px-3 py-3 ${isFemale ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"}`}>
                  <Text className="px-2 text-sm font-medium text-white">
                    {dogDetails.gender}
                  </Text>
                  <MaterialCommunityIcons name="gender-male" size={18} color="white" />
                </View>
                {dogDetails.dogColor && (
                  <View className={`flex-row gap-2 items-center justify-center rounded-full px-3 py-3 ${isFemale ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"}`}>
                    <Text className="text-sm font-medium text-white">
                      {dogDetails.dogColor}
                    </Text>
                    <MaterialIcons name="color-lens" size={18} color="white" />
                  </View>
                )}
              </View>
            </View>
          </View>
          {/* Additional Details */}
          <View className="mx-4 flex-1 gap-5">
            {dogDetails.weight && (
              <View className="mb-2 flex-row items-center gap-4">
                <MaterialCommunityIcons
                  name="weight-kilogram"
                  size={18}
                  color={isFemale ? "#FF2F9E" : "#1B85F3"}
                  className={`rounded-lg p-3 ${isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"}`}
                />
                <View>
                  <Text className="text-sm text-gray-600">{t("Weight")}</Text>
                  <Text className="text-lg font-semibold text-gray-800">
                    {dogDetails.weight} kg
                  </Text>
                </View>
              </View>
            )}

            {dogDetails.feederName && (
              <View className="mb-2 flex-row items-center gap-4">
                <MaterialIcons
                  name="person"
                  size={18}
                  color={isFemale ? "#FF2F9E" : "#1B85F3"}
                  className={`rounded-lg p-3 ${isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"}`}
                />
                <View>
                  <Text className="text-sm text-gray-600">{t("Feeder Name")}</Text>
                  <Text className="text-lg font-semibold text-gray-800">
                    {dogDetails.feederName}
                  </Text>
                </View>
              </View>
            )}

            {dogDetails.feederPhoneNumber && (
              <View className="mb-2 flex-row items-center gap-4">
                <MaterialIcons
                  name="phone"
                  size={18}
                  color={isFemale ? "#FF2F9E" : "#1B85F3"}
                  className={`rounded-lg p-3 ${isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"}`}
                />
                <View>
                  <Text className="text-sm text-gray-600">{t("Contact")}</Text>
                  <Text className="text-lg font-semibold text-gray-800">
                    {dogDetails.feederPhoneNumber}
                  </Text>
                </View>
              </View>
            )}

            {dogDetails.createdAt && (
              <View className="mb-2 flex-row items-center gap-4">
                <MaterialCommunityIcons
                  name="calendar"
                  size={18}
                  color={isFemale ? "#FF2F9E" : "#1B85F3"}
                  className={`rounded-lg p-3 ${isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"}`}
                />
                <View>
                  <Text className="text-sm text-gray-600">{t("Date & Time of Capture")}</Text>
                  <View className="flex-row items-center gap-10">
                    <Text className="text-lg font-semibold text-gray-800">
                      {formattedCaptureDate}
                    </Text>
                    <Text className="text-lg font-semibold text-gray-800">
                      {formattedCaptureTime}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {dogDetails.fullAddress && (
              <View className="mb-2 flex-row items-center gap-4">
                <MaterialIcons
                  name="location-on"
                  size={18}
                  color={isFemale ? "#FF2F9E" : "#1B85F3"}
                  className={`rounded-lg p-3 ${isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"}`}
                />
                <View>
                  <Text className="text-sm text-gray-600">{t("GPS Location")}</Text>
                  <Text className="text-lg font-semibold text-gray-800">
                    {dogDetails.fullAddress}
                  </Text>
                </View>
              </View>
            )}

            {/* Map */}
            {dogDetails.coordinates && (
              <View className="relative mb-2 h-40 w-full overflow-hidden rounded-xl">
                <MapView
                  style={{ flex: 1 }}
                  region={{
                    latitude: (dogDetails.coordinates as { latitude: number; longitude: number })?.latitude || 0,
                    longitude: (dogDetails.coordinates as { latitude: number; longitude: number })?.longitude || 0,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: (dogDetails.coordinates as { latitude: number; longitude: number })?.latitude || 0,
                      longitude: (dogDetails.coordinates as { latitude: number; longitude: number })?.longitude || 0,
                    }}
                  />
                </MapView>
                <TouchableOpacity
                  className="absolute right-2 top-2 rounded-2xl bg-[#2A3240] p-3"
                  onPress={() => {
                    if (!dogDetails?.coordinates) return;
                    const coords = dogDetails.coordinates as { latitude: number; longitude: number };
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`;
                    Linking.openURL(url).catch(err => console.error('Failed to open maps', err));
                  }}
                >
                  <Ionicons name="expand-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}

            {/* Distance Display for Debugging */}
            {dogDetails && userLocation && (
              <Text className="text-center text-sm text-gray-600">
                {t('Distance to dog:')} {(distanceLeft || 0).toFixed(2)} km
              </Text>
            )}
          </View>
        </ScrollView>
      ) : isDogLoading ? (
        <View className="mx-4 mt-24 h-1/4 pb-4">
          {/* Beautiful Loading Component */}
          <View className="rounded-2xl border border-[#8ED7FF] bg-[#8ED7FF38] px-4 py-6">
            <View className="mb-1 mt-3 flex-row items-start justify-between gap-10">
              <View className="justify-center flex-1">
                {/* Loading skeleton for title */}
                <View className="mb-2 h-4 w-32 rounded bg-gray-200" />

                {/* Loading skeleton for request ID */}
                <View className="mb-1 h-3 w-24 rounded bg-gray-200" />

                {/* Loading skeleton for dogs count */}
                <View className="mb-1 h-5 w-20 rounded bg-gray-200" />
              </View>

              <View className="flex-col items-end gap-1">
                {/* Loading skeleton for team */}
                <View className="h-3 w-16 rounded bg-gray-200" />

                {/* Loading skeleton for date */}
                <View className="h-3 w-20 rounded bg-gray-200" />

                {/* Loading skeleton for time */}
                <View className="h-3 w-14 rounded bg-gray-200" />
              </View>
            </View>

            {/* Loading skeleton for requested by */}
            <View className="mb-2 h-3 w-28 rounded bg-gray-200" />

            <View className="flex-row items-center justify-between">
              {/* Loading skeleton for distance */}
              <View className="h-3 w-32 rounded bg-gray-200" />

              {/* Loading skeleton for button */}
              <View className="h-9 w-20 rounded-full bg-gray-200" />
            </View>
          </View>

          {/* Loading indicator with text */}
          <View className="mt-6 items-center">
            <ActivityIndicator size="large" color="#2F88FF" />
            <Text className="mt-2 text-sm text-gray-600">{t("Loading release details...")}</Text>
          </View>
        </View>
      ) : (
        <View className="mx-4 mt-24 h-1/4 pb-4">
          <FlatList
            data={historyList}
            keyExtractor={(_, index) => `history-${index}`}
            contentContainerStyle={{ gap: 12 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center justify-center rounded-2xl bg-[#F0F4F8] px-4 py-6">
                <Text className="text-sm text-gray-500">{t("Not Available")}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="rounded-2xl border border-[#8ED7FF] bg-[#8ED7FF38] px-4 py-6">
                <View className="mb-1 mt-3 flex-row items-start justify-between gap-10">
                  <View className="justify-center">
                    <Text className="mb-2 text-base font-semibold">
                      {t("Release at")} {item.location}
                    </Text>
                    <Text className="mb-1 text-xs font-semibold text-gray-500">
                      {t("Request")} {item.requestId}
                    </Text>
                    <Text className="mb-1 text-xl font-bold">
                      {">"} {item.dogs} Dogs
                    </Text>
                  </View>
                  <View className="flex-col items-end gap-1">
                    <Text className="text-sm font-semibold text-black">
                      {item.team}
                    </Text>
                    <Text className="text-sm text-gray-600">{item.date}</Text>
                    <Text className="text-sm text-gray-600">({item.time})</Text>
                  </View>
                </View>
                <Text className="mb-2 text-xs text-gray-500">
                  {t("Request by")} {item.requestedby}
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-black">
                    <EvilIcons name="location" size={14} color="gray" />{" "}
                    {item.distance} ({item.distanceTime})
                  </Text>
                  <TouchableOpacity className="rounded-full bg-[#2F88FF] px-6 py-3">
                    <Text className="text-sm text-white">{t("close area")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Release button */}
      <View className="my-6 items-center">
        <TouchableOpacity
          className={`w-4/5 items-center rounded-xl py-4 ${isWithinRadius && !isLoading ? 'bg-[#1B85F3]' : 'bg-gray-400'}`}
          onPress={handleReleaseDogs}
          disabled={!isWithinRadius || isLoading}
        >
          {isLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-base font-semibold text-white">
                {releaseProgress || t("Processing...")}
              </Text>
            </View>
          ) : (
            <Text className="text-base font-semibold text-white">
              {isWithinRadius
                ? t("Release")
                : `${t("Move closer to location")} (${(distanceLeft || 0).toFixed(2)} km)`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TaskScreen;