import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
  Text,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "~/utils/api";

interface ReleaseItem {
  id: string;
  batchId: string;
  totalDogs: number;
  dateTime: string;
}

interface ReleaseListProps {
  data?: ReleaseItem[]; // Optional prop in case you want to pass data externally
}

export default function ReleaseList({ data }: ReleaseListProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false); // State for refreshing

  // Fetch completed surgeries from API
  const { data: completedSurgeries, isLoading, refetch } =
    api.surgery.getCompletedSurgeries.useQuery();

  // Use API data directly - filtering is now handled server-side
  const releaseData = data || completedSurgeries || [];

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true); // Show the spinner
    await refetch(); // Trigger API refetch
    setRefreshing(false); // Hide the spinner
  };

  const ReleaseCard: React.FC<{ item: ReleaseItem }> = ({ item }) => {
    const dateTimeParts = item.dateTime.split(" ");
    const datePart = dateTimeParts.slice(0, 3).join(" ");
    const timePart = dateTimeParts.slice(3).join(" ");

    const handlePress = () => {
      router.push({
        pathname: "/ABC/surgicalScreens/batchrelease",
        params: {
          batchId: item.id, // uuid for backend
          batchNumber: item.batchId, // human-readable for display
          totalDogs: item.totalDogs.toString(),
          date: item.dateTime,
          dateTime: item.dateTime,
          type: "release",
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
                <Text className="text-lg font-medium">Batch Number</Text>
                <Text className="text-sm font-semibold text-gray-500">{item.batchId}</Text>
              </View>
            </View>
            <View className="rounded-full bg-[#F3F0FC] p-3">
              <FontAwesome6 name="shield-dog" size={24} color="#8B67E5" />
            </View>
          </View>
          <View className="mx-3 mt-4 flex-row justify-between rounded-lg bg-gray-50 p-6">
            <View className="gap-2">
              <Text className="text-sm font-regular text-[#A4ACB9]">Dogs to Release</Text>
              <Text className="text-lg font-medium">{item.totalDogs}</Text>
            </View>
            <View className="h-full w-px bg-gray-300" />
            <View className="gap-2">
              <Text className="text-sm font-regular text-[#A4ACB9]">{datePart}</Text>
              <Text className="text-lg font-medium">{timePart}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#8B67E5" />
        <Text className="mt-2 text-gray-600">
          Loading completed surgeries...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={releaseData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ReleaseCard item={item} />}
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
            No completed surgeries available
          </Text>
        </View>
      }
    />
  );
}