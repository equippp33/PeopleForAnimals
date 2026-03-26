import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AntDesign, Entypo, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";

import { api } from "~/utils/api";
import ReviewCard from "../_components/ReviewCard";

interface Dog {
  id: string;
  dogId: string;
  gender: string;
  date: string;
  image: string;
  surgeryStatus: "yes" | "no" | null;
  surgeryReason?: string | null;
  surgery_remarks?: string | null;
  status: string;
  batchId?: string | null;
  dogImageUrl: string;
}

export default function ProfileScreen() {
  const { batchId, totalDogs, date, type } = useLocalSearchParams<{
    batchId?: string;
    totalDogs?: string;
    date?: string;
    type?: "surgery" | "release";
  }>();
  const router = useRouter();
  const utils = api.useContext();
  const [refreshing, setRefreshing] = useState(false); // State for refreshing

  // Fetch dogs data with refetch interval
  const { data: dogsData, isLoading, refetch } = api.surgery.getBatchDogs.useQuery(
    { batchId: batchId! },
    {
      enabled: !!batchId,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0, // Always fetch fresh data
    },
  );

  // Force a refetch when the component mounts
  React.useEffect(() => {
    if (batchId) {
      void utils.surgery.getBatchDogs.invalidate({ batchId });
    }
  }, [batchId]);

  // Surgery status mutation
  const updateSurgeryStatus = api.surgery.updateDogSurgeryStatus.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Surgery status updated successfully");
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [reviewVisible, setReViewVisible] = useState(false);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [showBackButton, setShowBackButton] = useState(false);

  // Check if we should show back button based on dogs data
  React.useEffect(() => {
    if (dogsData?.length) {
      const hasStatus = dogsData.some((dog) => {
        const status = getValues(dog.id);
        return status === "yes" || status === "no";
      });
      if (hasStatus) {
        setShowBackButton(true);
      }
    }
  }, [dogsData]);

  // Add state for blinking cards
  const [blinkingCards, setBlinkingCards] = useState<Set<string>>(new Set());
  const [blinkOpacity] = useState(new Animated.Value(1));

  type FormValues = Record<string, string | boolean>;

  const { control, handleSubmit, getValues, setValue } = useForm<FormValues>({
    defaultValues:
      dogsData?.reduce(
        (acc, dog) => ({
          ...acc,
          [dog.id]: dog.surgeryStatus || "Select Status",
          [`${dog.id}_dropdownVisible`]: false,
        }),
        {},
      ) ?? {},
  });

  const filteredDogs = React.useMemo(() => {
    if (!dogsData) return [];

    const currentDate = new Date().toISOString().split("T")[0];

    return dogsData
      .map((dog) => ({
        id: dog.id,
        dogId: dog.dog_tag_id || dog.id.slice(0, 8),
        gender: dog.gender,
        date: currentDate ?? "", // Ensure date is always a string
        image: dog.dogImageUrl,
        surgeryStatus: dog.surgeryStatus,
        surgeryReason: dog.surgeryReason,
        surgery_remarks: dog.surgery_remarks,
        dogImageUrl: dog.dogImageUrl,
        batchId: dog.batchId,
        status: dog.status || "captured",
      }))
      .filter((dog) =>
        (dog.dogId || "").toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [dogsData, searchQuery]);

  // Function to handle blinking animation
  const startBlinking = (dogId: string) => {
    setBlinkingCards((prev) => new Set(prev).add(dogId));
    let count = 0;

    const blink = () => {
      Animated.sequence([
        Animated.timing(blinkOpacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(blinkOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        count++;
        if (count < 5) {
          setTimeout(blink, 0);
        } else {
          setBlinkingCards((prev) => {
            const newSet = new Set(prev);
            newSet.delete(dogId);
            return newSet;
          });
        }
      });
    };

    blink();
  };

  const handleStatusSelect = (
    dogId: string,
    status: string,
    onVisibilityChange: (value: boolean) => void,
  ) => {
    setValue(dogId, status);
    if (status === "no") {
      setSelectedDogId(dogId);
      setReViewVisible(true);
    } else if (status === "yes") {
      const selectedDog = dogsData?.find((dog) => dog.id === dogId);
      if (selectedDog) {
        updateSurgeryStatus.mutate(
          {
            dogId,
            surgeryStatus: "yes",
          },
          {
            onSuccess: () => {
              // Navigate to dog profile after status is updated
              router.push({
                pathname: "/ABC/surgicalScreens/dogprofile",
                params: {
                  dogId: selectedDog.id,
                  gender: selectedDog.gender,
                  batchId: batchId,
                  showBackOnReturn: "true", // Flag to show back button when returning
                },
              });
            },
          },
        );
        startBlinking(dogId);
      }
    }
    setValue(`${dogId}_dropdownVisible`, false);
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true); // Show the spinner
    await refetch(); // Trigger API refetch
    setRefreshing(false); // Hide the spinner
  };

  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  const handleRejectionConfirm = (data: { remark: string }) => {
    if (selectedDogId) {
      updateSurgeryStatus.mutate({
        dogId: selectedDogId,
        surgeryStatus: "no",
        surgeryReason: data.remark,
      });
    }
    setReViewVisible(false);
    setSelectedDogId(null);
    setShowBackButton(true); // Show back button after confirming dialog
  };

  const handleCardPress = (item: Dog) => {
    const status = getValues(item.id);
    if (status === "yes") {
      router.push({
        pathname: "/(home)/surgicalScreens/dogprofile",
        params: {
          dogId: item.id,
          gender: item.gender,
          batchId: batchId,
        },
      });
    }
  };

  const renderDogCard = ({ item }: { item: Dog }) => {
    const textColor =
      item.gender.toLowerCase() === "female" ? "#FF2F9E" : "#1B85F3";
    const status = getValues(item.id);
    const isBlinking = blinkingCards.has(item.id);
    const borderColor =
      item.gender.toLowerCase() === "female" ? "#FF2F9E" : "#1B85F3";
    // Show tick if either surgery remarks or rejection reason exists
    const hasRemarks = !!item.surgery_remarks || !!item.surgeryReason;

    return (
      <Animated.View
        style={{
          width: "48%",
          margin: 4,
          borderRadius: 12,
          padding: isBlinking ? 2 : 0,
          backgroundColor: isBlinking ? borderColor : "transparent",
          opacity: isBlinking ? blinkOpacity : 1,
        }}
      >
        <TouchableOpacity
          onPress={() => handleCardPress(item)}
          disabled={status !== "yes"}
          className="rounded-xl bg-white p-3"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 4,
            borderWidth: 1,
            borderColor: isBlinking ? "transparent" : "#e5e7eb",
          }}
        >
          <Image
            source={{ uri: item.image }}
            style={{ width: "100%", height: 120 }}
            className="mb-2 rounded-lg"
          />
          <View className="flex-row items-center justify-between">
            <Text
              className="mb-1 mt-2 text-lg font-semibold"
              style={{ color: textColor }}
            >
              {item.dogId}
            </Text>
            {hasRemarks && (
              <View className="rounded-full bg-green-500 p-1">
                <AntDesign name="check" size={12} color="white" />
              </View>
            )}
          </View>
          <View className="mb-2 ml-1 flex-row items-center">
            <Text className="text-sm font-light text-black">{item.gender}</Text>
            <Entypo name="dot-single" size={9} color="black" />
            <Text className="text-sm font-light text-black">{item.date}</Text>
          </View>
          <View className="relative z-50">
            <Controller
              control={control}
              name={item.id}
              render={({ field: { onChange, value } }) => (
                <Controller
                  control={control}
                  name={`${item.id}_dropdownVisible`}
                  render={({
                    field: { onChange: onVisibilityChange, value: isVisible },
                  }) => {
                    const selectedStatus = statuses.find(
                      (s) => s.value === value,
                    );
                    return (
                      <View>
                        <Pressable
                          onPress={() => onVisibilityChange(!isVisible)}
                          className="flex-row items-center justify-between rounded-xl bg-gray-200 px-4 py-3"
                        >
                          <View className="flex-row items-center gap-1.5">
                            <Text className="font-regular mr-1 text-sm text-black">
                              {selectedStatus?.label ?? "Select Status"}
                            </Text>
                          </View>
                          {isVisible ? (
                            <Entypo
                              name="chevron-up"
                              size={18}
                              color="#9D9D9D"
                            />
                          ) : (
                            <Entypo
                              name="chevron-down"
                              size={18}
                              color="#9D9D9D"
                            />
                          )}
                        </Pressable>
                        {isVisible && (
                          <View className="absolute bottom-12 z-50 rounded-xl border border-gray-300 bg-white shadow-md">
                            {statuses.map((status) => (
                              <TouchableOpacity
                                key={status.value}
                                className="flex-row items-center px-4 py-2"
                                onPress={() =>
                                  handleStatusSelect(
                                    item.id,
                                    status.value,
                                    onVisibilityChange,
                                  )
                                }
                              >
                                <View
                                  className={`relative mr-2 h-3.5 w-3.5 items-center justify-center rounded-full border ${value === status.value ? "border-blue-600 bg-blue-600" : "border-gray-400 bg-white"}`}
                                >
                                  {value === status.value && (
                                    <Entypo
                                      name="check"
                                      size={7}
                                      color="white"
                                    />
                                  )}
                                </View>
                                <Text className="font-regular text-sm text-black">
                                  {status.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              )}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#8B67E5" />
        <Text className="mt-2 text-gray-600">Loading dogs...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4">
      <Text className="text-md px-2 font-semibold">
        {type === "surgery" ? "Pending Surgeries" : "Pending Releases"}{" "}
        {/* {batchId} */}
      </Text>
      <View className="mb-4 flex-row items-center">
        <View className="ml-1 mr-2 mt-3 flex-1 flex-row items-center rounded-xl border border-gray-300 bg-transparent px-3 py-1">
          <TextInput
            className="mx-2 flex-1 text-sm font-medium text-black"
            placeholder="Search Dog ID"
            placeholderTextColor="#A0AEC0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Ionicons name="search-outline" size={20} color="#666" />
        </View>
        <TouchableOpacity className="mt-2">
          <Ionicons name="filter" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredDogs}
        renderItem={renderDogCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingBottom: 50 }}
        style={{ height: Dimensions.get("window").height * 0.95 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#8B67E5"]} // Match your app's theme
            progressBackgroundColor="#ffffff" // Optional: Customize background
          />
        }
      />
      {!isLoading && filteredDogs.length === 0 && (
        <View className="mb-56 flex-1 items-center">
          <Text className="text-lg text-black">
            Oops! No dogs found{" "}
            <FontAwesome5 name="dog" size={24} color="black" />
          </Text>
        </View>
      )}
      <ReviewCard
        visible={reviewVisible}
        onCancel={() => setReViewVisible(false)}
        onConfirm={handleRejectionConfirm}
        heading="Reason for Rejection"
      />
      {/* Back Button */}
      {showBackButton && (
        <View className="absolute bottom-6 left-0 right-0 px-6">
          <TouchableOpacity
            onPress={handleBackPress}
            className="w-full items-center justify-center rounded-full bg-blue-600 py-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <Text className="text-white font-semibold text-base">Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const statuses = [
  { label: "Surgery Needed", value: "yes" },
  { label: "Surgery Not-Needed", value: "no" },
];