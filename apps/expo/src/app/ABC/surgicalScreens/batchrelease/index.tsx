import React, { useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Svg, { Path } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AntDesign,
  Feather,
  FontAwesome,
  Fontisto,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
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

interface FormData {
  doctorName: string;
  remarks: string;
  selectedDate: string;
  photo: string | null;
  signature: string;
}

const BatchReleaseScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { batchId, batchNumber, totalDogs, type, dateTime } = params;

  // TRPC utils for cache invalidation
  const utils = api.useUtils();

  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();
  const { mutate: updateBatchRelease } =
    api.surgery.updateBatchRelease.useMutation({
      onSuccess: async () => {
        // Invalidate cached surgery batches so lists refresh
        await utils.surgery.getSurgeryBatches.invalidate();
        Alert.alert("Success", "Batch release details updated successfully!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      },
      onError: (error) => {
        Alert.alert(
          "Error",
          "Failed to update batch release details. Please try again.",
          [{ text: "OK" }],
        );
        console.error("Error updating batch release:", error);
      },
    });

  // Current date and time without seconds
  const currentDateTime = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pathRef = useRef("");
  const signatureViewRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize React Hook Form with validation rules
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      doctorName: "",
      remarks: "",
      selectedDate: "",
      photo: null,
      signature: "",
    },
    mode: "onSubmit",
  });

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const extension = uri.split(".").pop()?.toLowerCase() || "";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      const uploadUrlResponse = await getUploadURL({
        folderName: "Doctor-supervisor",
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
        setValue("photo", result.assets[0].uri); // Set local URI immediately
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
        onPress: () => setValue("photo", null),
      },
    ]);
  };

  const getRelativePosition = (event: GestureResponderEvent): TouchPoint => {
    const x = event.nativeEvent.locationX || event.nativeEvent.pageX || 0;
    const y = event.nativeEvent.locationY || event.nativeEvent.pageY || 0;
    // Ensure coordinates are within canvas bounds
    return {
      x: Math.max(0, Math.min(x, screenWidth - scale(40))),
      y: Math.max(0, Math.min(y, verticalScale(300))), // Match canvas height
    };
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (event: GestureResponderEvent) => {
      setIsDrawing(true);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: false });
      }
      const point = getRelativePosition(event);
      if (point.x >= 0 && point.y >= 0 && point.y <= verticalScale(300)) {
        pathRef.current = pathRef.current
          ? `${pathRef.current} M${Math.round(point.x)},${Math.round(point.y)}`
          : `M${Math.round(point.x)},${Math.round(point.y)}`;
        setValue("signature", pathRef.current);
      }
    },
    onPanResponderMove: (event: GestureResponderEvent) => {
      if (isDrawing) {
        const point = getRelativePosition(event);
        if (point.x >= 0 && point.y >= 0 && point.y <= verticalScale(300)) {
          pathRef.current += ` L${Math.round(point.x)},${Math.round(point.y)}`;
          setValue("signature", pathRef.current);
        }
      }
    },
    onPanResponderRelease: () => {
      setIsDrawing(false);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
      }
    },
    onPanResponderTerminate: () => {
      setIsDrawing(false);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
      }
    },
    onShouldBlockNativeResponder: () => true,
  });

  const clearSignature = () => {
    setValue("signature", "");
    pathRef.current = "";
  };

  const onSubmit = async (data: FormData) => {
    if (!batchId) {
      Alert.alert("Error", "No batch number provided");
      return;
    }

    if (!selectedDate) {
      Alert.alert("Error", "Please select a release date");
      return;
    }

    if (!data.photo) {
      Alert.alert("Error", "Please upload a doctor photo");
      return;
    }

    if (!data.doctorName) {
      Alert.alert("Error", "Please enter doctor name");
      return;
    }

    if (!data.signature) {
      Alert.alert("Error", "Please provide a doctor signature");
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedUrl = await uploadImage(data.photo); // Upload during submission
      Alert.alert(
        "Confirm Release Details",
        "Are you sure you want to submit these release details?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Submit",
            onPress: async () => {
              await updateBatchRelease({
                batchId: batchId as string,
                doctorName: data.doctorName,
                doctorPhoto: uploadedUrl,
                doctorSignature: data.signature,
                releaseDate: selectedDate!,
                remarks: data.remarks,
              });
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "Failed to submit details. Please try again.");
      console.error("Error submitting:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const showDatePicker = () => {
    setDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisible(false);
  };

  const handleConfirm = (date: Date) => {
    setSelectedDate(date);
    setValue("selectedDate", date.toDateString());
    hideDatePicker();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FBFBFB]">
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-5 pt-5"
        contentContainerStyle={{ paddingBottom: verticalScale(120) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDrawing}
      >
        {/* Batch Release Details Card */}
        <View className="mb-5 rounded-2xl bg-white shadow-md">
          <View className="px-6 pt-6">
            <View className="flex-row justify-between">
              <Text className="text-xl font-medium text-black">
                Batch Release
              </Text>
              <Text className="text-xl font-medium uppercase text-black">
                {batchNumber ?? batchId}
              </Text>
            </View>
          </View>
          <View className="rounded-lg px-6 py-6">
            <View className="mb-2 flex-row justify-between">
              <Text className="font-regular text-md text-[#A4ACB9]">
                Dogs To be Released
              </Text>
              <Text className="text-md font-medium text-black">
                {totalDogs}
              </Text>
            </View>
            <View className="h-px w-full" />
            <View className="flex-row justify-between">
              <Text className="font-regular text-md text-[#A4ACB9]">
                Surgery Completion Time
              </Text>
              <Text className="text-md font-medium text-black">{dateTime}</Text>
            </View>
          </View>
        </View>

        {/* Date Selection Section */}
        <View className="mb-2">
          <Controller
            control={control}
            name="selectedDate"
            rules={{ required: "This field is required" }}
            render={({ field: { value, onChange } }) => (
              <View>
                <TouchableOpacity
                  className="flex-row items-center rounded-lg px-2 py-1"
                  onPress={showDatePicker}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name="calendar-clear-outline"
                    size={16}
                    color={isSubmitting ? "#999" : "#1B85F3"}
                    className="mr-2"
                  />
                  <Text
                    className={`font-regular flex-1 text-sm ${isSubmitting ? "text-gray-400" : "text-[#1B85F3]"
                      }`}
                  >
                    {value || "Set release date"}
                  </Text>
                </TouchableOpacity>
                <DateTimePickerModal
                  isVisible={isDatePickerVisible}
                  mode="date"
                  onConfirm={(date) => {
                    handleConfirm(date);
                    onChange(date.toDateString());
                  }}
                  onCancel={hideDatePicker}
                  date={selectedDate || new Date()}
                  minimumDate={new Date()}
                />
                {errors.selectedDate && (
                  <Text className="font-regular mt-1 text-xs text-red-700">
                    {errors.selectedDate.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Remarks Section */}
        <View className="mb-8">
          <Controller
            control={control}
            name="remarks"
            rules={{ required: "This field is required" }}
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput
                  className="text-md h-28 rounded-lg bg-white px-3 py-2.5 font-light text-black"
                  placeholder="Enter Remarks"
                  placeholderTextColor="#999"
                  value={value}
                  onChangeText={onChange}
                  multiline
                  numberOfLines={4}
                  style={{ textAlignVertical: "top" }}
                  editable={!isSubmitting}
                />
                {errors.remarks && (
                  <Text className="font-regular mt-1 text-xs text-red-700">
                    {errors.remarks.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Doctor Photo Section */}
        <View className="mb-3 items-center rounded-2xl bg-white p-4 py-6 shadow-md">
          <Controller
            control={control}
            name="photo"
            rules={{ required: "This field is required" }}
            render={({ field: { value } }) => (
              <View className="w-full">
                <View className="flex-row items-center">
                  <View className="mr-4 h-14 w-14 items-center justify-center rounded-lg bg-[#D1E6FF80]">
                    <FontAwesome name="camera" size={24} color="#2F88FF" />
                  </View>
                  <Text className="font-regular flex-1 text-lg text-black">
                    Doctor Photo
                  </Text>
                  {value ? (
                    <View className="flex-row items-center gap-24">
                      <View className="relative">
                        <Image
                          source={{ uri: value }}
                          className="h-16 w-16 rounded-lg"
                        />
                        {isSubmitting && (
                          <View className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                            <ActivityIndicator size="small" color="#2F88FF" />
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
                      className="h-8 w-8 items-center justify-center rounded-full bg-[#D1E6FF80]"
                      onPress={handleCameraPress}
                      disabled={isSubmitting}
                    >
                      <Feather
                        name="plus"
                        size={20}
                        color={isSubmitting ? "#999" : "#2F88FF"}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                {errors.photo && (
                  <Text className="font-regular mt-1 text-xs text-red-700">
                    {errors.photo.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Doctor Name Section */}
        <View className="mb-3 flex-row items-center rounded-2xl bg-white p-4 py-6 shadow-md">
          <View className="mr-3 h-14 w-14 items-center justify-center rounded-lg bg-[#D1E6FF80]">
            <Fontisto name="doctor" size={24} color="#2F88FF" />
          </View>
          <Controller
            control={control}
            name="doctorName"
            rules={{ required: "This field is required" }}
            render={({ field: { onChange, value } }) => (
              <View className="flex-1">
                <TextInput
                  className="font-regular rounded-lg py-2.5 text-lg text-black"
                  placeholder="Enter Doctor name"
                  placeholderTextColor="#999"
                  value={value}
                  onChangeText={onChange}
                  editable={!isSubmitting}
                />
                {errors.doctorName && (
                  <Text className="font-regular mt-1 text-xs text-red-700">
                    {errors.doctorName.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Doctor Signature Section */}
        <View className="rounded-2xl bg-white px-5 py-5">
          <View className="flex-row items-center">
            <View className="mr-4 h-14 w-14 items-center justify-center rounded-lg bg-[#D1E6FF80]">
              <MaterialCommunityIcons
                name="draw-pen"
                size={24}
                color="#1B85F3"
              />
            </View>
            <Text className="font-regular flex-1 text-lg text-black">
              Doctor Signature
            </Text>
            {control._formValues.signature && (
              <TouchableOpacity
                className="rounded-sm bg-red-500 px-4 py-2"
                onPress={clearSignature}
                disabled={isSubmitting}
              >
                <Text className="text-xs font-light text-white">Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Signature Canvas */}
          <View className="mb-5 mt-2 rounded-2xl bg-[#F9F9F9]">
            <Controller
              control={control}
              name="signature"
              rules={{ required: "This field is required" }}
              render={() => (
                <View className="rounded-lg">
                  <View
                    ref={signatureViewRef}
                    className="relative items-center justify-center"
                    style={{ height: verticalScale(300) }} // Adjusted canvas height
                    {...panResponder.panHandlers}
                  >
                    <Svg
                      height={verticalScale(300)} // Match View height
                      width={screenWidth - scale(40)}
                      className="absolute left-0 top-0"
                      pointerEvents="none"
                    >
                      {control._formValues.signature && (
                        <Path
                          d={control._formValues.signature}
                          stroke="#000"
                          strokeWidth="3"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </Svg>
                    {!control._formValues.signature && (
                      <View
                        className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
                        pointerEvents="none"
                      >
                        <Text className="font-regular text-md text-center text-gray-500">
                          Sign here
                        </Text>
                      </View>
                    )}
                  </View>
                  {errors.signature && (
                    <Text className="font-regular mt-1 text-xs text-red-700">
                      {errors.signature.message}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="absolute bottom-6 left-0 right-0 min-h-[80px] flex-row gap-3 bg-white px-5 py-4">
        <TouchableOpacity
          className="flex-1 items-center justify-center rounded-lg border border-[#1B85F3] py-4"
          onPress={handleCancel}
          disabled={isSubmitting}
        >
          <Text className="font-regular text-base text-[#1B85F3]">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center justify-center rounded-lg py-4 ${isSubmitting ? "bg-gray-400" : "bg-[#1B85F3]"
            }`}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          <Text className="text-base font-medium text-white">
            {isSubmitting ? "Submitting..." : "Confirm"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default BatchReleaseScreen;