import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { router, useLocalSearchParams } from "expo-router";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { format } from "date-fns";

import { api } from "~/utils/api";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 40;
const MAX_SLIDE = SLIDER_WIDTH - 60;
const SLIDE_THRESHOLD = MAX_SLIDE * 0.7; // Lowered to 70% for smoother triggering

const DogProfile = () => {
  const params = useLocalSearchParams();
  const {
    dogId,
    dogTagId,
    dogImageUrl,
    gender,
    location,
    weight: initialWeight,
    block: initialBlock,
    cageNo: initialCageNo,
    createdAt,
    fullAddress,
    dogColor,
    batchId,
    latitude: latitudeParam,
    longitude: longitudeParam,
  } = params;

  // Parse coordinates (params come as string | string[] | undefined)
  const latitudeStr = Array.isArray(latitudeParam) ? latitudeParam[0] : latitudeParam;
  const longitudeStr = Array.isArray(longitudeParam) ? longitudeParam[0] : longitudeParam;
  const latitudeNum = latitudeStr ? parseFloat(latitudeStr) : undefined;
  const longitudeNum = longitudeStr ? parseFloat(longitudeStr) : undefined;
  const latitude = latitudeNum;
  const longitude = longitudeNum;

  // Ensure we have string values and create a ref for current values
  const formDataRef = useRef({
    bodyWeight: "",
    blockNo: "",
    cageNo: "",
  });

  const statusRef = useRef("captured");

  const [formData, setFormData] = useState({
    bodyWeight: Array.isArray(initialWeight)
      ? initialWeight[0]
      : (initialWeight ?? ""),
    blockNo: Array.isArray(initialBlock)
      ? initialBlock[0]
      : (initialBlock ?? ""),
    cageNo: Array.isArray(initialCageNo)
      ? initialCageNo[0]
      : (initialCageNo ?? ""),
  });

  const [selectedStatus, setSelectedStatus] = useState("captured");
  const [taskStarted, setTaskStarted] = useState(false);
  
  // Reanimated 3 shared values
  const dragX = useSharedValue(0);
  const isSliderLocked = useRef(false);

  // Use the new shelter API endpoint
  const updateDogStatus = api.shelter.updateDogStatus.useMutation({
    onSuccess: (data) => {
      console.log("Update success:", data);
      // Navigate directly to the second page with the updated dog ID
      router.push({
        pathname: "/ABC/shelterScreens/sencondpage",
        params: {
          batchId: Array.isArray(batchId) ? batchId[0] : batchId,
          recentlyUpdatedDogId: dogId,
        },
      });
    },
    onError: (error) => {
      console.error("Update error:", error);
      Alert.alert("Error", error.message);
    },
  });

  const handleGoBack = () => {
    router.back();
  };

  // Update form data
  const updateFormData = (field: keyof typeof formData, value: string) => {
    console.log(`Updating ${field}:`, value);
    // Update both the state and ref
    formDataRef.current[field] = value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStatusChange = (status: string) => {
    statusRef.current = status;
    setSelectedStatus(status);
  };

  const handleSlideToSubmit = () => {
    const currentStatus = statusRef.current;
    console.log("Starting submission with status:", currentStatus);
    // Use the ref values for submission
    const currentFormData = formDataRef.current;
    console.log("Form data before submission:", currentFormData);

    if (!dogId || Array.isArray(dogId)) {
      Alert.alert("Error", "Invalid dog ID");
      return;
    }

    // If status is escaped, treat it as missing without requiring form fields
    if (currentStatus === "escaped") {
      updateDogStatus.mutate({
        dogId,
        status: "missing",
      });
      return;
    }

    // For captured status, validate form fields
    if (currentStatus === "captured") {
      // Parse and validate weight
      let weight: number | undefined = undefined;
      if (currentFormData.bodyWeight) {
        weight = parseFloat(currentFormData.bodyWeight);
        if (isNaN(weight)) {
          Alert.alert("Error", "Please enter a valid number for weight");
          return;
        }
      }

      // Validate at least one field is filled for captured status
      if (
        !currentFormData.bodyWeight &&
        !currentFormData.blockNo &&
        !currentFormData.cageNo
      ) {
        Alert.alert("Error", "Please fill in at least one field");
        return;
      }

      // Prepare mutation data with current values
      const mutationData = {
        dogId,
        status: "captured" as const,
        weight,
        block: currentFormData.blockNo || undefined,
        cageNo: currentFormData.cageNo || undefined,
      };

      console.log("Mutation data:", mutationData);
      updateDogStatus.mutate(mutationData);
    }
  };

  // Animated styles using Reanimated 3
  const sliderBackgroundStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      dragX.value,
      [0, SLIDE_THRESHOLD],
      ["#F3F4F6", "#2F88FF"]
    );
    return { backgroundColor };
  });

  const sliderTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      dragX.value,
      [0, SLIDE_THRESHOLD],
      ["#374151", "#FFFFFF"]
    );
    return { color };
  });

  const sliderHandleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: dragX.value }],
    };
  });

  // Gesture handler for smooth sliding
  const handleSlideSubmit = () => {
    setTaskStarted(true);
    isSliderLocked.current = true;
    handleSlideToSubmit();
  };

  // Modern Gesture API
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (!taskStarted && !isSliderLocked.current) {
        const translationX = Math.max(0, Math.min(event.translationX, MAX_SLIDE));
        dragX.value = translationX;
        
        // Check if we've reached the threshold
        if (translationX >= SLIDE_THRESHOLD && !taskStarted) {
          dragX.value = withTiming(MAX_SLIDE, { duration: 200 });
          runOnJS(handleSlideSubmit)();
        }
      }
    })
    .onEnd((event) => {
      'worklet';
      if (!taskStarted && !isSliderLocked.current) {
        if (event.translationX >= SLIDE_THRESHOLD) {
          dragX.value = withTiming(MAX_SLIDE, { duration: 200 });
          runOnJS(handleSlideSubmit)();
        } else {
          dragX.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      }
    })
    .enabled(!taskStarted && !isSliderLocked.current);

  const formattedDate = createdAt
    ? format(new Date(createdAt as string), "d MMMM yyyy")
    : "3 November 2019"; // Static date from image

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-gray-100">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Dog Image Container with Overlapping Back Button */}
        <View className="relative">
          <View
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_WIDTH,
              position: "relative",
            }}
          >
            <Image
              source={{ uri: dogImageUrl as string }}
              style={{
                width: "100%",
                height: "100%",
              }}
              resizeMode="cover"
            />
            {/* Back Button Overlay */}
            <TouchableOpacity
              onPress={handleGoBack}
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                width: 40,
                height: 40,
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                borderRadius: 20,
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10,
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            {/* Dog ID Overlay */}
            <View className="absolute bottom-16 left-4">
              <Text className="text-lg font-bold text-white">
                ID: {dogTagId || "KOMPO01"}
              </Text>
            </View>

            {/* Gender and Color Buttons */}
            <View
              className="absolute bottom-4 left-4 flex-row"
              style={{ gap: 10 }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: gender === "Female" ? "#FF2F9E" : "#1976D2",
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  minWidth: 70,
                }}
              >
                <FontAwesome
                  name={gender === "Female" ? "venus" : "mars"}
                  size={16}
                  color="white"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-sm font-medium text-white">
                  {gender || "Female"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: "#1976D2",
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  minWidth: 70,
                }}
              >
                <MaterialCommunityIcons
                  name="palette"
                  size={20}
                  color="white"
                  className="mr-2"
                />
                <Text className="text-sm font-medium text-white">
                  {dogColor || "Unknown"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* White Card Container - Reduced top margin to eliminate gap */}
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            borderRadius: 34,
            backgroundColor: "white",
            paddingHorizontal: 20,
            paddingTop: 30,
            paddingBottom: 20,
          }}
        >
          {/* Status Section */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-medium text-gray-700">
                Status
              </Text>
              <View className="flex-row rounded-full bg-[#F3F4F6]">
                <TouchableOpacity
                  onPress={() => handleStatusChange("captured")}
                  style={{
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderBottomRightRadius: 16,
                    backgroundColor:
                      selectedStatus === "captured" ? "#B3E5FC" : "#F3F4F6",
                    paddingHorizontal: 28,
                    paddingVertical: 13,
                  }}
                >
                  <Text
                    style={{
                      color: selectedStatus === "captured" ? "#1976D2" : "#666",
                      fontWeight: "600",
                      fontFamily: "DMSans-Medium",
                    }}
                  >
                    Captured
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleStatusChange("escaped")}
                  style={{
                    borderTopRightRadius: 16,
                    borderBottomRightRadius: 16,
                    borderTopLeftRadius: 16,
                    borderBottomLeftRadius: 16,
                    backgroundColor:
                      selectedStatus === "escaped" ? "#B3E5FC" : "#F3F4F6",
                    paddingHorizontal: 26,
                    paddingVertical: 13,
                  }}
                >
                  <Text
                    style={{
                      color: selectedStatus === "escaped" ? "#1976D2" : "#666",
                      fontWeight: "600",
                      fontFamily: "DMSans-Medium",
                    }}
                  >
                    Escaped
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Show fields only if status is 'captured' */}
          {selectedStatus === "captured" && (
            <>
              {/* Body Weight */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-medium text-gray-700">
                    Body Weight
                  </Text>
                  <TextInput
                    value={formData.bodyWeight}
                    onChangeText={(text) => {
                      // Only allow numbers and decimal point
                      const filtered = text.replace(/[^0-9.]/g, "");
                      // Prevent multiple decimal points
                      if (filtered.split(".").length > 2) return;
                      updateFormData("bodyWeight", filtered);
                    }}
                    placeholder="Enter number (kg)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    className="ml-20 flex-1 rounded-2xl bg-blue-50 px-6 py-4 text-left text-base font-light"
                  />
                </View>
              </View>
              {/* Block No */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-medium text-gray-700">
                    Block Number
                  </Text>
                  <TextInput
                    value={formData.blockNo}
                    onChangeText={(text) => updateFormData("blockNo", text)}
                    placeholder="Enter number"
                    placeholderTextColor="#9CA3AF"
                    className="ml-16 flex-1 rounded-2xl bg-blue-50 px-6 py-4 text-left text-base font-light"
                  />
                </View>
              </View>
              {/* Cage No */}
              <View className="mb-8">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-medium text-gray-700">
                    Cage Number
                  </Text>
                  <TextInput
                    value={formData.cageNo}
                    onChangeText={(text) => updateFormData("cageNo", text)}
                    placeholder="Enter number"
                    placeholderTextColor="#9CA3AF"
                    className="ml-16 flex-1 rounded-2xl bg-blue-50 px-6 py-4 text-left text-base font-light"
                  />
                </View>
              </View>
            </>
          )}

          {/* Date Section */}
          <View className="mb-6 flex-row items-center">
            <Ionicons
              name="calendar-clear"
              size={24}
              color="#2F88FF"
              style={{
                marginRight: 12,
                backgroundColor: "#E8F3FF",
                padding: 16,
                borderRadius: 10,
              }}
            />
            <View>
              <Text className="text-base text-gray-500">Date of Capture</Text>
              <Text className="text-base font-medium text-gray-800">
                {formattedDate}
              </Text>
            </View>
          </View>

          {/* Location Section */}
          <View className="mb-6 flex-row items-center">
            <Ionicons
              name="location"
              size={24}
              color="#2F88FF"
              style={{
                marginRight: 12,
                backgroundColor: "#E8F3FF",
                padding: 16,
                borderRadius: 10,
              }}
            />
            <View>
              <Text className="text-sm text-gray-500">GPS Location</Text>
              <Text className="text-base font-medium text-gray-800">
                {fullAddress || "Jubilee Hills, Hyderabad"}
              </Text>
            </View>
          </View>

          {/* Map */}
          <View className="mb-8" style={{ position: "relative" }}>
            {latitude !== undefined && longitude !== undefined ? (
              <MapView
                style={{ width: "100%", height: 150, borderRadius: 12 }}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: latitudeNum as number,
                  longitude: longitudeNum as number,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                showsUserLocation={false}
                showsMyLocationButton={false}
                loadingEnabled={true}
              >
                <Marker coordinate={{ latitude: latitudeNum as number, longitude: longitudeNum as number }} />
              </MapView>
            ) : (
              <View
                style={{
                  width: "100%",
                  height: 150,
                  backgroundColor: "#C5C9D6",
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#374151" }}>No coordinates</Text>
              </View>
            )}
          </View>

          {/* Slide to Submit */}
          <View style={{ paddingHorizontal: 8 }}>
            <Animated.View
              style={[
                {
                  height: 80,
                  borderRadius: 60,
                  flexDirection: "row",
                  alignItems: "center",
                  position: "relative",
                  overflow: "hidden",
                  marginBottom: 32,
                  marginTop: 8,
                },
                taskStarted ? { backgroundColor: "#2F88FF" } : sliderBackgroundStyle,
              ]}
            >
              <View className="absolute left-0 right-0 top-0 h-full items-center justify-center">
                <Animated.Text
                  style={[
                    {
                      fontSize: 16,
                      fontWeight: "500",
                      fontFamily: "DMSans-Medium",
                    },
                    taskStarted ? { color: "#FFFFFF" } : sliderTextStyle,
                  ]}
                >
                  {taskStarted ? "Submitting..." : "Slide to Submit"}
                </Animated.Text>
              </View>
              {!taskStarted && (
                <GestureDetector gesture={panGesture}>
                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        height: "90%",
                        width: 70,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#2F88FF",
                        borderRadius: 60,
                        marginLeft: 4,
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
              )}
            </Animated.View>
          </View>
        </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default DogProfile;
