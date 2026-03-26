import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Fontisto, MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "~/utils/api";

interface SurgeryItem {
  id: string;
  batchId: string;
  totalDogs: number; // This will now hold dogsReceived value
  dateTime: string;
}

interface SurgeryListProps {
  data?: SurgeryItem[]; // Optional prop in case you want to pass data externally
}

export default function SurgeryList({ data }: SurgeryListProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false); // State for refreshing

  // Fetch batches from API using the new query
  const {
    data: apiData,
    isLoading,
    error,
    refetch,
  } = api.surgery.getSurgeryBatches.useQuery();

  // Transform API data to ensure all fields are present
  const surgeryData = apiData?.map((item) => ({
    ...item,
    dateTime: item.dateTime ?? new Date().toLocaleString(),
  }));

  console.log("Transformed surgery data:", surgeryData);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true); // Show the spinner
    await refetch(); // Trigger API refetch
    setRefreshing(false); // Hide the spinner
  };

  const SurgeryCard: React.FC<{ item: SurgeryItem }> = ({ item }) => {
    const dateTimeParts = item.dateTime.split(" ");
    const datePart = dateTimeParts.slice(0, 3).join(" ");
    const timePart = dateTimeParts.slice(3).join(" ");

    const handlePress = () => {
      router.push({
        pathname: "/ABC/surgicalScreens/profile",
        params: {
          batchId: item.id, // use primary UUID to fetch correct dogs
          totalDogs: item.totalDogs.toString(),
          date: item.dateTime,
          type: "surgery",
        },
      });
    };

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <View className="mb-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-md shadow-black">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="mr-2 rounded-full bg-[#F3F0FC] p-3">
                <MaterialCommunityIcons name="dog" size={24} color="#8B67E5" />
              </View>
              <View>
                <Text className="text-md font-semibold">Batch Number</Text>
                <Text className="text-sm font-medium uppercase text-gray-500">
                  {item.batchId}
                </Text>
              </View>
            </View>
            <View className="rounded-full bg-[#F3F0FC] p-3">
              <Fontisto name="scissors" size={18} color="#8B67E5" />
            </View>
          </View>
          <View className="mx-3 mt-4 flex-row justify-between rounded-lg bg-gray-50 p-6">
            <View className="gap-2">
              <Text className="text-sm font-medium text-[#A4ACB9]">
                Total Dogs
              </Text>
              <Text className="text-lg font-semibold">{item.totalDogs}</Text>
            </View>
            <View className="h-full w-px bg-gray-300" />
            <View className="gap-2">
              <Text className="text-sm font-medium text-[#A4ACB9]">
                {datePart}
              </Text>
              <Text className="text-lg font-semibold">{timePart}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (error) {
    return (
      <View className="mt-4 items-center justify-center">
        <Text className="text-lg font-semibold text-red-500">
          Error loading batches
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#8B67E5" />
        <Text className="mt-2 font-semibold text-gray-600">
          Loading batches...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data || surgeryData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <SurgeryCard item={item} />}
      showsVerticalScrollIndicator={false}
      className="max-h-[90%]"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#8B67E5"]} // Match your app's theme
          progressBackgroundColor="#ffffff" // Optional: Customize background
        />
      }
      ListEmptyComponent={
        <View className="mt-4 items-center justify-center">
          <Text className="text-lg font-semibold text-gray-500">
            No batches available for surgery
          </Text>
          <Text className="mt-2 text-sm text-gray-400">
            Waiting for new batches
          </Text>
        </View>
      }
    />
  );
}