import type { JSX } from "react";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { AntDesign, Entypo, Feather, Ionicons } from "@expo/vector-icons";

import { api } from "~/utils/api";

interface DogCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onAddDog: (dog: DogData) => void;
  operationTaskId: string;
  batchId: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DogData {
  id: string;
  image: { uri: string };
  dogid: string;
  gender: string;
  timestamp: string;
  location?: string;
  coordinates?: Coordinates;
  fullAddress?: string;
  feederName?: string;
  feederPhoneNumber?: string;
  dogColor?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DogCaptureModal = ({
  visible,
  onClose,
  onAddDog,
  operationTaskId,
  batchId,
}: DogCaptureModalProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("Male");
  const [location, setLocation] = useState<string | undefined>();
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>();
  const [fullAddress, setFullAddress] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [timestamp, setTimestamp] = useState<string>("");
  const [step, setStep] = useState<number>(2); // Changed to 2 so we're always on preview step once we have an image
  const [photoTaken, setPhotoTaken] = useState(false);
  const [previewDate, setPreviewDate] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>("Male");
  const [feederName, setFeederName] = useState<string>("");
  const [feederPhoneNumber, setFeederPhoneNumber] = useState<string>("");
  const [dogColor, setDogColor] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();
  const { mutateAsync: uploadCapturedDog } =
    api.task.uploadCapturedDog.useMutation();

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      if (location) {
        setCoordinates({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Get address from coordinates
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (addresses[0]) {
          const address = addresses[0];
          setLocation(address.name ?? address.street ?? "");
          setFullAddress(
            [
              address.street,
              address.city,
              address.region,
              address.country,
              address.postalCode,
            ]
              .filter(Boolean)
              .join(", "),
          );
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get location");
    }
  };

  // Effect to trigger camera when modal becomes visible
  useEffect(() => {
    if (visible && !image) {
      void takePhoto();
    }
  }, [visible]);

  // Effect to get location when modal becomes visible
  useEffect(() => {
    if (visible) {
      void getLocation();
    }
  }, [visible]);

  const generateDogId = (): string => {
    return "240325–BC001M";
  };

  const getTimestamp = () => {
    const now = new Date();
    // Format 1: Detailed timestamp (for storing + next page)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const fullTimestamp = `${year}–${month}–${day} / ${hours}:${minutes}:${seconds}`;

    // Format 2: Human readable date (for preview)
    const previewDate = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return { fullTimestamp, previewDate };
  };

  const takePhoto = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Camera permission is required");
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: true, // Enable EXIF data collection
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImage(asset.uri);

        // Get location from image EXIF data
        if (asset.exif?.GPSLatitude && asset.exif.GPSLongitude) {
          const latitude = asset.exif.GPSLatitude;
          const longitude = asset.exif.GPSLongitude;

          setCoordinates({
            latitude,
            longitude,
          });

          // Get address from coordinates
          const addresses = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });

          if (addresses[0]) {
            const address = addresses[0];
            setLocation(address.name ?? address.street ?? "");
            setFullAddress(
              [
                address.street,
                address.city,
                address.region,
                address.country,
                address.postalCode,
              ]
                .filter(Boolean)
                .join(", "),
            );
          }
        } else {
          // Fallback to device location if no EXIF data
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const location = await Location.getCurrentPositionAsync({});
            setCoordinates({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            const addresses = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            if (addresses[0]) {
              const address = addresses[0];
              setLocation(address.name ?? address.street ?? "");
              setFullAddress(
                [
                  address.street,
                  address.city,
                  address.region,
                  address.country,
                  address.postalCode,
                ]
                  .filter(Boolean)
                  .join(", "),
              );
            }
          }
        }

        const { fullTimestamp, previewDate } = getTimestamp();
        setTimestamp(fullTimestamp);
        setPreviewDate(previewDate);
      } else {
        resetModal();
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
      resetModal();
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const extension = uri.split(".").pop()?.toLowerCase() || "";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      const uploadUrlResponse = await getUploadURL({
        folderName: "captured-dogs",
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

  const handleAddDog = async (): Promise<void> => {
    if (!image) {
      Alert.alert("Error", "Please capture or select a dog image");
      return;
    }

    // Feeder details are optional. Validate phone number only if provided.
    if (feederPhoneNumber && (feederPhoneNumber.length !== 10 || !/^\d{10}$/.test(feederPhoneNumber))) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }

    if (!dogColor) {
      Alert.alert("Error", "Please enter dog color");
      return;
    }

    try {
      setLoading(true);
      const dogImageUrl = await uploadImage(image);

      const uploadResult = await uploadCapturedDog({
        operationTaskId,
        batchId,
        dogImageUrl,
        gender: selectedGender,
        location,
        coordinates,
        fullAddress,
        feederName,
        feederPhoneNumber,
        dogColor,
      });

      if (uploadResult.capturedDog) {
        const newDog: DogData = {
          id: uploadResult.capturedDog.id,
          image: { uri: dogImageUrl },
          dogid: `DOG-${uploadResult.capturedDog.id.slice(0, 6)}`,
          gender: selectedGender,
          timestamp: new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          location,
          coordinates,
          fullAddress,
          feederName,
          feederPhoneNumber,
          dogColor,
        };

        onAddDog(newDog);
        resetModal();
      } else {
        throw new Error("Failed to save dog data");
      }
    } catch (error) {
      console.error("Error adding dog:", error);
      Alert.alert("Error", "Failed to add dog. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetModal = (): void => {
    setImage(null);
    setLocation(undefined);
    setFullAddress(undefined);
    setCoordinates(undefined);
    setGender("Male");
    setPhotoTaken(false);
    setStep(2);
    setSelectedGender("Male");
    setFeederName("");
    setFeederPhoneNumber("");
    setDogColor("");
    onClose();
  };

  const renderRetakeButton = (): JSX.Element => (
    <TouchableOpacity
      className="mb-4 items-center px-4 py-3"
      onPress={takePhoto}
      disabled={loading}
    >
      <View className="flex-row items-center justify-center rounded-xl bg-[#D1E6FF80] px-2 py-1">
        <Ionicons name="camera" size={10} color="#1B85F3" />
        <Text className="ml-2 text-xs text-blue-600">Retake Image ?</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMap = (): JSX.Element => {
    if (!coordinates) {
      return (
        <View className="relative mb-2 h-40 items-center justify-center rounded-xl bg-gray-200">
          <Ionicons name="location-sharp" size={30} color="#6B7280" />
        </View>
      );
    }

    return (
      <View className="relative mb-2 h-40 w-full overflow-hidden rounded-xl">
        <MapView
          style={{ width: "100%", height: "100%" }}
          initialRegion={{
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
          <Marker
            coordinate={{
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
            }}
            title="Capture Location"
            description={location}
          />
        </MapView>
      </View>
    );
  };

  const renderPreviewView = (): JSX.Element => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="mb-5 flex-1">
        {/* Dog Image with ID Overlay */}
        {image && (
          <View className="relative mx-2 mb-4 h-56 overflow-hidden rounded-2xl">
            <Image
              source={{ uri: image }}
              className="h-full w-full"
              resizeMode="cover"
            />
            <View className="absolute bottom-2 left-2 rounded-xl bg-black/50 px-3 py-1">
              <Text className="text-lg font-semibold text-white">
                ID: {generateDogId()}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-1 gap-4 rounded-t-3xl border border-b-0 border-[#0c1a4b24] p-2 px-4 pt-4">
          {/* Date of Capture */}
          <View className="mb-2 flex-row items-center justify-between border-b border-[#ECEFF2] pb-4">
            <View className="flex-row items-center gap-2">
              <View className="rounded-2xl bg-[#D1E6FF80] p-3">
                <Feather name="calendar" size={20} color="#2F88FF" />
              </View>
              <View>
                <Text className="text-sm font-normal text-[#808B9A]">
                  Date of Capture
                </Text>
                <Text className="text-base font-semibold text-[#39434F]">
                  {previewDate || "Date unavailable"}
                </Text>
              </View>
            </View>

            {renderRetakeButton()}
          </View>

          {/* Location */}
          <View className="mb-2 flex-row items-start gap-2">
            <View className="rounded-2xl bg-[#D1E6FF80] p-3">
              <Entypo name="location-pin" size={20} color="#2F88FF" />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-sm font-normal text-[#808B9A]">
                GPS Location: {coordinates?.latitude.toFixed(6)} ,{" "}
                {coordinates?.longitude.toFixed(6)}
              </Text>
              <Text
                className="text-base font-semibold text-[#39434F]"
                numberOfLines={2}
              >
                {fullAddress || "Unknown Location"}
              </Text>
            </View>
          </View>

          {renderMap()}

          {/* Gender Select */}
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-base font-normal text-[#808B9A]">
              Select Gender:
            </Text>

            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`flex-row items-center justify-center rounded-full border px-4 py-2 ${selectedGender === "Male" ? "border-blue-500 bg-[#2F88FF]" : "border-gray-300"}`}
                onPress={() => setSelectedGender("Male")}
              >
                <Text
                  className={`mr-1 text-sm ${selectedGender === "Male" ? "text-white" : "text-gray-800"}`}
                >
                  Male
                </Text>
                <Ionicons
                  name="male-sharp"
                  size={12}
                  color={selectedGender === "Male" ? "#fff" : "#1B85F3"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-row items-center justify-center rounded-full border px-4 py-2 ${selectedGender === "Female" ? "border-pink-500 bg-pink-500" : "border-gray-300"}`}
                onPress={() => setSelectedGender("Female")}
              >
                <Text
                  className={`mr-1 text-sm ${selectedGender === "Female" ? "text-white" : "text-gray-800"}`}
                >
                  Female
                </Text>
                <Ionicons
                  name="female-sharp"
                  size={12}
                  color={selectedGender === "Female" ? "#fff" : "#F06292"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Feeder Name */}
          <View className="mb-4">
            <Text className="mb-2 text-base font-semibold">Feeder Name *</Text>
            <TextInput
              className="rounded-xl border border-gray-300 px-4 py-2"
              placeholder="Enter feeder name"
              value={feederName}
              onChangeText={setFeederName}
            />
          </View>

          {/* Feeder Phone Number */}
          <View className="mb-4">
            <Text className="mb-2 text-base font-semibold">
              Feeder Phone Number *
            </Text>
            <TextInput
              className="rounded-xl border border-gray-300 px-4 py-2"
              placeholder="Enter feeder phone number"
              value={feederPhoneNumber}
              onChangeText={setFeederPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          {/* Dog Color */}
          <View className="mb-4">
            <Text className="mb-2 text-base font-semibold">Dog Color *</Text>
            <TextInput
              className="rounded-xl border border-gray-300 px-4 py-2"
              placeholder="Enter dog color"
              value={dogColor}
              onChangeText={setDogColor}
            />
          </View>

          <View className="mt-2 flex-row items-center justify-center pb-4">
            <TouchableOpacity
              className={`w-full items-center rounded-xl px-6 py-3 ${selectedGender ? "bg-[#1B85F3]" : "bg-[#1b83f37e]"}`}
              onPress={handleAddDog}
              disabled={!selectedGender}
            >
              <Text className="text-base font-semibold text-white">Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View className="flex-1 justify-end bg-black/30">
        <View className="h-[90%] rounded-t-3xl bg-white">
          <TouchableOpacity
            className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-2"
            onPress={resetModal}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-base text-gray-500">
                Loading Details...
              </Text>
            </View>
          ) : image ? (
            renderPreviewView()
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-base text-gray-500">Opening camera...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default DogCaptureModal;
