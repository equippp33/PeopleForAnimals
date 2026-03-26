import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Entypo, Ionicons } from "@expo/vector-icons";
import { useTabContext } from "./TabContext";
import { usePathname, useRouter } from "expo-router";
import { useTranslation } from "~/utils/LanguageContext";

const customIcon = require("../../../../assets/images/menu_icon.webp");

const DashboardHeader: React.FC<{ onMenuPress: () => void }> = ({ onMenuPress }) => {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { selectedTab } = useTabContext();
  const { language, t } = useTranslation();

  // Helper function to transliterate header titles
  const getHeaderTitle = (title: string) => {
    if (language === "hi") {
      const titles: Record<string, string> = {
        "Dashboard": "डैशबोर्ड",
        "Capture Map": "कैप्चर मैप",
        "Capture Dog": "डॉग कैप्चर करें",
        "End Capture": "कैप्चर एंड करें",
        "Add Dog": "डॉग ऐड करें",
        "Release Map": "रिलीज मैप",
        "Release Dog List": "डॉग रिलीज लिस्ट",
        "Release End Task": "रिलीज एंड टास्क",
        "Release Dog": "डॉग रिलीज करें",
        "Capture List": "कैप्चर लिस्ट",
        "Release List": "रिलीज लिस्ट",
        "Dog Profile": "डॉग प्रोफाइल",
        "Add Speed": "स्पीड ऐड करें",
        "History": "हिस्ट्री"
      };
      return titles[title] || title;
    } else if (language === "te") {
      const titles: Record<string, string> = {
        "Dashboard": "డాష్‌బోర్డ్",
        "Capture Map": "క్యాప్చర్ మ్యాప్",
        "Capture Dog": "డాగ్ క్యాప్చర్ చేయండి",
        "End Capture": "క్యాప్చర్ ఎండ్ చేయండి",
        "Add Dog": "డాగ్ యాడ్ చేయండి",
        "Release Map": "రిలీజ్ మ్యాప్",
        "Release Dog List": "డాగ్ రిలీజ్ లిస్ట్",
        "Release End Task": "రిలీజ్ ఎండ్ టాస్క్",
        "Release Dog": "డాగ్ రిలీజ్ చేయండి",
        "Capture List": "క్యాప్చర్ లిస్ట్",
        "Release List": "రిలీజ్ లిస్ట్",
        "Dog Profile": "డాగ్ ప్రొఫైల్",
        "Add Speed": "స్పీడ్ యాడ్ చేయండి",
        "History": "హిస్టరీ"
      };
      return titles[title] || title;
    } else {
      return title;
    }
  };

  // Define routes where the header should be hidden
  const hiddenHeaderRoutes = [
    "/ABC/operationalScreens/addspeed",
    "/ABC/operationalScreens/history",
    "/operationalScreens/addspeed",
    "/operationalScreens/history",
  ];

  // Define routes where the add button should be disabled
  const disabledAddButtonRoutes = [
    "/ABC/operationalScreens/releasemap",
    "/ABC/operationalScreens/releaseDogList", 
    "/ABC/operationalScreens/release_EndTask",
    "/ABC/operationalScreens/releasedog",
    "/operationalScreens/releasemap",
    "/operationalScreens/releaseDogList",
    "/operationalScreens/release_EndTask",
    "/operationalScreens/releasedog",
    // Add more routes here as needed
  ];

  // Hide header for specified routes
  if (hiddenHeaderRoutes.includes(pathname)) {
    return null;
  }

  const routeTitles: Record<string, string> = {
    "/ABC/operationalScreens": "Dashboard",
    "/ABC/operationalScreens/capturemap": "Capture Map",
    "/ABC/operationalScreens/capturedog": "Capture Dog", 
    "/ABC/operationalScreens/endCapture": "End Capture",
    "/ABC/operationalScreens/adddog": "Add Dog",
    "/ABC/operationalScreens/releasemap": "Release Map",
    "/ABC/operationalScreens/releaseDogList": "Release Dog List",
    "/ABC/operationalScreens/release_EndTask": "Release End Task",
    "/ABC/operationalScreens/releasedog": "Release Dog",
    "/ABC/operationalScreens/capturelist": "Capture List",
    "/ABC/operationalScreens/releaselist": "Release List",
    "/ABC/operationalScreens/dogprofile": "Dog Profile",
    "/ABC/operationalScreens/addspeed": "Add Speed",
    "/ABC/operationalScreens/history": "History",
    // Also support without /ABC prefix for backward compatibility
    "/operationalScreens": "Dashboard",
    "/operationalScreens/capturemap": "Capture Map",
    "/operationalScreens/capturedog": "Capture Dog",
    "/operationalScreens/endCapture": "End Capture",
    "/operationalScreens/adddog": "Add Dog",
    "/operationalScreens/releasemap": "Release Map",
    "/operationalScreens/releaseDogList": "Release Dog List",
    "/operationalScreens/release_EndTask": "Release End Task",
    "/operationalScreens/releasedog": "Release Dog",
    "/operationalScreens/capturelist": "Capture List",
    "/operationalScreens/releaselist": "Release List",
    "/operationalScreens/dogprofile": "Dog Profile",
    "/operationalScreens/addspeed": "Add Speed",
    "/operationalScreens/history": "History",
  };

  // Get title with fallback logic
  const getPageTitle = (): string => {
    // First try exact match
    if (routeTitles[pathname]) {
      return routeTitles[pathname];
    }
    
    // Try to match by checking if pathname starts with any of our routes
    for (const [route, title] of Object.entries(routeTitles)) {
      if (pathname.startsWith(route) && route !== "/ABC/operationalScreens" && route !== "/operationalScreens") {
        return title;
      }
    }
    
    // Default fallback
    return "Dashboard";
  };

  const title = getPageTitle();

  // Check if the add button should be disabled
  const isAddButtonDisabled = disabledAddButtonRoutes.includes(pathname);

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="mb-2 mt-3 flex-row items-center justify-between bg-[#FFF] px-4 pt-2"
    >
      {/* Menu Icon */}
      <TouchableOpacity onPress={onMenuPress}>
        <Image
          source={customIcon}
          style={{ width: 34, height: 34 }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Title */}
      <Text className="flex-1 py-0 text-center text-lg font-medium text-black">
        {getHeaderTitle(title)}
      </Text>

      {/* Conditional Icon */}
      {selectedTab === "capture" ? (
        <TouchableOpacity className="p-2 px-3">
          <Entypo name="dots-three-horizontal" size={24} color="#1B85F3" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          className={`p-2 px-3 ${isAddButtonDisabled ? "opacity-50" : ""}`}
          onPress={() => {
            if (!isAddButtonDisabled) {
              router.push("/ABC/operationalScreens/addspeed" as any);
            }
          }}
          disabled={isAddButtonDisabled}
        >
          <Ionicons
            name="add-circle-outline"
            size={26}
            color={isAddButtonDisabled ? "#A0AEC0" : "#1B85F3"}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default DashboardHeader;