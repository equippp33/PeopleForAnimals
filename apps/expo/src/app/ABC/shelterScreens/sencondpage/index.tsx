import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";

import { api } from "~/utils/api";

const { height: screenHeight } = Dimensions.get("window");

interface Dog {
  id: string;
  dogImageUrl: string;
  gender: string;
  location: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  fullAddress: string | null;
  status: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  dog_tag_id: string | null;
  weight: number | null;
  block: string | null;
  cageNumber?: string | null;
  feederName?: string | null;
  feederPhoneNumber?: string | null;
  dogColor: string | null;
}

interface Batch {
  id: string;
  batchNumber: string;
  status: string;
  startTime: Date | null;
  endTime: Date | null;
  totalDogs: number;
  team: {
    id: string;
    name: string;
  } | null;
  operationTask: {
    id: string;
    circleName: string | null;
    circleCoordinates: { lat: number; lng: number } | null;
    locationName: string | null;
  } | null;
}

const SecondPage: React.FC = () => {
  const { batchId, recentlyUpdatedDogId } = useLocalSearchParams();
  const [updatedDogIds, setUpdatedDogIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false); // State for refreshing

  // Add effect to handle the recently updated dog
  useEffect(() => {
    if (recentlyUpdatedDogId && !Array.isArray(recentlyUpdatedDogId)) {
      setUpdatedDogIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(recentlyUpdatedDogId);
        return newSet;
      });
    }
  }, [recentlyUpdatedDogId]);

  const flatListRef = useRef<FlatList>(null);

  // Fetch batch details using the new shelter API
  const { data: batchDetails, isLoading: isLoadingBatch, refetch: refetchBatch } =
    api.shelter.getBatchDetails.useQuery(
      { batchId: batchId as string },
      { enabled: !!batchId },
    );

  // Fetch dogs using the new shelter API
  const { data: dogs, isLoading: isLoadingDogs, refetch: refetchDogs } =
    api.shelter.getDogsByBatchId.useQuery(
      { batchId: batchId as string },
      { enabled: !!batchId },
    );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true); // Show the spinner
    await Promise.all([refetchBatch(), refetchDogs()]); // Refetch both queries
    setRefreshing(false); // Hide the spinner
  };

  // Check if all non-missing dogs have been processed by shelter
  const allDogsProcessed = React.useMemo(() => {
    if (!dogs) return false;

    // Filter out missing dogs and check if remaining dogs are processed
    const nonMissingDogs = dogs.filter((dog) => dog.status !== "missing");
    if (nonMissingDogs.length === 0) return false;

    return nonMissingDogs.every((dog) =>
      Boolean(dog.weight ?? dog.block ?? dog.cageNo),
    );
  }, [dogs]);

  const bottomSheetHeight = useRef(
    new Animated.Value(screenHeight * 0.6),
  ).current;
  const blueCardOpacity = useRef(new Animated.Value(1)).current;

  // Assignment card data
  const assignment = batchDetails
    ? {
      id: "id" in batchDetails ? (batchDetails as any).id : undefined,
      type: "Capture",
      team: "team" in batchDetails ? (batchDetails as any).team : undefined,
      date: ("endTime" in batchDetails && (batchDetails as any).endTime)
        ? format(new Date(batchDetails.endTime as unknown as number), "MMM do, yyyy")
        : "Not started",
      time: ("endTime" in batchDetails && (batchDetails as any).endTime)
        ? format(new Date(batchDetails.endTime as unknown as number), "hh:mm a")
        : "Not started",
      totalDogs: batchDetails.totalDogs,
      batchNumber: "batchNumber" in batchDetails ? (batchDetails as any).batchNumber : undefined,
      status: batchDetails.status,
    }
    : null;

  // Get circle name for display
  // const area =
  //   batchDetails?.operationTask?.circle?.name ??
  //   batchDetails?.operationTask?.circle?.location?.name ??
  //   "Unknown Location";

  // Calculate gender counts
  // const male = dogs?.filter((d) => d.gender === "Male").length ?? 0;
  // const female = dogs?.filter((d) => d.gender === "Female").length ?? 0;

  const handleGoBack = (): void => {
    router.back();
  };

  const endBatchMutation = api.shelter.endBatchWithSupervisor.useMutation({
    onSuccess: () => {
      router.push({
        pathname: "/ABC/shelterScreens/fourthpage",
        params: { batchId: batchId as string },
      });
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const handleFourth = (): void => {
    if (!batchDetails) return;

    router.push({
      pathname: "/ABC/shelterScreens/fourthpage",
      params: { batchId: batchId as string },
    });
  };

  const handleNavigateToThird = (dog: Dog): void => {
    router.push({
      pathname: "/ABC/shelterScreens/thirdpage",
      params: {
        dogId: dog.id,
        dogTagId: dog.dog_tag_id,
        dogImageUrl: dog.dogImageUrl,
        gender: dog.gender,
        location: dog.location,
        weight: dog.weight?.toString(),
        block: dog.block,
        cageNo: dog.cageNumber,
        createdAt: dog.createdAt?.toISOString(),
        fullAddress: dog.fullAddress,
        feederName: dog.feederName,
        feederPhoneNumber: dog.feederPhoneNumber,
        dogColor: dog.dogColor,
        batchId: batchId as string,
        latitude:
          dog.coordinates?.latitude?.toString() ??
          (dog as any).latitude?.toString() ??
          undefined,
        longitude:
          dog.coordinates?.longitude?.toString() ??
          (dog as any).longitude?.toString() ??
          undefined,
      },
    });
  };

  const renderDogItem = ({ item, index }: { item: Dog; index: number }) => {
    // Show check mark if any shelter details are filled
    const isProcessedByShelter = Boolean(
      item.weight || item.block || item.cageNumber,
    );

    return (
      <View
        key={`${item.id}-${index}`}
        style={{
          width: "48%",
          marginBottom: 16,
          backgroundColor: "#fff",
          borderRadius: 8,
          borderWidth: 1,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 0.2,
        }}
        className="border-gray-100"
      >
        <Image
          source={{ uri: item.dogImageUrl }}
          style={{ width: "100%", height: 128 }}
          resizeMode="cover"
        />
        <View className=" px-2 py-6" >
          <Text
            className={`pb-1 text-xl font-semibold ${item.gender === "Female" ? "text-pink-500" : "text-blue-500"
              }`}
          >
            {item.dog_tag_id ?? item.id.slice(0, 6)}
          </Text>

          <View className="flex-row">
            <View className="flex-row items-center gap-2">
              <View
                className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${item.gender === "Female" ? "bg-pink-100" : "bg-blue-100"
                  }`}
              >
                <Ionicons
                  name={item.gender === "Female" ? "female" : "male"}
                  size={14}
                  color={item.gender === "Female" ? "#FF2F9E" : "#1B85F3"}
                />
                <Text
                  className={`text-xs font-normal ${item.gender === "Female" ? "text-pink-600" : "text-blue-600"
                    }`}
                >
                  {item.gender}
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                <FontAwesome5 name="palette" size={14} color={item.gender === "Female" ? "#FF2F9E" : "#1B85F3"} />
                <Text className={`text-xs font-medium text-gray-600 ${item.gender === "Female" ? "text-pink-600" : "text-blue-600"}`}>
                  {item.dogColor ?? "Unknown Color"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              className={`absolute right-1 bottom-48  items-center justify-center rounded-full  ${item.gender === "Female" ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"} ${isProcessedByShelter ? "bg-white  py-0" : "bg-[#1B85F3]"}`}
              onPress={() =>
                !isProcessedByShelter && handleNavigateToThird(item)
              }
              disabled={isProcessedByShelter}
            >
              {isProcessedByShelter ? (
                <FontAwesome5
                  name="check-circle"
                  size={24}
                  color="#22C55E"
                  solid
                />
              ) : (
                <Ionicons
                  className="ml-1"
                  name="chevron-forward-outline"
                  size={24}
                  color="white"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Blue Gradient Assignment Card */}
        {isLoadingBatch ? (
          <ActivityIndicator
            size="large"
            color="#1B85F3"
            style={{ marginTop: 20 }}
          />
        ) : (
          assignment && (
            <Animated.View
              className="absolute left-4 right-4 z-10 rounded-xl"
              style={{ opacity: blueCardOpacity }}
            >
              <LinearGradient
                colors={["white", "#00A5FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 5 }} // Adjusted end to ensure vertical gradient
                className="rounded-xl" // Remove p-6 to avoid Tailwind conflicts
                style={{
                  padding: 24, // Explicit padding (equivalent to p-6 in Tailwind)
                  borderWidth: 1,
                  borderColor: "#cfeeffab",
                  borderRadius: 16,
                }}
              >
                {/* Assignment Type */}
                <View className="mb-4 flex-row self-start rounded-full bg-[#DAECFF] p-2 px-6">
                  <Text className="rounded-full text-lg font-semibold text-[#2F88FF]">
                    {`${assignment.type} `}
                  </Text>

                  <Text className="rounded-full text-lg font-semibold uppercase text-[#2F88FF]">
                    - {assignment.batchNumber}
                  </Text>
                </View>

                {/* Assignment Details */}
                <View className="flex-1">
                  {/* Team */}
                  <View className="mb-1 flex-row items-center justify-between border-b border-[#1B85F3]/20 py-1">
                    <Text className="text-sm font-medium text-[#104D8D]">
                      Team
                    </Text>
                    <Text className="text-sm font-medium text-[#104D8D]">
                      {assignment.team?.name ?? "Unassigned"}
                    </Text>
                  </View>

                  {/* Date */}
                  <View className="mb-3 flex-row items-center justify-between border-b border-[#1B85F3]/20 py-1">
                    <Text className="text-sm font-medium text-[#104D8D]">
                      Date
                    </Text>
                    <Text className="text-sm font-medium text-[#104D8D]">
                      {assignment.date}
                    </Text>
                  </View>

                  {/* Time */}
                  <View className="mb-3 flex-row items-center justify-between border-b border-[#1B85F3]/20 py-1">
                    <Text className="text-sm font-medium text-[#104D8D]">
                      Time
                    </Text>
                    <Text className="text-sm font-medium text-[#104D8D]">
                      {assignment.time}
                    </Text>
                  </View>

                  {/* Total Dogs */}
                  <View className="mb-4 flex-row items-center justify-between border-b border-[#1B85F3]/20 py-1">
                    <Text className="text-sm font-medium text-[#104D8D]">
                      Total Dogs
                    </Text>
                    <Text className="text-sm font-medium text-[#104D8D]">
                      {assignment.totalDogs}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          )
        )}

        {/* Area Header */}
        {/* <View className="px-4 py-4 border-b border-gray-200 bg-white z-20">
          <Text className="mb-2 text-md font-bold text-center">{area}</Text>
          <View className="flex-row flex-wrap items-center justify-center">
            <View className="mr-4 flex-row justify-center items-center">
                <Ionicons name="male" size={18} color="#3B82F6" />
              <Text className="ml-1 font-xs  text-gray-600">{male} Males</Text>
              </View>
            <View className=" flex-row justify-center items-center">
                <Ionicons name="female" size={18} color="#EC4899" />
              <Text className="ml-1 font-xs  text-gray-600">{female} Females</Text>
            </View>
          </View>
        </View> */}

        {/* Bottom Sheet */}
        <Animated.View
          style={{
            height: bottomSheetHeight,
            flex: 1,
            marginTop: screenHeight * 0.3,
            backgroundColor: "#fff",
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: Platform.OS === "ios" ? 0.1 : 0, // Apply shadow only on iOS
            shadowRadius: Platform.OS === "ios" ? 8 : 0,
            elevation: Platform.OS === "android" ? 20 : 0, // Apply elevation only on Android
            overflow: "visible",
            zIndex: 30,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 12 }}>
            <View
              style={{
                backgroundColor: "#d1d5db",
                width: 66,
                height: 6,
                borderRadius: 3,
              }}
            />
          </View>
          {isLoadingDogs || isLoadingBatch ? (
            <ActivityIndicator
              size="large"
              color="#1B85F3"
              style={{ marginTop: 20 }}
            />
          ) : dogs && dogs.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={dogs.filter((dog) => dog.status !== "missing")}
              renderItem={renderDogItem}
              keyExtractor={(item) => `${item.id}`}
              numColumns={2}
              columnWrapperStyle={{
                justifyContent: "space-between",
                paddingHorizontal: 16,
              }}
              contentContainerStyle={{
                paddingTop: 16,
                paddingBottom: allDogsProcessed ? 100 : 20,
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#1B85F3"]} // Match your app's theme
                  progressBackgroundColor="#ffffff" // Optional: Customize background
                />
              }
            />
          ) : (
            <Text
              style={{ marginTop: 20, textAlign: "center", color: "#6b7280" }}
            >
              No dogs found for this batch.
            </Text>
          )}
        </Animated.View>

        {/* End Task Button */}
        {allDogsProcessed && (
          <TouchableOpacity
            style={{
              position: "absolute",
              bottom: 30,
              left: 20,
              right: 20,
              backgroundColor: "#3b82f6",
              paddingVertical: 16,
              borderRadius: 20,
              alignItems: "center",
              zIndex: 40,
            }}
            onPress={handleFourth}
          >
            <Text
              className="text-lg font-semibold text-white"
              style={{ color: "#fff", fontWeight: "600", fontSize: 18 }}
            >
              End Task
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default SecondPage;