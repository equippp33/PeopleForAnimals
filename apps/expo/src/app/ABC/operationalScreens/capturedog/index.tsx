import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
  Alert,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Feather,
  FontAwesome6,
  Foundation,
  Ionicons,
} from "@expo/vector-icons";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import type { DogData } from "../../_components/DogCaptureModal";
import { api } from "~/utils/api";
import { useTranslation } from "~/utils/LanguageContext";
import DogCaptureModal from "../../_components/DogCaptureModal";
import { useNetworkStatus } from "~/hooks/useNetworkStatus";
import { NetworkStatusIndicator, NetworkStatusBar } from "~/components/NetworkStatusIndicator";
import { OfflineQueue } from "~/utils/offlineQueue";
import type { QueuedDogData } from "~/utils/offlineQueue";
import { SyncService } from "~/services/syncService";
import { getBaseUrl } from "~/utils/base-url";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDER_WIDTH = SCREEN_WIDTH - 40;
const MAX_SLIDE = SLIDER_WIDTH - 60;
const SLIDE_THRESHOLD = MAX_SLIDE;

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

const TaskScreen = () => {
  const insets = useSafeAreaInsets();
  const { language, t } = useTranslation();
  const pickLang = (en: string, hi?: string, te?: string) =>
    language === "hi" ? (hi ?? en) : language === "te" ? (te ?? en) : en;

  // Helper function to transliterate team names
  const transliterateTeamName = (teamName: string) => {
    if (!teamName) return teamName;

    if (language === "hi") {
      return teamName
        .replace(/Blue Cross Team (\d+)/gi, "ब्लू क्रॉस टीम $1")
        .replace(/Blue Cross/gi, "ब्लू क्रॉस")
        .replace(/Team (\d+)/gi, "टीम $1")
        .replace(/Team/gi, "टीम")
        .replace(/Operational Team/gi, "परिचालन टीम")
        .replace(/Surgical Team/gi, "शल्य चिकित्सा टीम")
        .replace(/Operational/gi, "परिचालन")
        .replace(/Surgical/gi, "शल्य चिकित्सा")
        .replace(/Medical/gi, "चिकित्सा")
        .replace(/Rescue/gi, "बचाव")
        .replace(/Emergency/gi, "आपातकाल")
        .replace(/Mobile/gi, "मोबाइल")
        .replace(/Field/gi, "क्षेत्र")
        .replace(/Alpha/gi, "अल्फा")
        .replace(/Beta/gi, "बीटा")
        .replace(/Gamma/gi, "गामा")
        .replace(/Delta/gi, "डेल्टा");
    } else if (language === "te") {
      return teamName
        .replace(/Blue Cross Team (\d+)/gi, "బ్లూ క్రాస్ టీమ్ $1")
        .replace(/Blue Cross/gi, "బ్లూ క్రాస్")
        .replace(/Team (\d+)/gi, "టీమ్ $1")
        .replace(/Team/gi, "టీమ్")
        .replace(/Operational Team/gi, "కార్యాచరణ టీమ్")
        .replace(/Surgical Team/gi, "శస్త్రచికిత్స టీమ్")
        .replace(/Operational/gi, "కార్యాచరణ")
        .replace(/Surgical/gi, "శస్త్రచికిత్స")
        .replace(/Medical/gi, "వైద్య")
        .replace(/Rescue/gi, "రక్షణ")
        .replace(/Emergency/gi, "అత్యవసర")
        .replace(/Mobile/gi, "మొబైల్")
        .replace(/Field/gi, "క్షేత్ర")
        .replace(/Alpha/gi, "ఆల్ఫా")
        .replace(/Beta/gi, "బీటా")
        .replace(/Gamma/gi, "గామా")
        .replace(/Delta/gi, "డెల్టా");
    }
    return teamName;
  };

  const {
    id,
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
    batchId,
  } = useLocalSearchParams();

  // Fetch task details to retrieve team name and localized notes
  const { data: taskDetails } = api.task.getById.useQuery(requestId as string, {
    enabled: !!requestId,
  });

  // Fetch captured dogs for this batch
  const { data: capturedDogsFromDB, isLoading: isLoadingDogs, refetch: refetchCapturedDogs } =
    api.task.getCapturedDogsByBatch.useQuery(
      { batchId: batchId as string },
      { enabled: !!batchId },
    );

  // Debug logging for captured dogs
  useEffect(() => {
    console.log('🔍 CaptureScreen Debug Info:');
    console.log('  - batchId:', batchId);
    console.log('  - capturedDogsFromDB:', capturedDogsFromDB?.length || 0, 'dogs');
    console.log('  - isLoadingDogs:', isLoadingDogs);
    if (capturedDogsFromDB) {
      console.log('  - Dogs data:', capturedDogsFromDB.map(dog => ({
        id: dog.id.slice(0, 8),
        dogTagId: dog.dog_tag_id,
        status: dog.status,
        releaseStatus: dog.releaseStatus
      })));
    }
  }, [batchId, capturedDogsFromDB, isLoadingDogs]);

  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineDogsData, setOfflineDogsData] = useState<QueuedDogData[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Network status
  const { isOnline, setServerStatus } = useNetworkStatus();

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered');
    setIsRefreshing(true);
    try {
      // Refetch captured dogs from database
      await refetchCapturedDogs();

      // Reload offline queue data
      const queue = await OfflineQueue.getQueue();
      const taskQueue = queue.filter(item => item.operationTaskId === (id as string));
      setOfflineDogsData(taskQueue);
      setQueueCount(queue.length);

      setLastRefreshTime(new Date());
      console.log('✅ Manual refresh completed successfully');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      setError('Failed to refresh dog list');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchCapturedDogs, id]);

  // Auto refresh function (silent refresh without loading indicator)
  const handleAutoRefresh = useCallback(async () => {
    console.log('🔄 Auto refresh triggered');
    try {
      // Silently refetch captured dogs from database
      await refetchCapturedDogs();

      // Reload offline queue data
      const queue = await OfflineQueue.getQueue();
      const taskQueue = queue.filter(item => item.operationTaskId === (id as string));
      setOfflineDogsData(taskQueue);
      setQueueCount(queue.length);

      setLastRefreshTime(new Date());
      console.log('✅ Auto refresh completed successfully');
    } catch (error) {
      console.error('❌ Auto refresh failed:', error);
      // Don't show error for auto refresh to avoid annoying users
    }
  }, [refetchCapturedDogs, id]);

  // Transform database data to match our UI format
  const syncedDogsData = capturedDogsFromDB?.map((dog) => ({
    id: dog.id,
    image: { uri: dog.dogImageUrl },
    dogid: dog.dog_tag_id ?? `DOG-${dog.id.slice(0, 6)}`,
    gender: dog.gender,
    timestamp: dog.createdAt?.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) ?? new Date().toLocaleDateString(),
    location: dog.location,
    coordinates: dog.coordinates
      ? {
        latitude: (dog.coordinates as { latitude: number; longitude: number }).latitude,
        longitude: (dog.coordinates as { latitude: number; longitude: number }).longitude,
      }
      : undefined,
    fullAddress: dog.fullAddress,
    feederName: dog.feederName,
    feederPhoneNumber: dog.feederPhoneNumber,
    dogColor: dog.dogColor,
    isOffline: false,
  })) ?? [];

  // Transform offline queue data to match our UI format
  const offlineDogsFormatted = offlineDogsData.map((dog, index) => {
    // Generate simple sequential offline dog tag ID
    const dogTagId = `OFF${String(index + 1).padStart(3, '0')}`;

    return {
      id: dog.id,
      image: { uri: dog.dogImageUri },
      dogid: dogTagId,
      gender: dog.gender,
      timestamp: new Date(dog.timestamp).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      location: dog.location,
      coordinates: dog.coordinates,
      fullAddress: dog.fullAddress,
      feederName: dog.feederName,
      feederPhoneNumber: dog.feederPhoneNumber,
      dogColor: dog.dogColor,
      isOffline: true,
      retryCount: dog.retryCount,
    };
  });

  // Combine synced and offline dogs
  const dogsData = [...syncedDogsData, ...offlineDogsFormatted];

  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height),
  ).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const [taskStarted, setTaskStarted] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // API mutations for sync service
  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();
  const { mutateAsync: uploadCapturedDog } = api.task.uploadCapturedDog.useMutation();
  const { mutateAsync: deleteCapturedDog } = api.task.deleteCapturedDog.useMutation();

  // Load offline queue data
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const queue = await OfflineQueue.getQueue();
        // Filter queue items for this specific operation task
        const taskQueue = queue.filter(item => item.operationTaskId === (id as string));
        setOfflineDogsData(taskQueue);
        setQueueCount(queue.length);
      } catch (error) {
        console.error('Error loading offline queue:', error);
      }
    };

    loadOfflineData();

    // Set up sync service callbacks
    SyncService.setCallbacks({
      getUploadURL,
      uploadCapturedDog,
    });

    // Refresh offline data every 5 seconds
    const interval = setInterval(loadOfflineData, 5000);

    return () => clearInterval(interval);
  }, [id, getUploadURL, uploadCapturedDog]);

  // Auto-refresh interval - refresh every 10 seconds when online
  useEffect(() => {
    if (!isOnline) return;

    const autoRefreshInterval = setInterval(() => {
      void handleAutoRefresh();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [isOnline, handleAutoRefresh]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Screen focused - triggering refresh');
      void handleAutoRefresh();
    }, [handleAutoRefresh])
  );

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0) {
      console.log('🔄 Auto-sync triggered from capture screen: isOnline =', isOnline, 'queueCount =', queueCount);
      void SyncService.syncOfflineData().then(() => {
        console.log('✅ Auto-sync completed successfully from capture screen');
        // Refresh offline data after sync
        void OfflineQueue.getQueue().then(queue => {
          console.log('🔍 Full queue after sync:', queue.length, 'items');
          console.log('🔍 Queue items:', queue.map(item => ({ id: item.id, operationTaskId: item.operationTaskId })));

          const taskQueue = queue.filter(item => item.operationTaskId === (id as string));
          console.log('🔍 Filtered queue for task', id, ':', taskQueue.length, 'items');

          setOfflineDogsData(taskQueue);
          setQueueCount(queue.length);
          console.log('📊 Updated queue count from capture screen:', queue.length);
          console.log('📊 Updated offline dogs for this task:', taskQueue.length);

          // Refresh captured dogs list after sync to show newly synced dogs
          console.log('🔄 Refreshing captured dogs list after sync...');
          void refetchCapturedDogs();
        });
      }).catch((error) => {
        console.error('❌ Auto-sync failed from capture screen:', error);
      });
    }
  }, [isOnline, queueCount, id, refetchCapturedDogs]);

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

  // Check if user is within 500m radius
  useEffect(() => {
    const checkLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location);

        // Get distance from params
        const distanceInMeters = paramsDistanceInMeters
          ? parseInt(paramsDistanceInMeters as string, 10)
          : Infinity;
        setIsWithinRadius(distanceInMeters <= 500);
      } catch (err) {
        setError("Error getting location");
        console.error(err);
      }
    };

    checkLocation();
    // Set up location updates
    const locationSubscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (location) => {
        setUserLocation(location);
      },
    );

    return () => {
      locationSubscription.then((sub) => sub.remove());
    };
  }, [paramsDistanceInMeters]);

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

  const handleAddDog = (newDog: DogData): void => {
    // The list will automatically update through the query invalidation
    setModalVisible(false);
  };

  const handleDeleteDog = async (dogId: string, isOffline: boolean, dogTagId: string) => {
    Alert.alert(
      "Delete Dog",
      `Are you sure you want to delete ${dogTagId}? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (isOffline) {
                // Delete from offline queue
                await OfflineQueue.deleteFromQueue(dogId);
                // Refresh offline data after deletion
                const queue = await OfflineQueue.getQueue();
                const taskQueue = queue.filter(queueItem => queueItem.operationTaskId === (id as string));
                setOfflineDogsData(taskQueue);
                setQueueCount(queue.length);
                console.log(`🗑️ Deleted offline dog: ${dogId}`);
              } else {
                // Delete from database
                await deleteCapturedDog({ dogId });
                console.log(`🗑️ Deleted synced dog: ${dogId}`);
                // Refresh captured dogs list
                void refetchCapturedDogs();
              }
            } catch (error) {
              console.error('Error deleting dog:', error);
              Alert.alert(
                "Error",
                "Failed to delete the dog. Please try again.",
                [{ text: "OK" }]
              );
            }
          },
        },
      ]
    );
  };

  const handleDownloadDogImage = useCallback(async (imageUri: string | undefined, dogTagId: string) => {
    if (!imageUri) {
      Alert.alert("No Image", `No photo found for ${dogTagId}.`, [{ text: "OK" }]);
      return;
    }

    try {
      const permissions = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
      if (permissions.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Gallery permission is required to save images.",
          [{ text: "OK" }],
        );
        return;
      }

      let localUri = imageUri;
      if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
        const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (baseDir) {
          const extensionMatch = /\.(jpg|jpeg|png|webp|heic)(\?|$)/i.exec(imageUri);
          const extension = extensionMatch?.[1]?.toLowerCase() ?? "jpg";
          const safeDogTagId = dogTagId.replace(/[^a-z0-9_-]/gi, "_");
          const fileUri = `${baseDir}${safeDogTagId}_${Date.now()}.${extension}`;
          const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);
          localUri = downloadResult.uri;
        } else {
          // Fallback: use image manipulator to download the remote image
          const result = await manipulateAsync(imageUri, [], { format: SaveFormat.JPEG });
          localUri = result.uri;
        }
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Saved", `Photo for ${dogTagId} saved to gallery.`, [{ text: "OK" }]);
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save image to gallery. Please try again.", [{ text: "OK" }]);
    }
  }, []);


  const DogCard: React.FC<{ item: (typeof dogsData)[number] }> = ({ item }) => {
    const isFemale = item.gender === "Female";
    const isOffline = 'isOffline' in item && item.isOffline;

    return (
      <TouchableOpacity
        className={`mb-4 w-[48%] overflow-hidden rounded-2xl border shadow-sm ${isOffline ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'
          }`}
        onPress={() => {
          if (!isOffline) {
            router.push({
              pathname: "/ABC/operationalScreens/dogprofile",
              params: {
                id: item.id,
                gender: item.gender,
                timestamp: item.timestamp,
                location: item.location,
                fullAddress: item.fullAddress,
                latitude: item.coordinates?.latitude,
                longitude: item.coordinates?.longitude,
                image:
                  typeof item.image === "object" ? item.image.uri : item.image,
                feederName: item.feederName,
                feederPhoneNumber: item.feederPhoneNumber,
                dogColor: item.dogColor,
              },
            });
          }
        }}
        disabled={isOffline}
      >
        <View className="relative">
          <Image source={item.image} className="h-48 w-full" resizeMode="cover" />
          {isOffline ? (
            <>
              <View className="absolute top-2 right-2 rounded-full bg-orange-500 px-2 py-1">
                <Text className="text-xs font-medium text-white">Pending</Text>
              </View>
              <TouchableOpacity
                className="absolute top-2 left-2 rounded-full bg-red-500 p-1"
                onPress={() => handleDeleteDog(item.id, true, item.dogid)}
              >
                <Ionicons name="trash" size={12} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                className="absolute bottom-2 right-2 rounded-full bg-green-600 p-2"
                onPress={() => handleDownloadDogImage((item.image as { uri?: string })?.uri, item.dogid)}
              >
                <Ionicons name="download" size={18} color="white" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                className="absolute bottom-2 right-2 rounded-full bg-green-600 p-2"
                onPress={() => handleDownloadDogImage((item.image as { uri?: string })?.uri, item.dogid)}
              >
                <Ionicons name="download" size={18} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                className="absolute top-2 right-2 rounded-full bg-red-500 p-1"
                onPress={() => handleDeleteDog(item.id, false, item.dogid)}
              >
                <Ionicons name="trash" size={12} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
        <View className="p-4">
          <View className="flex-row items-center justify-between">
            <Text
              style={{
                color: isOffline ? "#F97316" : "black",
                fontWeight: "600",
                fontSize: 16,
                paddingBottom: 4,
                fontFamily: "DMSans-Bold",
              }}
            >
              {item.dogid}
            </Text>
            {isOffline && 'retryCount' in item && item.retryCount > 0 && (
              <Text className="text-xs text-orange-600">
                Retry #{item.retryCount}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <Text
              className={`font-regular rounded-full px-3 py-1 text-xs text-white ${isFemale ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"
                }`}
            >
              <Foundation
                name={isFemale ? "female-symbol" : "male-symbol"}
                size={10}
                color="white"
              />{" "}
              {item.gender}
            </Text>
            <Text className="font-regular mt-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
              <FontAwesome5 name="palette" size={10} color="black" />{" "}
              {item.dogColor ?? t("Unknown Color")}
            </Text>
          </View>
          {isOffline && (
            <View className="mt-2 flex-row items-center">
              <Ionicons name="cloud-upload-outline" size={12} color="#F97316" />
              <Text className="ml-1 text-xs text-orange-600">Waiting to sync</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="relative flex-1 bg-white px-2">
      <NetworkStatusIndicator />
      <NetworkStatusBar />
      {/* Header - positioned below network status */}
      <View className="absolute left-0 right-0 z-10 bg-white px-4 pb-1 pt-2 shadow-sm" style={{ top: isOnline ? 0 : 44 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-2"
        >
          <Feather name="chevron-left" size={28} color="black" />
          <Text className="text-xl font-semibold text-gray-800">{t("Back")}</Text>
        </TouchableOpacity>
      </View>

      <View className="mx-4 mb-2" style={{ marginTop: isOnline ? 60 : 104 }}>
        {/* Task Card */}
        <View>
          <LinearGradient
            colors={["#D1E6FF", "#D1E6FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 5 }}
            style={{
              borderRadius: 16,
              borderTopRightRadius: 16,
              borderTopLeftRadius: 16,
              borderBottomRightRadius: 16,
              borderBottomLeftRadius: 16,
            }}
            className="rounded-2xl p-8"
          >
            <View className="mb-6 self-start">
              <Text className="rounded-full bg-[#1B85F3] px-6 py-3 text-xl font-medium text-white">
                <FontAwesome6 name="location-dot" size={18} color="white" />
                {"  "}
                {taskDetails?.location ?
                  pickLang(
                    taskDetails.location.name ?? location ?? t("Unknown Location"),
                    taskDetails.location.hi_name,
                    taskDetails.location.te_name
                  ) : (location ?? t("Unknown Location"))}
              </Text>
            </View>

            {/* <View className="mb-3 flex-row justify-between border-b border-[#1B85F3]/20 py-1">
              <Text className="text-base text-[#1B85F3]">Request ID</Text>
              <Text className="text-base text-[#1B85F3]">
                #{id?.slice(0, 8)}
              </Text>
            </View> */}

            <View className="mb-3 flex-row justify-between border-b border-[#1B85F3]/20 py-1">
              <Text className="font-regular text-base text-[#1B85F3]">
                {t("Team")}
              </Text>
              <Text className="text-base font-medium text-[#1B85F3]">
                {transliterateTeamName(team ?? taskDetails?.team?.name ?? t("Unassigned"))}
              </Text>
            </View>

            <View className="mb-3 flex-row justify-between border-b border-[#1B85F3]/20 py-1">
              <Text className="font-regular text-base text-[#1B85F3]">
                {t("Date")}
              </Text>
              <Text className="text-base font-medium text-[#1B85F3]">
                {date}
              </Text>
            </View>

            <View className="mb-3 flex-row justify-between border-b border-[#1B85F3]/20 py-1">
              <Text className="font-regular text-base text-[#1B85F3]">
                {t("Time")}
              </Text>
              <Text className="text-base font-medium text-[#1B85F3]">
                {time}
              </Text>
            </View>

            <View className="mb-3 flex-row justify-between border-b border-[#1B85F3]/20 py-1">
              <Text className="font-regular text-base text-[#1B85F3]">
                {t("Admin Comments")}
              </Text>
              <Text
                className="text-base font-medium text-[#1B85F3] flex-1 text-right ml-4"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {taskDetails?.location ?
                  pickLang(
                    taskDetails.location.notes ?? dogs ?? "",
                    taskDetails.location.hi_notes,
                    taskDetails.location.te_notes
                  ) : dogs}
              </Text>
            </View>

            <View className="mb-3 flex-row justify-between border-b border-[#1B85F3]/20 py-1">
              <Text className="font-regular text-base text-[#1B85F3]">
                {t("Distance")}
              </Text>
              <Text className="text-base font-medium text-[#1B85F3]">
                {distance} ({distanceTime})
              </Text>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View className="-mx-2 h-3/4 flex-1 justify-end">
        <Animated.View
          style={[
            { transform: [{ translateY: slideAnim }] },
            Platform.OS === "ios"
              ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
              }
              : {
                elevation: 14,
              },
          ]}
          className="h-full rounded-t-[32px] bg-white px-8 pt-10"
        >
          <View className="relative bottom-6 items-center">
            <View className="h-1.5 w-16 rounded-full bg-gray-300" />
          </View>

          {isLoadingDogs ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#1B85F3" />
              <Text className="mt-3 text-base text-gray-500">
                {t("Loading captured dogs...")}
              </Text>
            </View>
          ) : (
            <>
              <View className="mb-4 flex-row justify-between">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name="center-focus-strong"
                    size={24}
                    color="#1B85F3"
                  />
                  <Text className="text-lg font-medium text-[#1B85F3]">
                    {t("Captured Dogs")}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="font-regular text-sm text-gray-500">
                    {dogsData.length} total
                  </Text>
                  {offlineDogsFormatted.length > 0 && (
                    <Text className="text-xs text-orange-600">
                      {offlineDogsFormatted.length} pending sync
                    </Text>
                  )}
                </View>
              </View>

              {/* Offline Queue Status */}
              {queueCount > 0 && (
                <View className="mb-4 rounded-lg bg-orange-50 p-3">
                  <View className="flex-row items-center justify-center mb-2">
                    <Ionicons name="cloud-upload-outline" size={20} color="#F97316" />
                    <Text className="ml-2 text-sm font-medium text-orange-600">
                      {queueCount} dog{queueCount > 1 ? 's' : ''} waiting to sync across all tasks
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="flex-row items-center justify-center rounded-lg bg-green-500 py-2 px-4"
                    onPress={async () => {
                      console.log('🔄 Manual sync triggered...');
                      try {
                        if (isOnline) {
                          void SyncService.syncOfflineData();
                        } else {
                          console.log('⚠️ Cannot sync - device is offline');
                        }
                      } catch (error) {
                        console.error('Error triggering manual sync:', error);
                      }
                    }}
                  >
                    <Ionicons name="sync" size={16} color="white" />
                    <Text className="ml-2 text-sm font-medium text-white">
                      Sync Now
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <FlatList
                data={dogsData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <DogCard item={item} />}
                numColumns={2}
                columnWrapperStyle={{
                  justifyContent: "space-between",
                  paddingHorizontal: 1,
                  paddingTop: 8,
                }}
                ListEmptyComponent={
                  <View className="relative items-center justify-center rounded-2xl">
                    <Image
                      source={require("../../../../../assets/images/nodogs.webp")}
                      className="absolute top-3 h-60 w-60 -translate-x-1 -translate-y-1"
                    />
                    <Text className="text-lg font-semibold text-gray-500">
                      {t("No dogs captured yet")}
                    </Text>
                  </View>
                }
                contentContainerStyle={{
                  paddingBottom: 140,
                }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    colors={['#2F88FF']}
                    tintColor="#2F88FF"
                    title="Pull to refresh dog list"
                    titleColor="#666"
                  />
                }
              />
            </>
          )}

          {/* Bottom Buttons Container */}
          <View className="absolute bottom-0 left-0 right-0 z-50 bg-white pt-2 shadow-lg" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
            <View className="flex-row items-center gap-4 px-10">
              <TouchableOpacity
                disabled={dogsData.length === 0}
                className={`w-1/2 flex-row items-center justify-center rounded-2xl py-4 ${dogsData.length === 0 ? "bg-gray-200 opacity-50" : "bg-gray-200"}`}
                onPress={() => {
                  if (dogsData.length === 0) return;
                  router.push({
                    pathname: "/ABC/operationalScreens/endCapture",
                    params: {
                      batchId: batchId as string,
                      totalDogs: dogsData.length.toString(),
                      circleName: location as string,
                    },
                  });
                }}
              >
                <Text className="ml-2 text-base font-medium text-gray-700">
                  {t("End Capture")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-1/2 flex-row items-center justify-center rounded-2xl bg-[#1B85F3] py-4"
                onPress={() => {
                  router.push({
                    pathname: "/ABC/operationalScreens/adddog",
                    params: {
                      operationTaskId: id as string,
                      batchId: batchId as string,
                    },
                  });
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color="white" />
                <Text className="ml-2 text-base font-medium text-white">
                  {isOnline ? 'Add Dog' : 'Add Dog (Offline)'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View className="mb-4 rounded-xl bg-red-50 p-4">
              <Text className="text-center text-sm text-red-600">{error}</Text>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Dog Capture Modal */}
      <DogCaptureModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAddDog={handleAddDog}
        operationTaskId={id as string}
        batchId={batchId as string}
      />
    </View>
  );
};

export default TaskScreen;
