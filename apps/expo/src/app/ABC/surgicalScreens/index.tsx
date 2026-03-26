import { useState } from "react"; // keeping for selectedDate state
import { useTabContext } from "./_components/TabContext";
import { Text, View } from "react-native";

import BottomTabNavigation from "./_components/BottomNavigation";
import ReleaseList from "./_components/ReleaseList";
import SurgeryList from "./_components/SurgeryList";
import CalendarHeader from "./_components/SurgicalCalender";

export default function SurgicalScreen() {
  // const { data: user } = api.user.getCurrentUser.useQuery();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { activeTab, setActiveTab } = useTabContext();

  return (
    <View className="flex-1">
      <View className="w-full flex-1 bg-[#FFF]">
        <View>
          <CalendarHeader
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        </View>
        <View className="flex-1 px-4">
          <View className="mb-4">
            <Text className="px-2 text-lg font-medium">
              {activeTab === "surgery" ? "Today Surgeries" : "Today Release"}
            </Text>
          </View>
          {activeTab === "surgery" ? <SurgeryList /> : <ReleaseList />}
        </View>
        <BottomTabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </View>
    </View>
  );
}
