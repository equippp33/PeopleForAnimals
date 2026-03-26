import React from "react";
import {  ImageBackground,  View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../../styles.css";

export default function AuthLayout() {
  console.log("AuthLayout");
  return (
    <View className="flex-1">
      {/* <ImageBackground
        source={require("../../../assets/images/login-bg.webp")}
        resizeMode="cover"
        className="absolute h-full w-full left-0.4"
      > */}

        <StatusBar style="light" />

        {/* Dark overlay to dim background image */}
        <View className="absolute inset-0 bg-black/50" />

        {/* Wrap Stack in a full-height view */}
        <View className="flex-1 bg-transparent">
          <Stack
            screenOptions={{  
              headerShown: false,
              contentStyle: {
                backgroundColor: "transparent",
              },
            }}
          />
        </View>
      {/* </ImageBackground> */}
    </View>
  );
}