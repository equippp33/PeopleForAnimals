import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Fontisto, Ionicons } from "@expo/vector-icons";

interface TabItem {
  key: "surgery" | "release";
  label: string;
  icon: string;
  iconSource: "Ionicons" | "Fontisto";
}

interface BottomTabNavigationProps {
  activeTab: "surgery" | "release";
  setActiveTab: (tab: "surgery" | "release") => void;
}

export default function BottomTabNavigation({
  activeTab,
  setActiveTab,
}: BottomTabNavigationProps) {
  const tabs: TabItem[] = [
    {
      key: "surgery",
      label: "Surgery",
      icon: "surgical-knife",
      iconSource: "Fontisto",
    },
    {
      key: "release",
      label: "Release",
      icon: "exit-outline",
      iconSource: "Ionicons",
    },
  ];

  const handleTabPress = (tab: TabItem) => {
    setActiveTab(tab.key);
  };

  return (
    <View
      className="absolute bottom-0 left-16 right-16 mx-4 mb-2 rounded-full bg-white px-6 py-2"
      style={styles.container}
    >
      <View className="flex-row items-center justify-around gap-4">
        {/* Surgery Tab */}
        <TouchableOpacity
          className={`items-center gap-1 rounded-full px-5 py-1 ${
            activeTab === tabs[0]?.key ? "bg-transparent" : "bg-transparent"
          }`}
          activeOpacity={1}
          onPress={() => tabs[0] && handleTabPress(tabs[0])}
        >
          {tabs[0]?.iconSource === "Ionicons" ? (
            <Ionicons
              name={tabs[0]?.icon as any}
              size={20}
              color={activeTab === tabs[0]?.key ? "#1B85F3" : "gray"}
            />
          ) : (
            <Fontisto
              name={tabs[0]?.icon as any}
              size={20}
              color={activeTab === tabs[0]?.key ? "#1B85F3" : "gray"}
            />
          )}
          <Text
            className={`ml-2 text-xs font-light ${
              activeTab === tabs[0]?.key ? "text-[#1B85F3]" : "text-gray-500"
            }`}
          >
            {tabs[0]?.label}
          </Text>
        </TouchableOpacity>

        {/* Horizontal Divider */}
        <View className="h-8 w-px bg-gray-300" />

        {/* Release Tab */}
        <TouchableOpacity
          className={`items-center gap-1 rounded-full px-5 py-1 ${
            activeTab === tabs[1]?.key ? "bg-transparent" : "bg-transparent"
          }`}
          activeOpacity={1}
          onPress={() => tabs[1] && handleTabPress(tabs[1])}
        >
          {tabs[1]?.iconSource === "Ionicons" ? (
            <Ionicons
              name={tabs[1]?.icon as any}
              size={20}
              color={activeTab === tabs[1]?.key ? "#1B85F3" : "gray"}
            />
          ) : (
            <Fontisto
              name={tabs[1]?.icon as any}
              size={20}
              color={activeTab === tabs[1]?.key ? "#1B85F3" : "gray"}
            />
          )}
          <Text
            className={`ml-2 text-xs font-light ${
              activeTab === tabs[1]?.key ? "text-[#1B85F3]" : "text-gray-500"
            }`}
          >
            {tabs[1]?.label}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
