// import React, { useEffect, useState } from "react";
// import { Text, TouchableOpacity, View, ScrollView } from "react-native";
// import { LinearGradient } from "expo-linear-gradient";
// import * as Location from "expo-location";
// import Ionicons from "@expo/vector-icons/Ionicons";
// import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
// import { format } from "date-fns";

// import { api } from "~/utils/api";
// import { calculateDistance, calculateDuration } from "~/utils/distance";

// const HistoryPage: React.FC = () => {
//   const [selectedTab, setSelectedTab] = useState<string>("capture");
//   const [currentLocation, setCurrentLocation] = useState<{
//     lat: number;
//     lng: number;
//   } | null>(null);

//   const { data: currentUser } = api.user.getCurrentUser.useQuery();
//   const { data: teams } = api.team.getAllTeams.useQuery();

//   // Get user's team
//   const userTeam = React.useMemo(() => {
//     if (!currentUser || !teams) return null;
//     return teams.find((team) =>
//       team.members.some((member) => member.id === currentUser.id),
//     );
//   }, [currentUser, teams]);

//   // Fetch completed batches for user's team (for capture tab)
//   const { data: completedBatches } = api.task.getCompletedBatches.useQuery(
//     { teamId: userTeam?.id ?? "" },
//     { enabled: !!userTeam?.id },
//   );

//   // Fetch completed release tasks for the user's team
//   const { data: releaseTasksData } = api.task.getCompletedReleaseTasks.useQuery(
//     { teamId: userTeam?.id ?? '' },
//     { enabled: !!userTeam?.id }
//   );

//   // Transform release tasks data
//   const releaseBatches = React.useMemo(() => {
//     if (!releaseTasksData?.tasks) return [];

//     return releaseTasksData.tasks.map(task => ({
//       id: task.id,
//       batchNumber: task.batchNumber,
//       totalDogs: task.releasedDogs || 1,
//       operationTask: {
//         circle: {
//           name: task.circle?.name || task.location?.name || 'Unknown Location',
//           location: {
//             notes: task.location?.notes || 'No release notes available'
//           },
//         },
//       },
//       coordinates: task.circle?.coordinates || task.location?.coordinates,
//       endTime: task.updatedAt,
//     }));
//   }, [releaseTasksData]);

//   // Get current location for distance calculations
//   useEffect(() => {
//     (async () => {
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       if (status === "granted") {
//         const location = await Location.getCurrentPositionAsync({});
//         setCurrentLocation({
//           lat: location.coords.latitude,
//           lng: location.coords.longitude,
//         });
//       }
//     })();
//   }, []);

//   interface Batch {
//     id: string;
//     batchNumber: string;
//     totalDogs: number;
//     operationTask: {
//       circle: {
//         name: string;
//         location: {
//           notes?: string | null;
//         };
//       };
//     };
//     coordinates: { lat: number; lng: number } | null;
//     endTime: string;
//   }

//   const renderHistoryItem = (batch: Batch) => {
//     const distance =
//       currentLocation && batch.coordinates
//         ? calculateDistance(currentLocation, batch.coordinates)
//         : null;
//     const duration = distance ? calculateDuration(distance) : null;

//     return (
//       <View key={batch.id} className="mb-4">
//         <LinearGradient
//           colors={["white", "#00A5FF"]}
//           start={{ x: 0, y: 0 }}
//           end={{ x: 0, y: 5 }}
//           className="rounded-xl"
//           style={{
//             padding: 24,
//             borderWidth: 1,
//             borderColor: "#cfeeffab",
//             borderRadius: 16,
//           }}
//         >
//           <Text className="text-lg font-semibold text-gray-800">
//             {selectedTab === "capture"
//               ? `Capture - ${batch.operationTask?.circle?.name || "Unknown Location"}`
//               : `Release - ${batch.operationTask?.circle?.name || "Unknown Location"}`}
//           </Text>

//           <Text className="text-md mt-1 font-semibold text-gray-500">
//             #{batch.batchNumber}
//           </Text>

//           <Text className="mt-4 text-3xl font-semibold text-[#1B85F3]">
//             <MaterialCommunityIcons name="dog" size={24} color="#1B85F3" />{" "}
//             {Number(batch.totalDogs)} Dogs
//           </Text>

//           <View className="mt-4 gap-0">
//             <Text className="text-sm font-medium text-gray-600">
//               {selectedTab === "capture" ? "Admin Comments" : "Release Notes"}
//             </Text>
//             <Text className="text-sm font-medium text-black">
//               {batch.operationTask?.circle?.location?.notes || "No comments"}
//             </Text>
//           </View>

//           <View className="mt-8 flex-row items-center">
//             {distance && duration && (
//               <Text className="font-medium text-gray-600">
//                 {distance.toFixed(1)}km ({duration})
//               </Text>
//             )}
//             <View className="ml-auto flex-row items-center gap-1">
//               <Ionicons
//                 name="checkmark-done-circle"
//                 size={24}
//                 color="#1B85F3"
//               />
//               <Text className="ml-auto flex-row items-center gap-2 font-medium text-[#1B85F3]">
//                 {batch.endTime
//                   ? format(new Date(batch.endTime), "MMM do, yyyy")
//                   : "N/A"}
//                 {batch.endTime
//                   ? ` (${format(new Date(batch.endTime), "hh.mm a")})`
//                   : ""}
//               </Text>
//             </View>
//           </View>
//         </LinearGradient>
//       </View>
//     );
//   };

//   // Get the appropriate batches based on selected tab
//   const displayedBatches =
//     selectedTab === "capture"
//       ? completedBatches?.batches || []
//       : releaseBatches;

//   return (
//     <View className="flex-1 bg-white">
//       {/* Header */}
//       <View className="bg-white px-4 pb-4 pt-12">
//         <Text className="text-2xl font-bold text-gray-800">History</Text>
//       </View>

//       {/* Toggle Buttons for Release and Capture */}
//       <View
//         className="mx-4 mb-4 flex-row rounded-2xl"
//         style={{
//           shadowColor: "#1B85F3",
//           shadowOffset: { width: 10, height: 4 },
//           shadowOpacity: 0.1,
//           shadowRadius: 4.65,
//           elevation: 9,
//           backgroundColor: "white",
//         }}
//       >
//         <TouchableOpacity
//           onPress={() => setSelectedTab("release")}
//           className={`flex-1 rounded-2xl py-4 ${selectedTab === "release" ? "m-1.5 bg-[#E6F6FF]" : "m-1.5 bg-white"}`}
//         >
//           <Text
//             className={`text-center font-medium uppercase ${selectedTab === "release" ? "text-[#000000CC]" : "text-[#A0AEC0]"}`}
//           >
//             Release
//           </Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           onPress={() => setSelectedTab("capture")}
//           className={`flex-1 rounded-2xl py-4 ${selectedTab === "capture" ? "m-1.5 bg-[#E6F6FF]" : "m-1.5 bg-white"}`}
//         >
//           <Text
//             className={`text-center font-medium uppercase ${selectedTab === "capture" ? "text-[#000000CC]" : "text-[#A0AEC0]"}`}
//           >
//             Capture
//           </Text>
//         </TouchableOpacity>
//       </View>

//       {/* History Content */}
//       <View className="flex-1 px-4">
//         <Text className="mb-4 text-lg font-semibold text-gray-800">
//           {selectedTab === "capture" ? "Capture History" : "Release History"}
//         </Text>

//         <ScrollView
//           className="flex-1"
//           contentContainerStyle={{ paddingBottom: 50 }}
//           showsVerticalScrollIndicator={false}
//         >
//           {displayedBatches.length > 0 ? (
//             displayedBatches.map(renderHistoryItem)
//           ) : (
//             <View className="items-center justify-center rounded-2xl bg-[#F0F4F8] px-4 py-8">
//               <MaterialCommunityIcons 
//                 name="dog" 
//                 size={48} 
//                 color="#A0AEC0" 
//               />
//               <Text className="mt-2 text-center text-gray-500">
//                 {selectedTab === "capture"
//                   ? "No completed capture tasks"
//                   : "No release tasks available"}
//               </Text>
//             </View>
//           )}
//         </ScrollView>
//       </View>
//     </View>
//   );
// };

// export default HistoryPage;

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

const HistoryPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<string>("capture");
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const { data: currentUser } = api.user.getCurrentUser.useQuery();
  const { data: teams } = api.team.getAllTeams.useQuery();
  const router = useRouter();
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
      totalDogs: task.releasedDogs || 1,
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

  // Get the appropriate batches based on selected tab
  const displayedBatches =
    selectedTab === "capture"
      ? completedBatches?.batches || []
      : releaseBatches;

  return (
    <View className="flex-1 bg-white">

      <View className="bg-white px-4 pt-12 flex-row items-center"
        style={{
          shadowColor: "#1B85F3",
          shadowOffset: { width: 10, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 4.65,
          elevation: 9,
          backgroundColor: "white",
        }}

      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 rounded-full bg-[#E6F6FF] flex-row items-center gap-2 px-4"
        >
          <Ionicons name="arrow-back" size={24} color="#1B85F3" />
          <Text className="text-[#1B85F3]">Back To Home</Text>
        </TouchableOpacity>
      </View>
      {/* Header */}
      <View className="bg-white px-4 pb-2 pt-12">
        <Text className="text-2xl font-bold text-gray-800 mb-4">History</Text>
      </View>
      {/* Toggle Buttons for Release and Capture */}
      <View
        className="mx-4 mb-4 flex-row rounded-2xl"
        style={{
          shadowColor: "#1B85F3",
          shadowOffset: { width: 10, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 4.65,
          elevation: 9,
          backgroundColor: "white",
        }}
      >
        <TouchableOpacity
          onPress={() => setSelectedTab("release")}
          className={`flex-1 rounded-2xl py-4 ${selectedTab === "release" ? "m-1.5 bg-[#E6F6FF]" : "m-1.5 bg-white"}`}
        >
          <Text
            className={`text-center font-medium uppercase ${selectedTab === "release" ? "text-[#000000CC]" : "text-[#A0AEC0]"}`}
          >
            Release
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab("capture")}
          className={`flex-1 rounded-2xl py-4 ${selectedTab === "capture" ? "m-1.5 bg-[#E6F6FF]" : "m-1.5 bg-white"}`}
        >
          <Text
            className={`text-center font-medium uppercase ${selectedTab === "capture" ? "text-[#000000CC]" : "text-[#A0AEC0]"}`}
          >
            Capture
          </Text>
        </TouchableOpacity>
      </View>

      {/* History Content */}
      <View className="flex-1 px-4">
        <Text className="mb-4 text-lg font-semibold text-gray-800">
          {selectedTab === "capture" ? "Capture History" : "Release History"}
        </Text>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
        >
          {displayedBatches.length > 0 ? (
            displayedBatches.map(renderHistoryItem)
          ) : (
            <View className="items-center justify-center rounded-2xl bg-[#F0F4F8] px-4 py-8">
              <MaterialCommunityIcons
                name="dog"
                size={48}
                color="#A0AEC0"
              />
              <Text className="mt-2 text-center text-gray-500">
                {selectedTab === "capture"
                  ? "No completed capture tasks"
                  : "No release tasks available"}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

export default HistoryPage;