import React, { useContext, useEffect, useState } from "react";
import {
  Dimensions,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import {
  Entypo,
  EvilIcons,
  Feather,
  Fontisto,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Controller, useForm } from "react-hook-form";

import { api } from "~/utils/api";

const { width } = Dimensions.get("window");

interface FormData {
  name: string;
  email: string;
  phoneNumber: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  setIsLoggingOut: (value: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  setIsLoggingOut,
}) => {
  const insets = useSafeAreaInsets();
  const [skipQuery, setSkipQuery] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reanimated 3 values for smooth animations
  const sidebarTranslateX = useSharedValue(-width * 0.8);
  const overlayOpacity = useSharedValue(0);
  const successTranslateX = useSharedValue(-width * 0.8);

  // Animated styles
  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslateX.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: successTranslateX.value }],
  }));

  // Handle sidebar open/close animations
  useEffect(() => {
    if (isOpen) {
      sidebarTranslateX.value = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(0.5, { duration: 300 });
    } else {
      sidebarTranslateX.value = withTiming(-width * 0.8, { duration: 300 });
      overlayOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isOpen]);

  const {
    data: user,
    isLoading,
    error,
  }: {
    data: any;
    isLoading: boolean;
    error: any;
  } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: isOpen && !skipQuery,
    retry: false,
  });
  const utils = api.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
    },
  });

  const signOutMutation = api.auth.signOut.useMutation({
    onMutate: () => {
      setIsLoggingOut(true);
      setSkipQuery(true);
      console.log("Initiating logout, disabling getCurrentUser");
      utils.user.getCurrentUser.cancel();
    },
    onSuccess: async () => {
      await AsyncStorage.removeItem("auth_session");
      utils.user.getCurrentUser.setData(undefined, undefined);
      onClose();
      Toast.show({
        type: "success",
        text1: "Logged out successfully",
        text2: "You have been logged out of your account.",
        visibilityTime: 1000,
        position: "top",
        topOffset: insets.top + 20,
      });
      setTimeout(() => {
        router.replace("/(auth)");
        setIsLoggingOut(false);
      }, 1300);
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      Toast.show({
        type: "error",
        text1: "Failed to log out",
        text2: error.message,
        visibilityTime: 3000,
        position: "top",
        topOffset: insets.top + 20,
      });
      setIsLoggingOut(false);
      setSkipQuery(false);
    },
  });

  const updateUserMutation = api.user.updateCurrentUser.useMutation({
    onSuccess: (data) => {
      // Trigger slide-in animation with Reanimated 3
      setShowSuccess(true);
      successTranslateX.value = withTiming(0, { duration: 200 }, () => {
        // Slide out after 2 seconds
        runOnJS(setTimeout)(() => {
          successTranslateX.value = withTiming(
            -width * 0.8,
            { duration: 200 },
            () => {
              runOnJS(setShowSuccess)(false);
            },
          );
        }, 2000);
      });
      utils.user.getCurrentUser.invalidate();
      setIsEditing(false);
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: error.message,
        visibilityTime: 3000,
        position: "top",
        topOffset: insets.top + 20,
      });
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
      });
    }
  }, [user, reset]);

  useEffect(() => {
    if (error?.data?.code === "UNAUTHORIZED" && !signOutMutation.isSuccess) {
      console.log("Session expired detected, redirecting to /(auth)");
      onClose();
      Toast.show({
        type: "error",
        text1: "Session expired",
        text2: "Please log in again",
        visibilityTime: 2000,
        position: "top",
        topOffset: insets.top + 20,
      });
      setSkipQuery(true);
      setIsLoggingOut(true);
      setTimeout(() => {
        router.replace("/(auth)");
      }, 2000);
    }
  }, [error, signOutMutation.isSuccess, setIsLoggingOut, onClose]);

  useEffect(() => {
    return () => {
      if (signOutMutation.isSuccess) {
        setSkipQuery(true);
        setIsEditing(false);
      }
    };
  }, [signOutMutation.isSuccess]);

  const onSubmit = async (data: FormData) => {
    updateUserMutation.mutate(data);
  };

  const handleLogout = () => {
    signOutMutation.mutate();
  };

  const buttonWidth = "60%";

  return (
    <>
      {/* Overlay with smooth opacity transition */}
      {isOpen && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: "100%",
              backgroundColor: "black",
              zIndex: 40,
            },
            overlayAnimatedStyle,
          ]}
        >
          <TouchableOpacity
            style={{ width: "100%", height: "100%" }}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>
      )}
      {/* Sidebar with smooth slide-in transition */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            backgroundColor: "white",
            padding: 20,
            zIndex: 50,
            width: width * 0.8,
          },
          sidebarAnimatedStyle,
        ]}
      >
        <View
          className="mt-[10px] flex-row justify-between"
          style={{ marginTop: insets.top }}
        >
          <TouchableOpacity
            className="rounded-full bg-[#F4F4F4] p-2"
            onPress={onClose}
          >
            <Ionicons name="chevron-back" size={20} color="#1E1E2D" />
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-full bg-[#F4F4F4] p-2"
            onPress={() => setIsEditing(!isEditing)}
          >
            <MaterialCommunityIcons
              name="account-edit-outline"
              size={20}
              color="black"
            />
          </TouchableOpacity>
        </View>
        {user && (
          <View className="mt-10 py-6">
            <View>
              <Entypo
                name="users"
                className="mb-4 self-center rounded-full bg-gray-100 p-6"
                size={40}
                color="gray"
              />
              <Text className="font-regular mb-4 text-center text-sm text-gray-600">
                {user.category} - {user.role}
              </Text>
            </View>
            {isEditing ? (
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text className="font-regular mb-1 text-sm text-gray-500">
                      Full Name
                    </Text>
                    <TextInput
                      className="font-regular rounded border border-gray-300 p-2 text-start text-lg text-black"
                      value={value}
                      onChangeText={onChange}
                      autoCapitalize="words"
                    />
                  </View>
                )}
              />
            ) : (
              <View className="mb-4 gap-2 border-b border-gray-300 pb-3">
                <Text className="font-regular mb-1 text-sm text-gray-500">
                  Full Name
                </Text>
                <View className="flex-row items-center gap-2">
                  <EvilIcons name="user" size={24} color="black" />
                  <Text className="font-regular text-start text-lg text-black">
                    {user.name}
                  </Text>
                </View>
              </View>
            )}
            {isEditing ? (
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text className="font-regular mb-1 text-sm text-gray-500">
                      Email Address
                    </Text>
                    <TextInput
                      className="font-regular rounded border border-gray-300 p-2 text-start text-sm text-black"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                )}
              />
            ) : (
              <View className="mb-4 gap-2 border-b border-gray-300 pb-3">
                <Text className="font-regular mb-1 text-sm text-gray-500">
                  Email Address
                </Text>
                <View className="flex-row items-center gap-2">
                  <Fontisto name="email" size={20} color="black" />
                  <Text className="font-regular text-start text-sm text-black">
                    {user.email}
                  </Text>
                </View>
              </View>
            )}
            {isEditing ? (
              <Controller
                control={control}
                name="phoneNumber"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text className="font-regular mb-1 text-sm text-gray-500">
                      Phone Number
                    </Text>
                    <TextInput
                      className="font-regular rounded border border-gray-300 p-2 text-start text-sm text-gray-600"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                    />
                  </View>
                )}
              />
            ) : (
              <View className="mb-4 gap-2 border-b border-gray-300 pb-3">
                <Text className="font-regular mb-1 text-sm text-gray-500">
                  Phone Number
                </Text>
                <View className="flex-row items-center gap-2">
                  <Feather name="phone" size={20} color="black" />
                  <Text className="font-regular text-start text-sm text-black">
                    {user.phoneNumber}
                  </Text>
                </View>
              </View>
            )}
            {showSuccess && (
              <Animated.View
                style={[
                  {
                    zIndex: 1000,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#10b981",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                  },
                  successAnimatedStyle,
                ]}
              >
                <Feather name="check-circle" size={20} color="white" />
                <Text className="font-regular ml-2 text-white">
                  Profile updated successfully
                </Text>
              </Animated.View>
            )}
            <View className="flex-1" />
            <View className="relative top-32 p-4">
              <View className="mb-4 flex-row items-center justify-center gap-2">
                <Text className="font-regular text-center text-xs text-gray-500">
                  Joined
                </Text>
                <Text className="font-regular text-center text-sm text-gray-600">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                className="items-center self-center rounded-lg bg-[#FF2F52] p-3"
                onPress={() => {
                  if (isEditing) handleSubmit(onSubmit)();
                  else handleLogout();
                }}
                style={{ width: buttonWidth }}
              >
                <Text className="font-regular text-center text-white">
                  {isEditing ? "Save" : "Logout"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </>
  );
};

export default Sidebar;
