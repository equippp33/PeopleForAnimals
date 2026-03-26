import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { EvilIcons, Feather } from "@expo/vector-icons";
import { format } from "date-fns";

import { api } from "~/utils/api";

export default function MyShiftScreen() {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 375;

  const {
    data: tasksData,
    isLoading,
    error,
  } = api.task.getTasksByType.useQuery({
    taskType: "release",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1B85F3" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-center text-red-500">{error.message}</Text>
      </View>
    );
  }

  // Exclude release tasks that are already completed
  const tasks = tasksData?.success
    ? tasksData.tasks.filter((task) => task.status !== "completed")
    : [];

  return (
    <View className="flex-1 bg-white px-2 pt-8 sm:px-4 sm:pt-12">
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between sm:mb-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center gap-1 sm:gap-2"
        >
          <Feather
            name="chevron-left"
            size={isSmallScreen ? 20 : 24}
            color="black"
          />
          <Text className="text-lg font-bold sm:text-xl">My Shift</Text>
        </TouchableOpacity>

        <Text className="text-base font-normal text-gray-400 sm:text-lg">
          10AM–7PM
        </Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="mb-3 rounded-xl bg-[#EAF6FF] p-3 shadow-sm sm:mb-4 sm:rounded-2xl sm:p-4">
            <View className="mb-1 mt-2 flex-row items-start justify-between gap-4 sm:mt-3 sm:gap-10">
              <View className="justify-center">
                <Text className="mb-1 text-base font-semibold sm:mb-2 sm:text-lg">
                  Capture at {item.location?.name}
                </Text>
                <Text className="mb-1 text-[10px] font-semibold text-gray-500 sm:text-xs">
                  Request #{item.id.slice(0, 8)}
                </Text>
                <Text className="text-xl font-bold sm:text-2xl">
                  {">"} {item.location?.notes || "N/A"} Dogs
                </Text>
              </View>

              <View className="flex-col items-end gap-0.5 sm:gap-1">
                <Text className="text-xs font-semibold text-black sm:text-sm">
                  {item.team?.name || "Unassigned"}
                </Text>
                <Text className="text-xs text-gray-600 sm:text-sm">
                  {format(new Date(item.createdAt), "MMM do, yyyy")}
                </Text>
                <Text className="text-xs text-gray-600 sm:text-sm">
                  ({format(new Date(item.createdAt), "hh:mm a")})
                </Text>
              </View>
            </View>

            <Text className="mb-2 text-xs text-gray-500 sm:text-sm">
              Status: {item.status}
            </Text>

            <View className="flex-col gap-2">
              <View className="flex-row items-center gap-1">
                <EvilIcons
                  name="location"
                  size={isSmallScreen ? 18 : 20}
                  color="black"
                />
                <Text className="text-xs font-medium text-black sm:text-sm">
                  {item.location?.area}
                </Text>
              </View>
              <TouchableOpacity
                className="rounded-full bg-[#1B85F3] px-5 py-2 sm:px-7 sm:py-3"
                onPress={() =>
                  router.navigate({
                    pathname: "/ABC/operationalScreens/releasemap",
                    params: {
                      id: item.id,
                      location: item.location?.name,
                      team: item.team?.name,
                      coordinates: JSON.stringify(item.location?.coordinates),
                      area: item.location?.area,
                      notes: item.location?.notes,
                      status: item.status,
                    },
                  })
                }
              >
                <Text className="text-center text-xs text-white sm:text-sm">
                  Start task
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View className="mt-20 flex-1 items-center justify-center sm:mt-32">
            <Text className="text-base font-semibold text-gray-500 sm:text-lg">
              No capture tasks
            </Text>
          </View>
        )}
      />
    </View>
  );
}
