import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Entypo } from "@expo/vector-icons";
import { usePathname } from 'expo-router';


// import '../../app/styles.css'; // Keep your styles.css import

const customIcon = require("../../../../../assets/images/menu_icon.webp");

const DashboardHeader:  React.FC<{ onMenuPress: () => void }> = ({ onMenuPress }) => {
  const insets = useSafeAreaInsets();
    const pathname = usePathname();
   const routeTitles: Record<string, string> = {
    '/shelterScreens': 'Dashboard',
    '/ABC/shelterScreens/sencondpage': 'Shelter Dog List',
    '/ABC/shelterScreens/thirdpage': 'Dog Profile - Release',
    '/ABC/shelterScreens/fourthpage': 'Shelter End Task',
  };
  const title = routeTitles[pathname] || 'Dashboard';


  return (
    <View
      style={{ paddingTop: insets.top }}
      className="mb-2 mt-3 flex-row items-center justify-between bg-[#FFF] px-4 pt-2"
    >
      {/* Menu Icon */}
      <TouchableOpacity  onPress={onMenuPress}>
        <Image
          source={customIcon}
          style={{ width: 34, height: 34 }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Title */}
      <Text className="text-lack flex-1 py-0 text-center text-lg font-medium">
        {title}
      </Text>

      {/* More Icon */}
      <TouchableOpacity className="p-2 px-3">
        <Entypo name="dots-three-horizontal" size={24} color="#1B85F3" />
      </TouchableOpacity>
    </View>
  );
};
export default DashboardHeader;
