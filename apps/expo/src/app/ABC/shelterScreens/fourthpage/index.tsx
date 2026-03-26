import type { GestureResponderEvent } from "react-native";
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { router, Stack, useLocalSearchParams } from "expo-router";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";

import { api } from "~/utils/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive scaling functions
const scale = (size: number) => (screenWidth / 375) * size;
const verticalScale = (size: number) => (screenHeight / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

interface TouchPoint {
  x: number;
  y: number;
}

interface BatchDetails {
  id: string;
  batchNumber: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  totalDogs: number;
  circleName: string;
  team: {
    id: string;
    name: string;
  } | null;
}

const DashboardPage = () => {
  const params = useLocalSearchParams();
  const { batchId } = params;

  const {
    data: batchDetails,
    isLoading: batchLoading,
    refetch: refetchBatchDetails,
  } = api.shelter.getBatchDetails.useQuery(
    { batchId: batchId as string },
    { enabled: !!batchId },
  ) as {
    data: BatchDetails | undefined;
    isLoading: boolean;
    refetch: () => void;
  };
  const { data: dogs, isLoading: dogsLoading } = api.shelter.getDogsByBatchId.useQuery(
    { batchId: batchId as string },
    { enabled: !!batchId },
  );
  const { data: currentUser, isLoading: userLoading } =
    api.user.getCurrentUser.useQuery();
  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();

  const missingCount = useMemo(() => {
    if (!dogs) return 0;
    return dogs.filter((d) => d.status === "missing").length;
  }, [dogs]);

  const receivedCount = useMemo(() => {
    return (batchDetails?.totalDogs ?? 0) - missingCount;
  }, [batchDetails?.totalDogs, missingCount]);

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const utils = api.useContext();

  const updateSupervisorDetails = api.shelter.updateSupervisorDetails.useMutation({
    onSuccess: () => {
      void utils.shelter.getAllBatches.invalidate();
      Alert.alert("Success", "Supervisor details updated successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/ABC/shelterScreens"),
        },
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
      setIsSubmitting(false);
    },
  });

  const endBatchTime = api.shelter.endBatchTime.useMutation({
    onSuccess: () => {
      console.log("Batch end time updated successfully");
      void refetchBatchDetails();
    },
    onError: (error) => {
      console.error("Error updating batch end time:", error);
      Alert.alert("Error", "Failed to update batch end time");
    },
  });

  useEffect(() => {
    if (batchId && !batchDetails?.endTime) {
      endBatchTime.mutate({ batchId: batchId as string });
    }
    setIsLoading(false);
  }, [batchId, batchDetails?.endTime]);

  const pathRef = useRef("");
  const signatureViewRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const extension = uri.split(".").pop()?.toLowerCase() || "";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      const uploadUrlResponse = await getUploadURL({
        folderName: "Ward-supervisor",
        contentType,
      });

      if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
        throw new Error("Failed to get upload URL");
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      await fetch(uploadUrlResponse.data.uploadParams, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": contentType,
        },
      });

      return uploadUrlResponse.data.fileUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleCameraPress = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Camera permission is required");
        return;
      }

      setIsSubmitting(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable crop/edit option
        quality: 0.8, // Match AddDogScreen's compression
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedPhoto(result.assets[0].uri); // Set local URI immediately
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePhoto = () => {
    Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setCapturedPhoto(null),
      },
    ]);
  };

  const getRelativePosition = (event: GestureResponderEvent): TouchPoint => {
    const x = event.nativeEvent.locationX || event.nativeEvent.pageX;
    const y = event.nativeEvent.locationY || event.nativeEvent.pageY;
    return { x, y };
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,

    onPanResponderGrant: (event: GestureResponderEvent) => {
      console.log("Touch started");
      setIsDrawing(true);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: false });
      }
      const point = getRelativePosition(event);
      console.log("Start point:", point);

      if (pathRef.current) {
        pathRef.current += ` M${Math.round(point.x)},${Math.round(point.y)}`;
      } else {
        pathRef.current = `M${Math.round(point.x)},${Math.round(point.y)}`;
      }
      setSignaturePath(pathRef.current);
    },

    onPanResponderMove: (event: GestureResponderEvent) => {
      if (isDrawing) {
        const point = getRelativePosition(event);
        console.log("Move point:", point);
        pathRef.current += ` L${Math.round(point.x)},${Math.round(point.y)}`;
        setSignaturePath(pathRef.current);
      }
    },

    onPanResponderRelease: () => {
      console.log("Touch ended");
      setIsDrawing(false);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
      }
    },

    onPanResponderTerminate: () => {
      console.log("Touch terminated");
      setIsDrawing(false);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
      }
    },

    onShouldBlockNativeResponder: () => true,
  });

  const clearSignature = () => {
    setSignaturePath("");
    pathRef.current = "";
  };

  const handleConfirm = async () => {
    if (!currentUser?.name || !capturedPhoto || !signaturePath) {
      Alert.alert(
        "Error",
        "Please provide photo and signature to continue.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedUrl = await uploadImage(capturedPhoto); // Upload during submission
      updateSupervisorDetails.mutate({
        batchId: batchId as string,
        supervisorName: currentUser.name,
        supervisorPhotoUrl: uploadedUrl,
        supervisorSignatureUrl: signaturePath,
        dogsReceived: receivedCount,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to submit details. Please try again.");
      console.error("Error submitting:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    console.log("Form cancelled");
    router.back();
  };

  if (batchLoading || userLoading || dogsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1B85F3" />
        <Text className="mt-2 text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ title: "Task Complete" }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1B85F3" />
          <Text className="mt-2 text-gray-500">Loading...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: scale(20),
            paddingTop: verticalScale(20),
            paddingBottom: verticalScale(120),
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDrawing}
        >
          <View className="mb-5 rounded-lg bg-white shadow-md">
            <View className="mb-3 flex-row justify-between px-2">
              <Text className="text-2xl font-semibold text-gray-600">
                Capture
              </Text>
              <Text className="items-end text-2xl font-semibold text-gray-800">
                {batchDetails?.circleName ?? "Unknown Location"}
              </Text>
            </View>
            <View className="mb-3 mt-4 flex-row justify-between px-2">
              <Text className="text-lg font-medium text-gray-500">
                Total Dogs
              </Text>
              <Text className="text-lg font-semibold text-gray-800">
                {batchDetails?.totalDogs ?? 0}
              </Text>
            </View>
            <View className="mb-3 flex-row justify-between px-2">
              <Text className="text-lg font-medium text-gray-500">
                Missing Dogs
              </Text>
              <Text className="text-lg font-semibold text-gray-800">
                {missingCount}
              </Text>
            </View>
            <View className="mb-3 flex-row justify-between px-2">
              <Text className="text-lg font-medium text-gray-500">
                Time of Completion
              </Text>
              <Text className="text-lg font-semibold text-gray-800">
                {batchDetails?.endTime
                  ? new Date(batchDetails.endTime).toLocaleString()
                  : "Not completed"}
              </Text>
            </View>
          </View>

          {/* Supervisor Photo Section */}
          <View className="mb-4">
            <View className="flex-row items-center gap-5 py-2">
              <View className="h-14 w-14 items-center justify-center rounded-lg bg-blue-100/50">
                <Entypo name="camera" size={30} color="#007AFF" />
              </View>
              <Text className="flex-1 text-xl font-medium text-black">
                Supervisor Photo
              </Text>
              {capturedPhoto ? (
                <View className="flex-row items-center gap-24">
                  <View className="relative">
                    <Image
                      source={{ uri: capturedPhoto }}
                      className="w-20 h-20 rounded-lg"
                    />
                    {isSubmitting && (
                      <View className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <ActivityIndicator size="small" color="#007AFF" />
                      </View>
                    )}
                    <TouchableOpacity
                      className="absolute right-0 top-0 h-5 w-5 items-center justify-center rounded-full bg-[#b80e0e]"
                      onPress={handleDeletePhoto}
                      disabled={isSubmitting}
                    >
                      <AntDesign name="close" size={12} color="white" />
                    </TouchableOpacity>
                  </View>
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-[#0EB880]">
                    <AntDesign name="check" size={16} color="white" />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  className="h-8 w-8 items-center justify-center rounded-full bg-blue-100/50"
                  onPress={handleCameraPress}
                  disabled={isSubmitting}
                >
                  <AntDesign
                    name="plus-circle"
                    size={24}
                    color={isSubmitting ? "#999" : "#007AFF"}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Supervisor Name Display */}
          <View className="mb-4 flex-row items-center gap-5 py-2">
            <View className="h-14 w-14 items-center justify-center rounded-lg bg-blue-100/50">
              <FontAwesome name="user" size={30} color="#007AFF" />
            </View>
            <Text className="text-md flex text-xl font-semibold text-black">
              {currentUser?.name ?? "Loading..."}
            </Text>
          </View>

          {/* Dogs Received Section */}
          <View className="mb-6 mt-4">
            <Text className="mb-4 text-xl font-semibold text-black">
              Dogs Received
            </Text>
            <Text className="text-md rounded-lg bg-[#EEF6FF] px-6 py-5 font-medium">
              {dogsLoading ? "--" : receivedCount}
            </Text>  
          </View>

          {/* Supervisor Signature Section */}
          <View className="flex-row items-center gap-5 py-2">
            <View className="h-14 w-14 items-center justify-center rounded-lg bg-blue-100/50">
              <MaterialCommunityIcons
                name="draw-pen"
                size={30}
                color="#007AFF"
              />
            </View>
            <Text className="flex text-xl font-medium text-black">
              Supervisor Signature
            </Text>
            {signaturePath && (
              <TouchableOpacity
                className="rounded bg-red-500 px-3 py-1.5"
                onPress={clearSignature}
                disabled={isSubmitting}
              >
                <Text className="text-xs font-medium text-white">Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Signature Canvas */}
          <View className="mb-5 mt-4 rounded-2xl bg-[#F9F9F9]">
            <View className="rounded-lg">
              <View
                ref={signatureViewRef}
                className="relative h-80 items-center justify-center"
                {...panResponder.panHandlers}
              >
                <Svg
                  height={verticalScale(220)}
                  width={screenWidth - scale(40)}
                  className="absolute left-0 top-0"
                  pointerEvents="none"
                >
                  {signaturePath && (
                    <Path
                      d={signaturePath}
                      stroke="#000"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </Svg>
                {!signaturePath && (
                  <View
                    className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
                    pointerEvents="none"
                  >
                    <Text className="text-center text-xl font-medium text-gray-500">
                      Sign here
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom Buttons */}
      <View className="absolute bottom-0 left-0 right-0 min-h-20 flex-row gap-3 bg-white px-5 pb-8 pt-2.5">
        <TouchableOpacity
          className="flex-1 items-center justify-center rounded-lg border border-gray-300 py-4"
          onPress={handleCancel}
          disabled={isSubmitting}
        >
          <Text className="text-xl font-medium text-gray-600">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center justify-center rounded-lg py-4 ${isSubmitting ? "bg-gray-400" : "bg-blue-500"
            }`}
          onPress={handleConfirm}
          disabled={isSubmitting}
        >
          <Text className="text-xl font-semibold text-white">
            {isSubmitting ? "Submitting..." : "Confirm"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DashboardPage;