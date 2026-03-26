import React, { useState } from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Entypo,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

import { api } from "~/utils/api";
import ReviewCard from "../_components/ReviewCard";

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

export default function DogProfile() {
  const { width } = useWindowDimensions();
  const { dogId, gender, batchId } = useLocalSearchParams<{
    dogId?: string;
    gender?: string;
    batchId?: string;
  }>();
  const router = useRouter();
  const utils = api.useContext();

  // Fetch dog details
  const { data: dogDetails, isLoading } = api.surgery.getDogDetails.useQuery(
    { dogId: dogId! },
    { enabled: !!dogId },
  );

  // State to control ReviewCard visibility
  const [reviewVisible, setReviewVisible] = useState(false);

  // Surgery status mutation
  const updateDogSurgeryStatus = api.surgery.updateDogSurgeryStatus.useMutation(
    {
      onSuccess: () => {
        // Invalidate both queries to refresh the data
        void utils.surgery.getDogDetails.invalidate({ dogId: dogId! });
        void utils.surgery.getBatchDogs.invalidate({
          batchId: batchId!,
        });
      },
    },
  );

  const imageWidth = width * 0.9;
  const imageHeight = imageWidth;

  const handleBack = () => {
    router.back();
  };

  // Handle ReviewCard confirm action
  const handleReviewConfirm = async (data: { remark: string }) => {
    try {
      await updateDogSurgeryStatus.mutateAsync({
        dogId: dogId!,
        surgeryStatus: "yes",
        surgery_remarks: data.remark,
      });
      setReviewVisible(false);

      // First invalidate the queries
      await Promise.all([
        utils.surgery.getDogDetails.invalidate({ dogId: dogId! }),
        utils.surgery.getBatchDogs.invalidate({ batchId: batchId! }),
      ]);

      // Then navigate back
      router.back();
    } catch (error) {
      console.error("Failed to update surgery remarks:", error);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#8B67E5" />
        <Text className="mt-2 text-gray-600">Loading dog details...</Text>
      </View>
    );
  }

  if (!dogDetails) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg text-gray-800">Dog not found</Text>
        <TouchableOpacity
          className="mt-4 rounded-lg bg-blue-500 px-6 py-3"
          onPress={handleBack}
        >
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with Back Button and Dog Image */}
        <View>
          <View className="items-center">
            <Image
              source={{ uri: dogDetails.dogImageUrl }}
              style={{ width: imageWidth, height: imageHeight }}
              className="rounded-md"
            />
          </View>
          <View className="absolute flex-row items-center p-4">
            <TouchableOpacity
              className="left-4 rounded-full bg-[#00000033] p-2"
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
          {/* Dog Details Section */}
          <View className="relative bottom-32 left-6 p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="mr-2 text-2xl font-semibold text-white">
                  ID: {dogDetails.dogTagId ?? (dogDetails.id ? dogDetails.id.slice(0, 8) : "")}
                </Text>
                <View
                  className={`rounded-full ${(dogDetails.gender ?? "").toLowerCase() === "female" ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"} h-6 w-6 items-center justify-center`}
                >
                  <Entypo name="check" size={10} color="white" />
                </View>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <View
                className={`flex-row items-center justify-center rounded-full px-3 py-3 ${(dogDetails.gender ?? "").toLowerCase() === "female"
                  ? "bg-[#FF2F9E]"
                  : "bg-[#1B85F3]"
                  }`}
              >
                <Text className="px-2 text-sm font-light text-white">
                  {dogDetails.gender}
                </Text>
                <MaterialCommunityIcons
                  name={
                    (dogDetails.gender ?? "").toLowerCase() === "female"
                      ? "gender-female"
                      : "gender-male"
                  }
                  size={18}
                  color="white"
                />
              </View>
              {dogDetails.dogColor && (
                <View
                  className={`flex-row items-center justify-center rounded-full px-3 py-3 ${(dogDetails.gender ?? "").toLowerCase() === "female"
                    ? "bg-[#FF2F9E]"
                    : "bg-[#1B85F3]"
                    }`}
                >
                  <Text className="px-2 text-sm font-light text-white">
                    {dogDetails.dogColor}
                  </Text>
                  <MaterialIcons name="color-lens" size={18} color="white" />
                </View>
              )}
              {dogDetails.weight && (
                <View
                  className={`flex-row items-center justify-center rounded-full px-3 py-3 ${(dogDetails.gender ?? "").toLowerCase() === "female"
                    ? "bg-[#FF2F9E]"
                    : "bg-[#1B85F3]"
                    }`}
                >
                  <Text className="px-2 text-sm font-light text-white">
                    {dogDetails.weight}kg
                  </Text>
                  <MaterialCommunityIcons
                    name="weight-kilogram"
                    size={18}
                    color="white"
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Details Card */}
        <View
          className="mt-[-80px] gap-4 rounded-t-[40px] bg-white p-8"
          style={{
            elevation: Platform.OS === "android" ? 32 : 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -20 },
            shadowOpacity: Platform.OS === "ios" ? 0.4 : 0,
            shadowRadius: Platform.OS === "ios" ? 10 : 0,
            overflow: "visible",
          }}
        >
          {/* Block & Cage */}
          {dogDetails.blockAndCage && (
            <View className="mb-2 flex-row items-center gap-4">
              <Entypo
                name="home"
                size={16}
                color={
                  (dogDetails.gender ?? "").toLowerCase() === "male"
                    ? "#1B85F3"
                    : "#FF2F9E"
                }
                className={`rounded-lg p-3 ${(dogDetails.gender ?? "").toLowerCase() === "male" ? "bg-[#D1E6FF80]" : "bg-[#FF2F9E30]"}`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm font-medium text-[#A0A3B1]">
                  Block & Cage no
                </Text>
                <Text className="text-lg font-medium text-gray-800">
                  {dogDetails.blockAndCage}
                </Text>
              </View>
            </View>
          )}

          {/* Vehicle */}
          {dogDetails.vehicleNumber && (
            <View className="mb-2 flex-row items-center gap-4">
              <FontAwesome5
                name="truck"
                size={16}
                color={
                  (dogDetails.gender ?? "").toLowerCase() === "male"
                    ? "#1B85F3"
                    : "#FF2F9E"
                }
                className={`rounded-lg p-3 ${(dogDetails.gender ?? "").toLowerCase() === "male" ? "bg-[#D1E6FF80]" : "bg-[#FF2F9E30]"}`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm font-medium text-[#A0A3B1]">
                  Vehicle Number
                </Text>
                <Text className="text-lg font-medium text-gray-800">
                  {dogDetails.vehicleNumber}
                </Text>
              </View>
            </View>
          )}

          {/* Team */}
          {dogDetails.team && (
            <View className="mb-2 flex-row items-center gap-4">
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={
                  (dogDetails.gender ?? "").toLowerCase() === "male"
                    ? "#1B85F3"
                    : "#FF2F9E"
                }
                className={`rounded-lg p-3 ${(dogDetails.gender ?? "").toLowerCase() === "male" ? "bg-[#D1E6FF80]" : "bg-[#FF2F9E30]"}`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm font-medium text-[#A0A3B1]">Team</Text>
                <Text className="text-lg font-medium text-gray-800">
                  {dogDetails.team}
                </Text>
              </View>
            </View>
          )}

          {/* Date of Capture */}
          <View className="mb-2 flex-row items-center gap-4">
            <Entypo
              name="calendar"
              size={18}
              color={
                (dogDetails.gender ?? "").toLowerCase() === "male"
                  ? "#1B85F3"
                  : "#FF2F9E"
              }
              className={`rounded-lg p-3 ${(dogDetails.gender ?? "").toLowerCase() === "male" ? "bg-[#D1E6FF80]" : "bg-[#FF2F9E30]"}`}
            />
            <View className="flex-col items-start justify-center">
              <Text className="text-sm font-medium text-[#A0A3B1]">
                Date & Time of Capture
              </Text>
              <Text className="text-lg font-medium text-gray-800">
                {dogDetails.captureDateTime}
              </Text>
            </View>
          </View>

          {/* Location */}
          {dogDetails.location && (
            <View className="mb-2 flex-row items-center gap-4">
              <MaterialIcons
                name="location-on"
                size={18}
                color={
                  (dogDetails.gender ?? "").toLowerCase() === "male"
                    ? "#1B85F3"
                    : "#FF2F9E"
                }
                className={`rounded-lg p-3 ${(dogDetails.gender ?? "").toLowerCase() === "male" ? "bg-[#D1E6FF80]" : "bg-[#FF2F9E30]"}`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm font-medium text-[#A0A3B1]">
                  GPS Location
                </Text>
                <Text className="text-lg font-medium text-gray-800">
                  {dogDetails.location}
                </Text>
              </View>
            </View>
          )}

          {/* Map Placeholder */}
          {dogDetails.coordinates && !isNaN(Number((dogDetails.coordinates as { latitude: number; longitude: number }).latitude)) && !isNaN(Number((dogDetails.coordinates as { latitude: number; longitude: number }).longitude)) && (
            <View style={styles.mapContainer}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: Number((dogDetails.coordinates as { latitude: number; longitude: number }).latitude),
                  longitude: Number((dogDetails.coordinates as { latitude: number; longitude: number }).longitude),
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                pointerEvents="none"
              >
                <Marker
                  coordinate={{
                    latitude: Number((dogDetails.coordinates as { latitude: number; longitude: number }).latitude),
                    longitude: Number((dogDetails.coordinates as { latitude: number; longitude: number }).longitude),
                  }}
                />
              </MapView>
              <View className="absolute bottom-4 left-1/2 mt-2 -translate-x-1/2 transform rounded-full border-4 border-[#FFFFFF] bg-purple-500 p-2">
                <MaterialCommunityIcons name="dog" size={24} color="white" />
              </View>
              <TouchableOpacity
                className="absolute right-2 top-2 rounded-2xl bg-[#2A3240] p-3"
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${Number((dogDetails.coordinates as { latitude: number; longitude: number }).latitude)},${Number((dogDetails.coordinates as { latitude: number; longitude: number }).longitude)}`,
                  )
                }
              >
                <Ionicons name="expand-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {/* Buttons */}
          <View className="mt-4 flex-row justify-between">
            <TouchableOpacity
              className="mr-2 flex-1 rounded-lg border border-[#1B85F3] p-3"
              onPress={handleBack}
            >
              <Text className="text-center font-semibold text-[#1B85F3]">
                Go back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="ml-2 flex-1 rounded-lg bg-[#1B85F3] p-3"
              onPress={() => setReviewVisible(true)}
            >
              <Text className="text-center font-semibold text-white">
                Give remarks
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ReviewCard Component */}
      <ReviewCard
        visible={reviewVisible}
        onCancel={() => setReviewVisible(false)}
        onConfirm={handleReviewConfirm}
        heading="Post-op remarks"
      />
    </View>
  );
}
