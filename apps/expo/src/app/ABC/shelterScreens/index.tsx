import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  RefreshControl,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { format } from "date-fns";

import { api } from "~/utils/api";
import CalendarHeader from "./_components/CaldenderHeader";

// Enable LayoutAnimation for Android (keeping for compatibility)
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface BatchCardProps {
  item: {
    id: string;
    batchNumber: string;
    status: string;
    shelter_task_status: string;
    startTime: string | null;
    endTime: string | null;
    totalDogs: number;
    operationTask: {
      circle?: {
        name: string;
        location: {
          name: string;
        };
      };
    };
    team?: {
      id: string;
      name: string;
    };
  };
  isSelected: boolean;
  onPress: () => void;
  onOnboard: () => void;
}

const BatchCard: React.FC<BatchCardProps> = ({
  item,
  isSelected,
  onPress,
  onOnboard,
}) => {
  // Reanimated 3 shared values
  const buttonOpacity = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const buttonTranslateY = useSharedValue(20);

  // Update animations when isSelected changes
  React.useEffect(() => {
    if (isSelected) {
      buttonOpacity.value = withSpring(1, { damping: 15, stiffness: 150 });
      cardScale.value = withSpring(1.02, { damping: 15, stiffness: 150 });
      buttonTranslateY.value = withSpring(0, { damping: 15, stiffness: 150 });
    } else {
      buttonOpacity.value = withSpring(0, { damping: 15, stiffness: 150 });
      cardScale.value = withSpring(1, { damping: 15, stiffness: 150 });
      buttonTranslateY.value = withSpring(20, { damping: 15, stiffness: 150 });
    }
  }, [isSelected]);

  // Animated styles
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
    shadowOpacity: isSelected ? 0.25 : 0.15,
    shadowRadius: isSelected ? 8 : 4,
    elevation: isSelected ? 8 : 4,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
      <Animated.View style={cardAnimatedStyle}>
        <LinearGradient
          colors={["#F8FAFD", "#00A5FF"]}
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
          <View className="mb-8 self-start">
            <Text className="rounded-full bg-blue-100 px-6 py-3 text-xl font-medium text-[#1B85F3]">
              <FontAwesome6 name="location-dot" size={18} color="#1B85F3" />
              {"  "}
              {item.operationTask?.circle?.name ??
                item.operationTask?.circle?.location?.name ??
                "Unknown Location"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-b border-[#1B85F3]/20 py-2">
            <Text className="text-base font-light text-[#1B85F3]">
              Batch Number
            </Text>
            <Text className="text-base font-medium text-[#1B85F3]">
              {item.batchNumber}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-b border-[#1B85F3]/20 py-2">
            <Text className="text-base font-light text-[#1B85F3]">Team</Text>
            <Text className="text-base font-medium text-[#1B85F3]">
              {item.team?.name ?? "Unassigned"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-b border-[#1B85F3]/20 py-2">
            <Text className="text-base font-light text-[#1B85F3]">Date</Text>
            <Text className="text-base font-medium text-[#1B85F3]">
              {item.endTime
                ? format(new Date(item.endTime), "MMM do, yyyy")
                : "Not started"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-b border-[#1B85F3]/20 py-2">
            <Text className="text-base font-light text-[#1B85F3]">Time</Text>
            <Text className="text-base font-medium text-[#1B85F3]">
              {item.endTime
                ? format(new Date(item.endTime), "hh:mm a")
                : "Not started"}
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-base font-light text-[#1B85F3]">
              Total Dogs
            </Text>
            <Text className="text-base font-medium text-[#1B85F3]">
              {item.totalDogs ?? 0}
            </Text>
          </View>

          {/* Animated Onboard Button */}
          <Animated.View style={buttonAnimatedStyle}>
            {isSelected && (
              <View className="mt-4 flex items-end">
                <TouchableOpacity
                  className="flex-row items-center rounded-full bg-[#1B85F3] px-8 py-3"
                  onPress={onOnboard}
                >
                  <Text className="text-base font-medium text-white">
                    Onboard
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

const Index = () => {
  // const {
  //   data: user,
  //   isLoading: userLoading,
  //   error,
  // } = api.user.getCurrentUser.useQuery();
  const { data: batches, isLoading: batchesLoading,refetch } =
    api.shelter.getAllBatches.useQuery();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false); // State for refreshing

  // The API returns only completed batches with pending shelter status
  const availableBatches = batches ?? [];

  if (batchesLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#1B85F3" />
        <Text className="mt-2 text-gray-500">Loading...</Text>
      </View>
    );
  }


  const handleBatchPress = (batchId: string) => {
    setSelectedBatchId(selectedBatchId === batchId ? null : batchId);
  };

  const handleOnboard = (item: (typeof availableBatches)[0]) => {
    router.push({
      pathname: "/ABC/shelterScreens/sencondpage" as const,
      params: {
        batchId: item.id,
        batchNumber: item.batchNumber,
        location:
          item.operationTask?.circle?.name ??
          item.operationTask?.circle?.location?.name ??
          "Unknown Location",
        totalDogs: item.totalDogs.toString(),
        teamName: item.team?.name ?? "Unassigned",
        status: item.status,
      },
    });
  };
  
  const onRefresh = async () => {
    setRefreshing(true); // Show the spinner
    await refetch(); // Trigger API refetch
    setRefreshing(false); // Hide the spinner
  };

  return (
    <View className="flex-1 bg-white">
      <CalendarHeader
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

      {/* Batch List */}
      <View className="flex-1 px-6 pb-6 pt-6">
        <FlatList
          data={availableBatches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#1B85F3"]} // Match your app's theme
              progressBackgroundColor="#ffffff" // Optional: Customize background
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center rounded-2xl bg-[#F0F4F8] px-4 py-6">
              <Text className="text-md font-semibold text-gray-500">
                No batches available for processing
              </Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <BatchCard
              item={item as any}
              isSelected={selectedBatchId === item.id}
              onPress={() => handleBatchPress(item.id)}
              onOnboard={() => handleOnboard(item)}
            />
          )}
        />
      </View>
    </View>
  );
};

export default Index;