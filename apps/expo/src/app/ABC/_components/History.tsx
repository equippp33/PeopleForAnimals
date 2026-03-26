// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";

import { api } from "~/utils/api";
import { calculateDistance, calculateDuration } from "~/utils/distance";

interface HistoryProps {
  selectedTab: string;
  onViewAllToggle: () => void;
  isHistoryExpanded: boolean;
}

const History: React.FC<HistoryProps> = ({
  selectedTab,
  onViewAllToggle,
  isHistoryExpanded,
}) => {
  const router = useRouter();
  const { data: currentUser } = api.user.getCurrentUser.useQuery();
  const { data: teams } = api.team.getAllTeams.useQuery();
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Get user's team
  const userTeam = React.useMemo(() => {
    if (!currentUser || !teams) return null;
    return teams.find((team) =>
      team.members.some((member) => member.id === currentUser.id),
    );
  }, [currentUser, teams]);

  // Fetch completed batches for user's team (for capture tab)
  const { data: completedBatches } = api.task.getCompletedBatches.useQuery(
    { teamId: userTeam?.id ?? "" },
    { enabled: !!userTeam?.id },
  );

  // Define types for the release task
  interface ReleaseTask {
    id: string;
    batchId: string;
    status: string;
    teamId: string | null;
    vehicleId: string | null;
    totalRelease?: number;
    circle?: {
      id: string;
      name: string;
      coordinates?: { lat: number; lng: number } | null;
    } | null;
    location?: {
      id: string;
      name: string;
      notes?: string | null;
      coordinates?: { lat: number; lng: number } | null;
    } | null;
    updatedAt?: Date | null;
    createdAt: Date;
  }

  // Fetch completed release tasks for the user's team
  const { data: releaseTasksData } = api.task.getCompletedReleaseTasks.useQuery(
    { teamId: userTeam?.id ?? '' },
    { enabled: !!userTeam?.id }
  );

  // Transform release tasks data
  const releaseBatches = React.useMemo(() => {
    if (!releaseTasksData?.tasks) return [];
    
    return releaseTasksData.tasks.map(task => ({
      id: task.id,
      batchNumber: task.batchNumber,
      totalDogs: task.releasedDogs || 1, // Use released_dogs from the batch, fallback to 1
      operationTask: {
        circle: {
          name: task.circle?.name || task.location?.name || 'Unknown Location',
          location: {
            notes: task.location?.notes || 'No release notes available'
          },
        },
      },
      coordinates: task.circle?.coordinates || task.location?.coordinates,
      endTime: task.updatedAt,
    }));
  }, [releaseTasksData]);

  // Debug logs
  useEffect(() => {
    if (completedBatches?.batches && selectedTab === "capture") {
      console.log(
        "Completed Capture Batches Data:",
        completedBatches.batches.map((batch) => ({
          id: batch.id,
          batchNumber: batch.batchNumber,
          totalDogs: batch.totalDogs,
          circleName: batch.operationTask?.circle?.name,
          notes: batch.operationTask?.circle?.location?.notes,
        })),
      );
    } else if (selectedTab === "release") {
      console.log("Fetched Release Tasks Data:", releaseBatches);
    }
  }, [completedBatches, selectedTab, releaseBatches]);

  // Get current location for distance calculations
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    })();
  }, []);

  interface Batch {
    id: string;
    batchNumber: string;
    totalDogs: number;
    operationTask: {
      circle: {
        name: string;
        location: {
          notes?: string | null;
        };
      };
    };
    coordinates: { lat: number; lng: number } | null;
    endTime: string;
  }

  const renderHistoryItem = (batch: Batch) => {
    // Debug log for individual batch
    console.log("Rendering batch:", {
      id: batch.id,
      batchNumber: batch.batchNumber,
      totalDogs: batch.totalDogs,
      circleName: batch.operationTask?.circle?.name,
    });

    const distance =
      currentLocation && batch.coordinates
        ? calculateDistance(currentLocation, batch.coordinates)
        : null;
    const duration = distance ? calculateDuration(distance) : null;

    return (
      <View key={batch.id} className="mb-4">
        <LinearGradient
          colors={["white", "#00A5FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 5 }}
          className="rounded-xl"
          style={{
            padding: 24,
            borderWidth: 1,
            borderColor: "#cfeeffab",
            borderRadius: 16,
          }}
        >
          <Text className="text-lg font-semibold text-gray-800">
            {selectedTab === "capture"
              ? `Capture - ${batch.operationTask?.circle?.name || "Unknown Location"}`
              : `Release - ${batch.operationTask?.circle?.name || "Unknown Location"}`}
          </Text>

          <Text className="text-md mt-1 font-semibold text-gray-500">
            #{batch.batchNumber}
          </Text>

          <Text className="mt-4 text-3xl font-semibold text-[#1B85F3]">
            <MaterialCommunityIcons name="dog" size={24} color="#1B85F3" />{" "}
            {Number(batch.totalDogs)} Dogs
          </Text>

          <View className="mt-4 gap-0">
            <Text className="text-sm font-medium text-gray-600">
              {selectedTab === "capture" ? "Admin Comments" : "Release Notes"}
            </Text>
            <Text className="text-sm font-medium text-black">
              {batch.operationTask?.circle?.location?.notes || "No comments"}
            </Text>
          </View>

          <View className="mt-8 flex-row items-center">
            {distance && duration && (
              <Text className="font-medium text-gray-600">
                {distance.toFixed(1)}km ({duration})
              </Text>
            )}
            <View className="ml-auto flex-row items-center gap-1">
              <Ionicons
                name="checkmark-done-circle"
                size={24}
                color="#1B85F3"
              />
              <Text className="ml-auto flex-row items-center gap-2 font-medium text-[#1B85F3]">
                {batch.endTime
                  ? format(new Date(batch.endTime), "MMM do, yyyy")
                  : "N/A"}
                {batch.endTime
                  ? ` (${format(new Date(batch.endTime), "hh.mm a")})`
                  : ""}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  // Filter batches based on selectedTab and isHistoryExpanded
  const displayedBatches =
    selectedTab === "capture"
      ? completedBatches?.batches?.slice(0, isHistoryExpanded ? undefined : 3) || []
      : releaseBatches.slice(0, isHistoryExpanded ? undefined : 3);

  return (
    <View className="flex-1 bg-[#fefefe] px-4">
      <View className="flex-row items-center justify-between py-4">
        <Text className="text-lg font-semibold text-gray-800">
          {selectedTab === "capture" ? "Capture History" : "Release History"}
        </Text>
        <TouchableOpacity onPress={onViewAllToggle}>
          <Text className="text-sm text-blue-500">
            {isHistoryExpanded ? "Show Less" : "View All"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {displayedBatches.length > 0 ? (
          displayedBatches.map(renderHistoryItem)
        ) : (
          <Text className="text-center text-gray-500">
            {selectedTab === "capture"
              ? "No completed capture tasks"
              : "No release tasks available"}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default History;