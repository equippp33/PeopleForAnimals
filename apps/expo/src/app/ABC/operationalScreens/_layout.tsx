import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Slot, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { api } from "~/utils/api";
import { deleteSecurely } from "~/utils/session-store";
import DashboardHeader from "../_components/DashBoardHeader";
import { TabProvider } from "../_components/TabContext";
import Sidebar from "../_components/SideBar";
import Toast from "react-native-toast-message";

export default function OperationalLayout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();
  const { data: user, error } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: !isLoggingOut,
    retry: 2,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (error?.data?.code === "UNAUTHORIZED" && !isLoggingOut) {
      console.log('Layout session expired, redirecting to /(auth)');
      setIsLoggingOut(true);
      utils.user.getCurrentUser.cancel();
      utils.user.getCurrentUser.setData(undefined, undefined);
      deleteSecurely("appUser");
      router.replace('/(auth)');
    }
  }, [error, isLoggingOut, router, utils]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toastConfig = {
    success: ({ text1, text2 }: { text1?: string; text2?: string }) => (
      <View style={{
        backgroundColor: '#4CAF50',
        padding: 16,
        borderRadius: 8,
        marginHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      }}
        className="font-regular"
      >
        <Text className="font-semibold" style={{ color: '#FFF', }}>{text1}</Text>
        <Text className="font-regular" style={{ color: '#FFF', fontSize: 12 }}>{text2}</Text>
      </View>
    ),
    error: ({ text1, text2 }: { text1?: string; text2?: string }) => (
      <View style={{
        backgroundColor: '#FF2F52',
        padding: 16,
        borderRadius: 8,
        marginHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
      }}>
        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{text1}</Text>
        <Text style={{ color: '#FFF', fontSize: 12 }}>{text2}</Text>
      </View>
    ),
  };

  return (
    <TabProvider>
      <View className="w-full flex-1 bg-[#FFF]">
        <DashboardHeader onMenuPress={() => setIsSidebarOpen(true)} />
        <StatusBar style="dark" />
        <View className="flex-1">
          <Slot />
        </View>
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          setIsLoggingOut={setIsLoggingOut}
        />
        <Toast config={toastConfig} />
      </View>
    </TabProvider>
  );
}