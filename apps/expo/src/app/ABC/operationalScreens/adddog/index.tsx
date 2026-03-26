import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { api } from "~/utils/api";
import { useNetworkStatus } from "~/hooks/useNetworkStatus";
import { NetworkStatusIndicator, NetworkStatusBar } from "~/components/NetworkStatusIndicator";
import { OfflineQueue } from "~/utils/offlineQueue";
import { SyncService } from "~/services/syncService";
import { ImageCompressionService } from "~/utils/imageCompression";
import { getBaseUrl } from "~/utils/base-url";
import { useTranslation } from "~/utils/LanguageContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 40;
const MAX_SLIDE = SLIDER_WIDTH - 60;
const SLIDE_THRESHOLD = MAX_SLIDE * 0.8;
interface Coordinates {
  latitude: number;
  longitude: number;
}

export default function AddDogScreen() {
  const { language, t } = useTranslation();
  const pickLang = (en: string, hi?: string, te?: string) =>
    language === "hi" ? (hi ?? en) : language === "te" ? (te ?? en) : en;

  const params = useLocalSearchParams();
  const { operationTaskId, batchId } = params;

  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<string | undefined>();
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>();
  const [fullAddress, setFullAddress] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [previewDate, setPreviewDate] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>("Male");
  const [feederName, setFeederName] = useState<string>("");
  const [feederPhoneNumber, setFeederPhoneNumber] = useState<string>("");
  const [dogColor, setDogColor] = useState<string>("");
  const [taskStarted, setTaskStarted] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const dragX = useRef(new Animated.Value(0)).current;
  const isSliderLocked = useRef(false);

  // Network status
  const { isOnline, setServerStatus } = useNetworkStatus();

  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();
  const { mutateAsync: uploadCapturedDog } =
    api.task.uploadCapturedDog.useMutation();
  const { data: operationTaskDetails } = api.task.getById.useQuery(
    operationTaskId as string,
  );

  // Load queue count on component mount and set sync callbacks
  useEffect(() => {
    const loadQueueCount = async () => {
      const count = await OfflineQueue.getQueueCount();
      setQueueCount(count);
    };
    loadQueueCount();

    // Set sync service callbacks
    SyncService.setCallbacks({
      getUploadURL,
      uploadCapturedDog,
    });
  }, [getUploadURL, uploadCapturedDog]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0) {
      console.log('🔄 Auto-sync triggered: isOnline =', isOnline, 'queueCount =', queueCount);
      void SyncService.syncOfflineData().then(() => {
        console.log('✅ Auto-sync completed successfully');
        // Refresh queue count after sync
        void OfflineQueue.getQueueCount().then(count => {
          console.log('📊 Updated queue count:', count);
          setQueueCount(count);
        });
      }).catch((error) => {
        console.error('❌ Auto-sync failed:', error);
      });
    }
  }, [isOnline, queueCount]);

  // Force server status check when component mounts
  useEffect(() => {
    // Try to detect server status immediately by making a test API call
    const testServerConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(getBaseUrl(), {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status < 500) {
          setServerStatus(true);
        } else {
          setServerStatus(false);
        }
      } catch (_error) {
        setServerStatus(false);
      }
    };

    void testServerConnection();
  }, [setServerStatus]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          getErrorMessage("Permission denied"),
          getErrorMessage("Location permission is required"),
        );
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
      Alert.alert(
        getErrorMessage("Error"),
        getErrorMessage("Failed to get location"),
      );
    }
  };

  // Effect to get location when component mounts
  useEffect(() => {
    void getLocation();
  }, []);

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Helper function to transliterate dates
  const transliterateDate = (dateString: string) => {
    if (!dateString || language === "en") return dateString;

    let transliterated = dateString;

    if (language === "hi") {
      // Transliterate month names
      transliterated = transliterated
        .replace(/January/gi, "जनवरी")
        .replace(/February/gi, "फरवरी")
        .replace(/March/gi, "मार्च")
        .replace(/April/gi, "अप्रैल")
        .replace(/May/gi, "मई")
        .replace(/June/gi, "जून")
        .replace(/July/gi, "जुलाई")
        .replace(/August/gi, "अगस्त")
        .replace(/September/gi, "सितंबर")
        .replace(/October/gi, "अक्टूबर")
        .replace(/November/gi, "नवंबर")
        .replace(/December/gi, "दिसंबर");
    } else if (language === "te") {
      // Transliterate month names
      transliterated = transliterated
        .replace(/January/gi, "జనవరి")
        .replace(/February/gi, "ఫిబ్రవరి")
        .replace(/March/gi, "మార్చి")
        .replace(/April/gi, "ఏప్రిల్")
        .replace(/May/gi, "మే")
        .replace(/June/gi, "జూన్")
        .replace(/July/gi, "జూలై")
        .replace(/August/gi, "ఆగస్టు")
        .replace(/September/gi, "సెప్టెంబర్")
        .replace(/October/gi, "అక్టోబర్")
        .replace(/November/gi, "నవంబర్")
        .replace(/December/gi, "డిసెంబర్");
    }

    return transliterated;
  };

  // Helper function to transliterate address components
  const transliterateAddress = (address: string) => {
    if (!address || language === "en") return address;

    let transliterated = address;

    if (language === "hi") {
      // Common address terms
      transliterated = transliterated
        .replace(/Road/gi, "रोड")
        .replace(/Street/gi, "स्ट्रीट")
        .replace(/Lane/gi, "लेन")
        .replace(/Colony/gi, "कॉलोनी")
        .replace(/Nagar/gi, "नगर")
        .replace(/Hyderabad/gi, "हैदराबाद")
        .replace(/Telangana/gi, "तेलंगाना")
        .replace(/India/gi, "भारत")
        .replace(/Area/gi, "क्षेत्र")
        .replace(/Circle/gi, "सर्कल")
        .replace(/Main/gi, "मुख्य")
        .replace(/Cross/gi, "क्रॉस");
    } else if (language === "te") {
      // Common address terms
      transliterated = transliterated
        .replace(/Road/gi, "రోడ్")
        .replace(/Street/gi, "స్ట్రీట్")
        .replace(/Lane/gi, "లేన్")
        .replace(/Colony/gi, "కాలనీ")
        .replace(/Nagar/gi, "నగర్")
        .replace(/Hyderabad/gi, "హైదరాబాద్")
        .replace(/Telangana/gi, "తెలంగాణ")
        .replace(/India/gi, "భారత్")
        .replace(/Area/gi, "ప్రాంతం")
        .replace(/Circle/gi, "సర్కిల్")
        .replace(/Main/gi, "మెయిన్")
        .replace(/Cross/gi, "క్రాస్");
    }

    return transliterated;
  };

  // Helper function to get button text based on language
  const getButtonText = (isLoading: boolean) => {
    if (language === "hi") {
      return isLoading ? "डॉग ऐड हो रहा है..." : "डॉग ऐड करो";
    } else if (language === "te") {
      return isLoading ? "డాగ్ యాడ్ అవుతోంది..." : "డాగ్ యాడ్ చేయండి";
    } else {
      return isLoading ? t("Adding Dog...") : t("Add Dog");
    }
  };

  // Helper function to get error messages based on language
  const getErrorMessage = (key: string) => {
    if (language === "hi") {
      const messages: Record<string, string> = {
        "Permission denied": "अनुमति नकारी गई",
        "Location permission is required": "लोकेशन परमिशन आवश्यक है",
        "Camera permission is required": "कैमरा परमिशन आवश्यक है",
        Error: "एरर",
        "Failed to get location": "लोकेशन प्राप्त नहीं हो सकी",
        "Failed to take photo": "फोटो लेने में असफल",
        "Please capture or select a dog image":
          "कृपया डॉग की इमेज कैप्चर या सेलेक्ट करें",
        "Please enter a valid 10-digit phone number":
          "कृपया वैलिड 10 डिजिट फोन नंबर एंटर करें",
        "Please enter dog color": "कृपया डॉग का कलर एंटर करें",
        "Failed to add dog. Please try again.":
          "डॉग ऐड नहीं हो सका। कृपया फिर से ट्राई करें।",
      };
      return messages[key] || key;
    } else if (language === "te") {
      const messages: Record<string, string> = {
        "Permission denied": "అనుమతి తిరస్కరించబడింది",
        "Location permission is required": "లొకేషన్ పర్మిషన్ అవసరం",
        "Camera permission is required": "కెమెరా పర్మిషన్ అవసరం",
        Error: "ఎర్రర్",
        "Failed to get location": "లొకేషన్ పొందడంలో విఫలమైంది",
        "Failed to take photo": "ఫోటో తీయడంలో విఫలమైంది",
        "Please capture or select a dog image":
          "దయచేసి డాగ్ ఇమేజ్ క్యాప్చర్ లేదా సెలెక్ట్ చేయండి",
        "Please enter a valid 10-digit phone number":
          "దయచేసి 10 డిజిట్ ఫోన్ నంబర్ ఎంటర్ చేయండి",
        "Please enter dog color": "దయచేసి డాగ్ కలర్ ఎంటర్ చేయండి",
        "Failed to add dog. Please try again.":
          "డాగ్ యాడ్ చేయడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.",
      };
      return messages[key] || key;
    } else {
      return t(key);
    }
  };

  const takePhoto = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          getErrorMessage("Permission denied"),
          getErrorMessage("Camera permission is required"),
        );
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImage(asset.uri);
        setPreviewDate(getTimestamp());

        if (asset.exif?.GPSLatitude && asset.exif.GPSLongitude) {
          const latitude = asset.exif.GPSLatitude;
          const longitude = asset.exif.GPSLongitude;

          setCoordinates({ latitude, longitude });
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
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert(
        getErrorMessage("Error"),
        getErrorMessage("Failed to take photo"),
      );
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Gallery permission is required");
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImage(asset.uri);
        setPreviewDate(getTimestamp());

        // For gallery images, we still try to get GPS data from EXIF if available
        if (asset.exif?.GPSLatitude && asset.exif.GPSLongitude) {
          const latitude = asset.exif.GPSLatitude;
          const longitude = asset.exif.GPSLongitude;

          setCoordinates({ latitude, longitude });
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
        }
      }
    } catch (error) {
      console.error("Error picking from gallery:", error);
      Alert.alert("Error", "Failed to pick image from gallery");
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      console.log("🚀 Starting image upload with compression...");

      // Compress image for better upload performance
      const compressionOptions = ImageCompressionService.getDefaultCompressionOptions();
      const compressedUri = await ImageCompressionService.compressImage(uri, compressionOptions);

      const extension = compressedUri.split(".").pop()?.toLowerCase() ?? "";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      console.log("📤 Uploading compressed image...");

      // Add timeout for faster server detection
      const uploadUrlPromise = getUploadURL({
        folderName: "captured-dogs",
        contentType,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Network request failed - timeout")), 5000); // 5 second timeout
      });

      const uploadUrlResponse = await Promise.race([uploadUrlPromise, timeoutPromise]);

      if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
        throw new Error("Failed to get upload URL");
      }

      const response = await fetch(compressedUri);
      const blob = await response.blob();

      console.log(`📊 Compressed image size: ${blob.size} bytes (quality: ${compressionOptions.quality}, maxWidth: ${compressionOptions.maxWidth})`);

      // Add timeout for image upload too
      const uploadPromise = fetch(uploadUrlResponse.data.uploadParams, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": contentType,
        },
      });

      const uploadTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Network request failed - upload timeout")), 10000); // 10 second timeout
      });

      await Promise.race([uploadPromise, uploadTimeoutPromise]);

      console.log("✅ Image uploaded successfully with compression");
      return uploadUrlResponse.data.fileUrl;
    } catch (error) {
      console.error("❌ Error uploading image:", error);
      throw error;
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!image) {
      Alert.alert(
        getErrorMessage("Error"),
        getErrorMessage("Please capture or select a dog image"),
      );
      return;
    }

    // Feeder details are optional. Validate phone number only if provided.
    if (
      feederPhoneNumber &&
      (feederPhoneNumber.length !== 10 || !/^\d{10}$/.test(feederPhoneNumber))
    ) {
      Alert.alert(
        getErrorMessage("Error"),
        getErrorMessage("Please enter a valid 10-digit phone number"),
      );
      return;
    }

    if (!dogColor) {
      Alert.alert(
        getErrorMessage("Error"),
        getErrorMessage("Please enter dog color"),
      );
      return;
    }

    try {
      setLoading(true);

      if (isOnline) {
        // Online mode - try to upload directly, but fallback to offline if server is unreachable
        try {
          const dogImageUrl = await uploadImage(image);

          const uploadResult = await uploadCapturedDog({
            operationTaskId: operationTaskId as string,
            batchId: batchId as string,
            dogImageUrl,
            gender: selectedGender,
            location,
            coordinates,
            fullAddress,
            feederName,
            feederPhoneNumber,
            dogColor,
          });

          if (uploadResult.success) {
            // Mark server as reachable on successful upload
            setServerStatus(true);

            Alert.alert("Success", "Dog added successfully!", [
              { text: "OK", onPress: () => router.back() }
            ]);
            return; // Exit early on success
          } else {
            throw new Error("Failed to save dog data");
          }
        } catch (networkError) {
          console.log("Network error detected, falling back to offline mode:", networkError);

          // Check if it's a network-related error (server down, timeout, etc.)
          const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
          const isNetworkError = errorMessage.includes('Network request failed') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ENOTFOUND');

          if (isNetworkError) {
            // Mark server as unreachable
            setServerStatus(false);

            // Treat as offline - save to queue
            const queueId = await OfflineQueue.addToQueue({
              operationTaskId: operationTaskId as string,
              batchId: batchId as string,
              dogImageUri: image, // Store local URI
              gender: selectedGender,
              location,
              coordinates,
              fullAddress,
              feederName,
              feederPhoneNumber,
              dogColor,
            });

            // Update queue count
            const newCount = await OfflineQueue.getQueueCount();
            setQueueCount(newCount);

            Alert.alert(
              "Server Unavailable",
              "Server is currently unreachable. Dog data saved locally and will be uploaded when server is back online.",
              [{ text: "OK", onPress: () => router.back() }]
            );
            return; // Exit early after saving offline
          } else {
            // Re-throw non-network errors
            throw networkError;
          }
        }
      } else {
        // Offline mode - save to queue
        const queueId = await OfflineQueue.addToQueue({
          operationTaskId: operationTaskId as string,
          batchId: batchId as string,
          dogImageUri: image, // Store local URI
          gender: selectedGender,
          location,
          coordinates,
          fullAddress,
          feederName,
          feederPhoneNumber,
          dogColor,
        });

        // Update queue count
        const newCount = await OfflineQueue.getQueueCount();
        setQueueCount(newCount);

        // Silently navigate back after saving offline
        router.back();
      }
    } catch (error) {
      console.error("Error adding dog:", error);

      // Last resort - always try to save offline if something goes wrong
      try {
        const queueId = await OfflineQueue.addToQueue({
          operationTaskId: operationTaskId as string,
          batchId: batchId as string,
          dogImageUri: image,
          gender: selectedGender,
          location,
          coordinates,
          fullAddress,
          feederName,
          feederPhoneNumber,
          dogColor,
        });

        const newCount = await OfflineQueue.getQueueCount();
        setQueueCount(newCount);

        // Silently navigate back after saving offline (fallback)
        router.back();
      } catch (offlineError) {
        console.error("Failed to save offline:", offlineError);
        Alert.alert("Error", "Failed to save dog data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const backgroundColorAnim = dragX.interpolate({
    inputRange: [0, SLIDE_THRESHOLD],
    outputRange: ["#F3F4F6", "#2F88FF"],
    extrapolate: "clamp",
  });

  const textColorAnim = dragX.interpolate({
    inputRange: [0, SLIDE_THRESHOLD],
    outputRange: ["#374151", "#FFFFFF"],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return !taskStarted && !isSliderLocked.current;
      },
      onStartShouldSetPanResponderCapture: () => {
        return !taskStarted && !isSliderLocked.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        const dx = gestureState.dx;
        if (
          !taskStarted &&
          !isSliderLocked.current &&
          dx >= 0 &&
          dx <= MAX_SLIDE
        ) {
          dragX.setValue(dx);
          if (dx >= SLIDE_THRESHOLD && !taskStarted) {
            setTaskStarted(true);
            isSliderLocked.current = true;
            Animated.timing(dragX, {
              toValue: MAX_SLIDE,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              handleSubmit();
            });
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx >= SLIDE_THRESHOLD) {
          Animated.timing(dragX, {
            toValue: MAX_SLIDE,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            handleSubmit();
          });
        } else if (!isSliderLocked.current) {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const renderMap = (): React.JSX.Element => {
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
            title={t("Capture Location")}
            description={location}
          />
        </MapView>
      </View>
    );
  };

  useEffect(() => {
    void getLocation();
  }, []);

  const generateDogId = (): string => {
    // Get circle name from operation task details
    const circleName =
      operationTaskDetails?.location?.circles?.[0]?.name ||
      operationTaskDetails?.location?.name ||
      "UNKN";

    // Get first four letters of circle name (or all if less than 4)
    const circlePrefix = circleName.slice(0, 4).toUpperCase();

    // For now return a placeholder - the actual number will be generated on the server
    return `${circlePrefix}0001`;
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <NetworkStatusIndicator />
      <NetworkStatusBar />

      {/* Header - positioned below network status */}
      <View className="absolute left-0 right-0 z-10 bg-white px-4 pb-1 pt-2 shadow-sm" style={{ top: isOnline ? 0 : 44 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-2"
        >
          <Feather name="chevron-left" size={28} color="black" />
          <Text className="text-xl font-semibold text-gray-800">Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} style={{ marginTop: isOnline ? 60 : 104 }}>
        {/* Dog Image Container with Overlapping Back Button */}
        <View className="relative">
          <View
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_WIDTH,
              position: "relative",
            }}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-gray-200">
                <MaterialIcons name="add-a-photo" size={48} color="#9CA3AF" />
                <Text className="mt-2 text-base text-gray-500">
                  Add dog photo
                </Text>
              </View>
            )}

            {/* Back Button Overlay */}
            <TouchableOpacity
              onPress={() => router.back()}
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

            {/* Camera and Gallery Buttons - Bottom Overlay */}
            <View
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                right: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                zIndex: 10,
              }}
            >
              {/* Camera Button - Bottom Left */}
              <TouchableOpacity
                onPress={takePhoto}
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  borderRadius: 28,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                disabled={loading}
              >
                <MaterialIcons name="camera-alt" size={28} color="#FFF" />
              </TouchableOpacity>

              {/* Gallery Button - Bottom Right */}
              <TouchableOpacity
                onPress={pickFromGallery}
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  borderRadius: 28,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                disabled={loading}
              >
                <MaterialIcons name="photo-library" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* White Card Container */}
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
          {/* Form Fields */}
          <View className="mb-6 px-2">
            {/* Gender Selection */}
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="w-1/3 text-base font-medium text-gray-700">
                {t("Gender")}
              </Text>
              <View className="flex-1 flex-row justify-end gap-4">
                <TouchableOpacity
                  className={`items-center justify-center rounded-2xl px-6 py-3 ${selectedGender === "Male" ? "bg-[#1B85F3]" : "bg-blue-50"}`}
                  onPress={() => setSelectedGender("Male")}
                  style={{ width: 60 }}
                >
                  <Text
                    className={`text-base font-medium ${selectedGender === "Male" ? "text-white" : "text-gray-600"}`}
                  >
                    M
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`items-center justify-center rounded-2xl px-6 py-3 ${selectedGender === "Female" ? "bg-[#FF2F9E]" : "bg-blue-50"}`}
                  onPress={() => setSelectedGender("Female")}
                  style={{ width: 60 }}
                >
                  <Text
                    className={`text-base font-medium ${selectedGender === "Female" ? "text-white" : "text-gray-600"}`}
                  >
                    F
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Feeder Name */}
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="w-1/2 text-base font-medium text-gray-700">
                {t("Feeder Name")}
              </Text>
              <TextInput
                value={feederName}
                onChangeText={setFeederName}
                placeholder="Enter feeder name"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-2xl bg-blue-50 px-6 py-4 text-left text-base"
              />
            </View>

            {/* Phone Number */}
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="w-1/2 text-base font-medium text-gray-700">
                {t("Phone Number")}
              </Text>
              <TextInput
                value={feederPhoneNumber}
                onChangeText={(text) => {
                  // Allow only digits
                  const numericText = text.replace(/[^0-9]/g, "");
                  setFeederPhoneNumber(numericText);
                }}
                placeholder="Enter phone number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                maxLength={10}
                className="flex-1 rounded-2xl bg-blue-50 px-6 py-4 text-left text-base"
              />
            </View>

            {/* Dog Color */}
            <View className="mb-8 flex-row items-center justify-between">
              <Text className="w-1/2 text-base font-medium text-gray-700">
                {t("Dog Color")}
              </Text>
              <TextInput
                value={dogColor}
                onChangeText={setDogColor}
                placeholder="Enter dog color"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-2xl bg-blue-50 px-6 py-4 text-left text-base"
              />
            </View>
          </View>

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
              <Text className="text-base text-gray-500">
                {t("Date of Capture")}
              </Text>
              <Text className="text-base font-medium text-gray-800">
                {previewDate
                  ? transliterateDate(previewDate)
                  : t("Date unavailable")}
              </Text>
            </View>
          </View>

          {/* Location Section */}
          <View className="mb-6 flex-row items-center">
            <MaterialIcons
              name="location-on"
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
              <Text className="text-sm text-gray-500">{t("GPS Location")}</Text>
              <Text className="text-base font-medium text-gray-800">
                {fullAddress
                  ? transliterateAddress(fullAddress)
                  : t("Unknown Location")}
              </Text>
            </View>
          </View>

          {/* Map */}
          <View className="mb-8">{renderMap()}</View>

          {/* Offline Queue Status */}
          {queueCount > 0 && (
            <View className="mb-4 flex-row items-center justify-center rounded-lg bg-orange-50 p-3">
              <Ionicons name="cloud-upload-outline" size={20} color="#F97316" />
              <Text className="ml-2 text-sm font-medium text-orange-600">
                {queueCount} dog{queueCount > 1 ? 's' : ''} waiting to sync
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <View className="mt-2 px-8 pb-4">
            <TouchableOpacity
              className={`w-full items-center rounded-xl px-6 py-4 ${loading ? "bg-gray-400" : isOnline ? "bg-[#1B85F3]" : "bg-orange-500"}`}
              onPress={handleSubmit}
              disabled={loading}
            >
              <View className="flex-row items-center">
                {!isOnline && (
                  <Ionicons name="cloud-offline-outline" size={20} color="white" style={{ marginRight: 8 }} />
                )}
                <Text className="text-base font-semibold text-white">
                  {loading
                    ? "Processing..."
                    : isOnline
                      ? "Add Dog"
                      : "Save Offline"
                  }
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
