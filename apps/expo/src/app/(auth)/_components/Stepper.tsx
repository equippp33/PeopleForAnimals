"use client";

import { useContext, useEffect, useState } from "react";
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { OtpInput } from "react-native-otp-entry";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Controller, useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "~/utils/api";
import { AppUserContext } from "~/utils/context";
import { saveSecurely, setToken } from "~/utils/session-store";

type Category = "surgical team" | "operational team" | "shelter team";

interface StepTwoForm {
  role: Category;
  phoneNumber: string;
}

export default function Stepper() {
  const [currentStep, setCurrentStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [selectedRole, setSelectedRole] = useState<Category>("surgical team");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Track authentication state

  const steps = [1, 2, 3];
  const maxStep = steps.length - 1;

  const handleNext = () => {
    const nextStep = currentStep + 1;
    if (nextStep <= maxStep) {
      setCurrentStep(nextStep);
      if (nextStep > maxStepReached) {
        setMaxStepReached(nextStep);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && !isAuthenticated) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (number: number) => {
    // No navigation allowed via clicking step numbers
  };

  // Disable hardware back button after authentication
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isAuthenticated) {
          // Prevent back navigation after login
          return true; // Consume the event
        }
        return false; // Allow default back behavior
      },
    );

    return () => backHandler.remove();
  }, [isAuthenticated]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center px-4 py-8">

          {/* Back button */}
          {currentStep > 0 && !isAuthenticated && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleBack}
              className="absolute left-0 top-8 z-10 flex-row items-center rounded-full bg-[#D1E6FF] p-1.5"
            >
              <MaterialIcons name="arrow-back-ios-new" size={16} color="#1B85F3" />
            </TouchableOpacity>
          )}

          {/* Logo at top */}
          <View style={{ width: 200, height: 200, borderRadius: 20, overflow: "hidden" }}>
            <Image
              source={require("../../../../assets/images/app_icon.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>

          {/* Step indicators */}
          <View className="mb-6 mt-6 flex-row items-center justify-center gap-2">
            {steps.map((step, index) => {
              const isActive = currentStep === step;
              const isCompleted = step < currentStep;
              const isClickable = false;

              return (
                <View key={step} className="flex flex-row items-center gap-2">
                  {index !== 0 && (
                    <View
                      className={`h-0.5 w-4 rounded-full ${isCompleted ? "bg-[#fcbc03]" : "bg-white opacity-80"}`}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => isClickable && goToStep(step)}
                    disabled={!isClickable}
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${isActive
                      ? "bg-[#fcbc03]"
                      : isCompleted
                        ? "bg-[#fcbc03]"
                        : "bg-white opacity-80"
                      }`}
                  >
                    {isCompleted ? (
                      <FontAwesome name="check" size={14} color="#fff" />
                    ) : (
                      <Text
                        className={`text-sm font-semibold ${isActive ? "text-white" : "text-black"}`}
                      >
                        {step}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Step content */}
          <View className="w-full rounded-xl p-4">
            {currentStep === 0 && <StepOne onNext={handleNext} />}
            {currentStep === 1 && (
              <StepTwo
                onNext={handleNext}
                onSelectRole={setSelectedRole}
                onPhoneNumber={setPhoneNumber}
                initialPhoneNumber={phoneNumber}
                initialRole={selectedRole}
              />
            )}
            {currentStep === 2 && (
              <StepThree
                selectedRole={selectedRole}
                phoneNumber={phoneNumber}
                onAuthenticated={() => setIsAuthenticated(true)}
              />
            )}
          </View>

          {/* Step counter */}
          <View className="mt-4 flex-row items-center rounded-lg bg-white/10 px-4 py-2">
            <Text className="text-sm font-medium text-white">
              Step {currentStep} of {steps.length}
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepOne({ onNext }: { onNext: () => void }) {
  return (
    <View className="flex items-center justify-center">
      <View className="flex items-center justify-center">
        <Text className="text-[32px] font-semibold text-white">People For Animals</Text>
        <Text className="mb-6 text-lg font-semibold text-white">
          Dog Rescue & Management Portal
        </Text>
      </View>
      <TouchableOpacity
        className="w-3/5 overflow-hidden rounded-xl bg-[#fcbc03]"
        onPress={onNext}
      >
        <View className="w-full py-3">
          <Text className="text-center font-semibold text-white">Login</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function StepTwo({
  onNext,
  onSelectRole,
  onPhoneNumber,
  initialPhoneNumber,
  initialRole,
}: {
  onNext: () => void;
  onSelectRole: (role: Category) => void;
  onPhoneNumber: (phone: string) => void;
  initialPhoneNumber: string;
  initialRole: Category;
}) {
  const {
    control,
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<StepTwoForm>({
    defaultValues: {
      role: initialRole || ("surgical team" as Category),
      phoneNumber: initialPhoneNumber || "",
    },
  });

  const selectedRoleValue = watch("role");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = [
    {
      label: "Surgical Team",
      value: "surgical team" as Category,
      icon: <FontAwesome name="stethoscope" size={18} color="#1B85F3" />,
    },
    {
      label: "Operational Team",
      value: "operational team" as Category,
      icon: <FontAwesome name="cog" size={18} color="#1B85F3" />,
    },
    {
      label: "Shelter Team",
      value: "shelter team" as Category,
      icon: <FontAwesome name="home" size={18} color="#1B85F3" />,
    },
  ];

  const checkUser = api.auth.checkUser.useMutation({
    onSuccess: () => {
      setError(null);
      onNext();
    },
    onError: (error: any) => {
      setError(error.message);
      console.error("Error checking user:", error);
    },
  });

  const sendOtp = api.auth.sendOtp.useMutation({
    onSuccess: () => {
      setError(null);
      console.log("OTP sent successfully");
    },
    onError: (error: any) => {
      setError(error.message);
      console.error("Error sending OTP:", error);
    },
  });

  const onSubmit = async (data: StepTwoForm) => {
    console.log(data);
    if (data.role && data.phoneNumber) {
      try {
        await checkUser.mutateAsync({
          phoneNumber: data.phoneNumber,
          category: data.role,
        });

        await sendOtp.mutateAsync({
          phoneNumber: data.phoneNumber,
        });

        onSelectRole(data.role);
        onPhoneNumber(data.phoneNumber);
      } catch (error) {
        console.error("Error in login flow:", error);
      }
    }
  };

  return (
    <>
      <Controller
        control={control}
        name="role"
        render={({ field: { onChange, value } }) => {
          const selectedRole = roles.find((r) => r.value === value);

          return (
            <View className="relative z-50 mb-4">
              <Pressable
                onPress={() => setDropdownVisible(!dropdownVisible)}
                {...register("role", {
                  required: "Role is required",
                })}
                className="flex-row items-center justify-between rounded-full bg-white px-4 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <View className="rounded-full bg-[#D1E6FF] p-2 py-1.5">
                    {selectedRole?.icon || (
                      <FontAwesome name="user" size={18} color="#1B85F3" />
                    )}
                  </View>
                  <Text className="font-medium text-[#1B85F3]">
                    {selectedRole?.label ?? "Select Role"}
                  </Text>
                </View>
                {dropdownVisible ? (
                  <Entypo name="chevron-down" size={18} color="black" />
                ) : (
                  <Entypo name="chevron-up" size={18} color="black" />
                )}
              </Pressable>

              {dropdownVisible && (
                <View className="absolute left-0 right-0 top-16 z-10 rounded-xl bg-white shadow-lg">
                  {roles.map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      className="flex-row items-center px-4 py-3"
                      onPress={() => {
                        onChange(item.value);
                        setDropdownVisible(false);
                        onSelectRole(item.value);
                      }}
                    >
                      {item.icon}
                      <Text className="ml-2 font-medium text-black">
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
      {errors.role && (
        <Text className="text-xs text-red-600">{errors.role.message}</Text>
      )}

      <Controller
        control={control}
        name="phoneNumber"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row items-center rounded-full bg-white">
            <TextInput
              {...register("phoneNumber", {
                required: "Phone Number is required",
                minLength: {
                  value: 10,
                  message: "Phone number must be 10 digits",
                },
              })}
              className="ml-2 p-4 font-medium text-black"
              placeholder="Enter Phone Number"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={10}
              value={value}
              onChangeText={(text: string) => {
                const cleaned = text.replace(/[^0-9]/g, "");
                onChange(cleaned);
                onPhoneNumber(cleaned);
              }}
            />
          </View>
        )}
      />
      {errors.phoneNumber && (
        <Text className="text-xs text-red-600">
          {errors.phoneNumber.message}
        </Text>
      )}

      {error && (
        <View className="mt-2 rounded-lg bg-red-100 p-2">
          <Text className="text-center text-sm text-red-600">{error}</Text>
        </View>
      )}

      <View className="mt-4 items-center">
        <TouchableOpacity
          className={`w-3/5 overflow-hidden rounded-xl py-3 ${selectedRoleValue && watch("phoneNumber").length === 10
            ? "bg-[#fcbc03]"
            : "bg-[#fcbc03]/50"
            }`}
          onPress={handleSubmit(onSubmit)}
          disabled={
            !selectedRoleValue ||
            watch("phoneNumber").length !== 10 ||
            checkUser.isPending ||
            sendOtp.isPending
          }
        >
          <Text className="text-center font-semibold text-white">
            {checkUser.isPending || sendOtp.isPending
              ? "Loading..."
              : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function StepThree({
  selectedRole,
  phoneNumber,
  onAuthenticated,
}: {
  selectedRole: Category;
  phoneNumber: string;
  onAuthenticated: () => void; // Callback to notify authentication
}) {
  const { setUserApp } = useContext(AppUserContext);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const verifyOtp = api.auth.verifyOtp.useMutation({
    onSuccess: async ({ user, token }: any) => {
      setError(null);
      queryClient.clear(); // Clear stale cache from previous session
      onAuthenticated(); // Set authenticated state
      if (token) await setToken(token);
      await setUserApp(user);
      await saveSecurely("appUser", user);
      console.log(saveSecurely, user);
      if (user.category === "surgical team") {
        router.replace("/ABC/surgicalScreens");
      } else if (user.category === "shelter team") {
        router.replace("/ABC/shelterScreens");
      } else {
        router.replace("/ABC/operationalScreens");
      }
    },
    onError: (error: any) => {
      setError(error.message);
      console.error("Error verifying OTP:", error);
    },
  });

  const onSubmit = async () => {
    if (otp.length !== 4) {
      setError("Please enter a complete OTP");
      return;
    }

    await verifyOtp.mutateAsync({
      phoneNumber,
      otp: parseInt(otp, 10),
      category: selectedRole,
    });
  };

  return (
    <View className="flex gap-4 px-4">
      <Text className="mb-2 text-center text-lg font-semibold text-white">
        Enter OTP sent to {phoneNumber}
      </Text>
      <View className="items-center">
        <OtpInput
          numberOfDigits={4}
          onTextChange={(text) => setOtp(text)}
          focusColor="#3b82f6"
          theme={{
            containerStyle: {
              width: "80%",
            },
            pinCodeContainerStyle: {
              backgroundColor: "white",
              borderRadius: 12,
              borderWidth: 2,
              borderColor: "#e5e7eb",
              width: 56,
              height: 56,
            },
            focusedPinCodeContainerStyle: {
              borderColor: "#3b82f6",
              backgroundColor: "#eff6ff",
            },
            filledPinCodeContainerStyle: {
              borderColor: "#3b82f6",
              backgroundColor: "#eff6ff",
            },
            pinCodeTextStyle: {
              color: "#000",
              fontSize: 20,
              fontWeight: "600",
            },
          }}
        />
      </View>

      {error && (
        <View className="rounded-lg bg-red-100 p-2">
          <Text className="text-center text-sm text-red-600">{error}</Text>
        </View>
      )}

      <View className="mt-4 items-center">
        <TouchableOpacity
          className={`w-3/5 overflow-hidden rounded-xl ${verifyOtp.isPending || otp.length !== 4
            ? "bg-[#fcbc03]/50"
            : "bg-[#fcbc03]"
            } py-3`}
          onPress={onSubmit}
          disabled={verifyOtp.isPending || otp.length !== 4}
        >
          <Text className="text-center font-semibold text-white">
            {verifyOtp.isPending ? "Verifying..." : "Verify OTP"}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4 flex-row justify-center">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => setOtp("")}
        >
          <Text className="text-center text-sm font-semibold text-blue-200 underline">
            Clear OTP
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

