import type { GestureResponderEvent } from "react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Svg, { Path } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AntDesign,
  Entypo,
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Controller, useForm } from "react-hook-form";
import * as ImagePicker from "expo-image-picker";

import { api } from "~/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "~/utils/LanguageContext";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive scaling functions
const scale = (size: number) => (screenWidth / 375) * size;
const verticalScale = (size: number) => (screenHeight / 812) * size;

interface TouchPoint {
  x: number;
  y: number;
}

interface FormData {
  supervisorName: string;
  supervisorPhotoUrl: string | null;
  supervisorSignature: string;
}

const EndCaptureScreen = () => {
  const router = useRouter();
  const utils = api.useUtils();
  const { language, t } = useTranslation();

  // Helper function to get error messages based on language
  const getErrorMessage = (key: string) => {
    if (language === "hi") {
      const messages: Record<string, string> = {
        "Error": "एरर",
        "Failed to complete capture task. Please try again.": "कैप्चर टास्क कम्प्लीट नहीं हो सका। कृपया फिर से ट्राई करें।",
        "OK": "ओके",
        "Permission denied": "अनुमति नकारी गई",
        "Camera permission is required": "कैमरा परमिशन आवश्यक है",
        "Failed to take photo": "फोटो लेने में असफल",
        "Delete Photo": "फोटो डिलीट करें",
        "Are you sure you want to delete this photo?": "क्या आप इस फोटो को डिलीट करना चाहते हैं?",
        "Cancel": "कैंसल",
        "Delete": "डिलीट",
        "No batch ID provided": "कोई बैच आईडी नहीं दी गई",
        "Please capture a supervisor photo": "कृपया सुपरवाइजर की फोटो कैप्चर करें",
        "Please enter supervisor name": "कृपया सुपरवाइजर का नाम एंटर करें",
        "Please provide a supervisor signature": "कृपया सुपरवाइजर का सिग्नेचर दें",
        "Confirm Completion": "कम्प्लीशन कन्फर्म करें",
        "Are you sure you want to complete this capture task?": "क्या आप इस कैप्चर टास्क को कम्प्लीट करना चाहते हैं?",
        "Yes": "हाँ",
        "No": "नहीं",
        "Complete": "कम्प्लीट",
        "Failed to complete task. Please try again.": "टास्क कम्प्लीट नहीं हो सका। कृपया फिर से ट्राई करें।",
        "Sign here": "यहाँ साइन करें",
        "Cancel": "कैंसल",
        "Confirm": "कन्फर्म",
        "Submitting...": "सबमिट हो रहा है...",
        "This field is required": "यह फील्ड आवश्यक है"
      };
      return messages[key] || key;
    } else if (language === "te") {
      const messages: Record<string, string> = {
        "Error": "ఎర్రర్",
        "Failed to complete capture task. Please try again.": "క్యాప్చర్ టాస్క్ కంప్లీట్ చేయడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "OK": "ఓకే",
        "Permission denied": "అనుమతి తిరస్కరించబడింది",
        "Camera permission is required": "కెమెరా పర్మిషన్ అవసరం",
        "Failed to take photo": "ఫోటో తీయడంలో విఫలమైంది",
        "Delete Photo": "ఫోటో డిలీట్ చేయండి",
        "Are you sure you want to delete this photo?": "మీరు ఈ ఫోటోను డిలీట్ చేయాలనుకుంటున్నారా?",
        "Cancel": "క్యాన్సెల్",
        "Delete": "డిలీట్",
        "No batch ID provided": "బ్యాచ్ ఐడి అందించబడలేదు",
        "Please capture a supervisor photo": "దయచేసి సూపర్‌వైజర్ ఫోటో క్యాప్చర్ చేయండి",
        "Please enter supervisor name": "దయచేసి సూపర్‌వైజర్ పేరు ఎంటర్ చేయండి",
        "Please provide a supervisor signature": "దయచేసి సూపర్‌వైజర్ సిగ్నేచర్ అందించండి",
        "Confirm Completion": "కంప్లీషన్ కన్ఫర్మ్ చేయండి",
        "Are you sure you want to complete this capture task?": "మీరు ఈ క్యాప్చర్ టాస్క్‌ను కంప్లీట్ చేయాలనుకుంటున్నారా?",
        "Yes": "అవును",
        "No": "లేదు",
        "Complete": "కంప్లీట్",
        "Failed to complete task. Please try again.": "టాస్క్ కంప్లీట్ చేయడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.",
        "Sign here": "ఇక్కడ సైన్ చేయండి",
        "Cancel": "క్యాన్సెల్",
        "Confirm": "కన్ఫర్మ్",
        "Submitting...": "సబ్మిట్ చేస్తున్నాం...",
        "This field is required": "ఈ ఫీల్డ్ అవసరం"
      };
      return messages[key] || key;
    } else {
      return key;
    }
  };

  // Helper function to transliterate names
  const transliterateName = (name: string) => {
    if (!name || language === "en") return name;

    let transliterated = name;

    if (language === "hi") {
      transliterated = transliterated
        .replace(/Supervisor/gi, "सुपरवाइजर")
        .replace(/Manager/gi, "मैनेजर")
        .replace(/Officer/gi, "ऑफिसर")
        .replace(/Admin/gi, "एडमिन")
        .replace(/Dr\./gi, "डॉ.")
        .replace(/Mr\./gi, "श्री")
        .replace(/Mrs\./gi, "श्रीमती")
        .replace(/Ms\./gi, "सुश्री");
    } else if (language === "te") {
      transliterated = transliterated
        .replace(/Supervisor/gi, "సూపర్‌వైజర్")
        .replace(/Manager/gi, "మేనేజర్")
        .replace(/Officer/gi, "ఆఫీసర్")
        .replace(/Admin/gi, "అడ్మిన్")
        .replace(/Dr\./gi, "డాక్టర్")
        .replace(/Mr\./gi, "శ్రీ")
        .replace(/Mrs\./gi, "శ్రీమతి")
        .replace(/Ms\./gi, "కుమారి");
    }

    return transliterated;
  };

  // Helper function to transliterate date/time
  const transliterateDateTime = (dateTime: string) => {
    if (!dateTime || language === "en") return dateTime;

    let transliterated = dateTime;

    if (language === "hi") {
      transliterated = transliterated
        .replace(/Jan/gi, "जन")
        .replace(/Feb/gi, "फर")
        .replace(/Mar/gi, "मार")
        .replace(/Apr/gi, "अप्र")
        .replace(/May/gi, "मई")
        .replace(/Jun/gi, "जून")
        .replace(/Jul/gi, "जुल")
        .replace(/Aug/gi, "अग")
        .replace(/Sep/gi, "सित")
        .replace(/Oct/gi, "अक्ट")
        .replace(/Nov/gi, "नव")
        .replace(/Dec/gi, "दिस")
        .replace(/AM/gi, "पूर्वाह्न")
        .replace(/PM/gi, "अपराह्न");
    } else if (language === "te") {
      transliterated = transliterated
        .replace(/Jan/gi, "జన")
        .replace(/Feb/gi, "ఫిబ్ర")
        .replace(/Mar/gi, "మార్చ")
        .replace(/Apr/gi, "ఏప్రి")
        .replace(/May/gi, "మే")
        .replace(/Jun/gi, "జూన్")
        .replace(/Jul/gi, "జూలై")
        .replace(/Aug/gi, "ఆగ")
        .replace(/Sep/gi, "సెప్ట")
        .replace(/Oct/gi, "అక్ట")
        .replace(/Nov/gi, "నవ")
        .replace(/Dec/gi, "డిసె")
        .replace(/AM/gi, "పూర్వాహ్న")
        .replace(/PM/gi, "అపరాహ్న");
    }

    return transliterated;
  };

  // Helper function to get transliterated location/circle name
  const getLocationDisplayName = () => {
    // If we have batch details with location info, use that
    if (batchDetails?.location) {
      const location = batchDetails.location;
      if (language === "hi" && location.hi_name) {
        return location.hi_name;
      } else if (language === "te" && location.te_name) {
        return location.te_name;
      } else if (location.name) {
        return location.name;
      }
    }

    // If we have circle info, try to use that
    if (batchDetails?.circle) {
      const circle = batchDetails.circle;
      if (language === "hi" && circle.hiCircleName) {
        return circle.hiCircleName;
      } else if (language === "te" && circle.teCircleName) {
        return circle.teCircleName;
      } else if (circle.name) {
        return circle.name;
      }
    }

    // Fallback to circleName from params
    return circleName || "N/A";
  };

  const params = useLocalSearchParams<{
    id?: string;
    location?: string;
    team?: string;
    requestId?: string;
    distance?: string;
    dogs?: string;
    date?: string;
    time?: string;
    requestedby?: string;
    distanceTime?: string;
    distanceInMeters?: string;
    batchId?: string;
    totalDogs?: string;
    circleName?: string;
  }>();

  const { batchId, totalDogs, circleName } = params;

  // Fetch batch details to get location information
  const { data: batchDetails } = api.task.getBatchDetails.useQuery(
    { batchId: batchId as string },
    { enabled: !!batchId }
  );

  const updateStatus = api.task.updateStatus.useMutation();
  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();
  const { mutate: updateSupervisorDetails } =
    api.task.updateBatchSupervisorDetails.useMutation({
      onSuccess: async (_, variables) => {
        try {
          const batchDetails = await utils.task.getBatchDetails.fetch({
            batchId: batchId as string,
          });
          const operationTaskId = batchDetails?.id;
          if (operationTaskId) {
            await AsyncStorage.removeItem(`task_started_${operationTaskId}`);
            await updateStatus.mutateAsync({
              taskId: operationTaskId,
              status: "completed",
            });
          }
        } catch (e) {
          // Silent catch
        }
        await utils.task.getTasksByType.invalidate();
        setShowSuccessModal(true);
      },
      onError: (error) => {
        Alert.alert(
          getErrorMessage("Error"),
          getErrorMessage("Failed to complete capture task. Please try again."),
          [{ text: getErrorMessage("OK") }],
        );
        console.error("Error updating supervisor details:", error);
      },
    });

  const currentDateTime = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const pathRef = useRef("");
  const signatureViewRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      supervisorName: "",
      supervisorPhotoUrl: null,
      supervisorSignature: "",
    },
    mode: "onSubmit",
  });

  const supervisorSignature = watch("supervisorSignature");
  const supervisorPhotoUrl = watch("supervisorPhotoUrl");

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      const extension = uri.split(".").pop()?.toLowerCase() || "";
      const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      const uploadUrlResponse = await getUploadURL({
        folderName: "operational-supervisor",
        contentType,
      });

      if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
        throw new Error("Failed to get upload URL");
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      await fetch(uploadUrlResponse.data.uploadParams, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": contentType,
        },
      });

      return uploadUrlResponse.data.fileUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(getErrorMessage("Permission denied"), getErrorMessage("Camera permission is required"));
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setValue("supervisorPhotoUrl", result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert(getErrorMessage("Error"), getErrorMessage("Failed to take photo"));
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Gallery permission is required");
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setValue("supervisorPhotoUrl", result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking from gallery:", error);
      Alert.alert("Error", "Failed to pick image from gallery");
    } finally {
      setLoading(false);
    }
  };

  const handleCameraPress = () => {
    Alert.alert(
      "Select Image",
      "Choose how you want to add the supervisor's photo",
      [
        {
          text: "Camera",
          onPress: () => takePhoto(),
        },
        {
          text: "Gallery",
          onPress: () => pickFromGallery(),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeletePhoto = () => {
    Alert.alert(getErrorMessage("Delete Photo"), getErrorMessage("Are you sure you want to delete this photo?"), [
      { text: getErrorMessage("Cancel"), style: "cancel" },
      {
        text: getErrorMessage("Delete"),
        style: "destructive",
        onPress: () => setValue("supervisorPhotoUrl", null),
      },
    ]);
  };

  const getRelativePosition = (event: GestureResponderEvent): TouchPoint => {
    const x = event.nativeEvent.locationX || event.nativeEvent.pageX || 0;
    const y = event.nativeEvent.locationY || event.nativeEvent.pageY || 0;
    return {
      x: Math.max(0, Math.min(x, screenWidth - scale(40))),
      y: Math.max(0, Math.min(y, verticalScale(300))),
    };
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (event: GestureResponderEvent) => {
      setIsDrawing(true);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: false });
      }
      const point = getRelativePosition(event);
      if (point.x >= 0 && point.y >= 0 && point.y <= verticalScale(300)) {
        pathRef.current = pathRef.current
          ? `${pathRef.current} M${Math.round(point.x)},${Math.round(point.y)}`
          : `M${Math.round(point.x)},${Math.round(point.y)}`;
        setValue("supervisorSignature", pathRef.current);
      }
    },
    onPanResponderMove: (event: GestureResponderEvent) => {
      if (isDrawing) {
        const point = getRelativePosition(event);
        if (point.x >= 0 && point.y >= 0 && point.y <= verticalScale(300)) {
          pathRef.current += ` L${Math.round(point.x)},${Math.round(point.y)}`;
          setValue("supervisorSignature", pathRef.current);
        }
      }
    },
    onPanResponderRelease: () => {
      setIsDrawing(false);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
      }
    },
    onPanResponderTerminate: () => {
      setIsDrawing(false);
      if (scrollViewRef.current) {
        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
      }
    },
    onShouldBlockNativeResponder: () => true,
  });

  const clearSignature = () => {
    setValue("supervisorSignature", "");
    pathRef.current = "";
  };

  const onSubmit = async (data: FormData) => {
    if (!batchId) {
      Alert.alert(getErrorMessage("Error"), getErrorMessage("No batch ID provided"));
      return;
    }
    if (!data.supervisorPhotoUrl) {
      Alert.alert(getErrorMessage("Error"), getErrorMessage("Please capture a supervisor photo"));
      return;
    }
    if (!data.supervisorName) {
      Alert.alert(getErrorMessage("Error"), getErrorMessage("Please enter supervisor name"));
      return;
    }
    if (!data.supervisorSignature) {
      Alert.alert(getErrorMessage("Error"), getErrorMessage("Please provide a supervisor signature"));
      return;
    }

    try {
      setLoading(true);
      const uploadedUrl = await uploadImage(data.supervisorPhotoUrl);
      Alert.alert(
        getErrorMessage("Confirm Completion"),
        getErrorMessage("Are you sure you want to complete this capture task?"),
        [
          { text: getErrorMessage("Cancel"), style: "cancel" },
          {
            text: getErrorMessage("Complete"),
            onPress: async () => {
              await updateSupervisorDetails({
                batchId: batchId as string,
                supervisorName: data.supervisorName,
                supervisorPhotoUrl: uploadedUrl,
                supervisorSignatureUrl: data.supervisorSignature,
                dogsReceived: parseInt(totalDogs as string, 10) || 0,
              });
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(getErrorMessage("Error"), getErrorMessage("Failed to complete task. Please try again."));
      console.error("Error submitting:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => router.back();
  const showDatePicker = () => setDatePickerVisible(true);
  const hideDatePicker = () => setDatePickerVisible(false);
  const handleConfirm = (date: Date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FBFBFB]">
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-5 pt-5"
        contentContainerStyle={{ paddingBottom: verticalScale(120) }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDrawing}
      >
        {/* Capture Task Details Card */}
        <View className="mb-5 rounded-2xl bg-white shadow-md">
          <View className="px-6 pt-6">
            <View className="flex-row justify-between">
              <Text className="text-2xl font-medium text-black">
                {t("Capture Task")}
              </Text>
              <Text className="text-2xl font-medium text-black">
                {getLocationDisplayName()}
              </Text>
            </View>
          </View>
          <View className="rounded-lg px-6 py-6">
            <View className="mb-2 flex-row justify-between">
              <Text className="font-regular text-md text-[#A4ACB9]">
                {t("Total Dogs Captured")}
              </Text>
              <Text className="text-md font-medium text-black">
                {totalDogs}
              </Text>
            </View>
            <View className="h-px w-full" />
            <View className="flex-row justify-between">
              <Text className="font-regular text-md text-[#A4ACB9]">
                {t("Time of Completion")}
              </Text>
              <Text className="text-md font-medium text-black">
                {transliterateDateTime(currentDateTime)}
              </Text>
            </View>
          </View>
        </View>

        {/* Supervisor Photo Section */}
        <View className="mb-3 items-center rounded-2xl bg-white p-4 py-6 shadow-md">
          <Controller
            control={control}
            name="supervisorPhotoUrl"
            rules={{ required: getErrorMessage("This field is required") }}
            render={({ field: { value } }) => (
              <View className="w-full">
                <View className="flex-row items-center">
                  <View className="mr-4 h-14 w-14 items-center justify-center rounded-lg bg-[#D1E6FF80]">
                    <FontAwesome name="camera" size={24} color="#2F88FF" />
                  </View>
                  <Text className="font-regular flex-1 text-lg text-black">
                    {t("Supervisor Photo")}
                  </Text>
                  {value ? (
                    <View className="flex-row items-center gap-24">
                      <View className="relative">
                        <Image
                          source={{ uri: value }}
                          className="h-16 w-16 rounded-lg"
                        />
                        {loading && (
                          <View className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                            <ActivityIndicator size="small" color="#2F88FF" />
                          </View>
                        )}
                        <TouchableOpacity
                          className="absolute right-0 top-0 h-5 w-5 items-center justify-center rounded-full bg-[#b80e0e]"
                          onPress={handleDeletePhoto}
                          disabled={loading}
                        >
                          <AntDesign name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-[#0EB880]">
                        <AntDesign name="check" size={16} color="white" />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="h-8 w-8 items-center justify-center rounded-full bg-[#D1E6FF80]"
                      onPress={handleCameraPress}
                      disabled={loading}
                    >
                      <Feather
                        name="plus"
                        size={20}
                        color={loading ? "#999" : "#2F88FF"}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                {errors.supervisorPhotoUrl && (
                  <Text className="font-regular mt-1 text-xs text-red-700">
                    {getErrorMessage(errors.supervisorPhotoUrl.message || "This field is required")}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Supervisor Name Section */}
        <View className="mb-3 flex-row items-center rounded-2xl bg-white p-4 py-6 shadow-md">
          <View className="mr-3 h-14 w-14 items-center justify-center rounded-lg bg-[#D1E6FF80]">
            <Entypo name="user" size={24} color="#2F88FF" />
          </View>
          <Controller
            control={control}
            name="supervisorName"
            rules={{ required: getErrorMessage("This field is required") }}
            render={({ field: { onChange, value } }) => (
              <View className="flex-1">
                <TextInput
                  className="font-regular rounded-lg py-2.5 text-lg text-black"
                  placeholder={t("Enter Supervisor name")}
                  placeholderTextColor="#9CA3AF"
                  value={transliterateName(value)}
                  onChangeText={onChange}
                />
                {errors.supervisorName && (
                  <Text className="font-regular mt-1 text-xs text-red-700">
                    {getErrorMessage(errors.supervisorName.message || "This field is required")}
                  </Text>
                )}
              </View>
            )}
          />
        </View>

        {/* Supervisor Signature Section */}
        <View className="rounded-2xl bg-white px-5 py-5">
          <View className="flex-row items-center">
            <View className="mr-4 h-14 w-14 items-center justify-center rounded-lg bg-[#D1E6FF80]">
              <MaterialCommunityIcons
                name="draw-pen"
                size={24}
                color="#1B85F3"
              />
            </View>
            <Text className="font-regular flex-1 text-lg text-black">
              {t("Supervisor Signature")}
            </Text>
            {supervisorSignature && (
              <TouchableOpacity
                className="rounded-sm bg-red-500 px-4 py-2"
                onPress={clearSignature}
              >
                <Text className="text-xs font-light text-white">{t("Clear")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Signature Canvas */}
          <View className="mb-5 mt-4 rounded-2xl bg-[#F9F9F9]">
            <Controller
              control={control}
              name="supervisorSignature"
              rules={{ required: getErrorMessage("This field is required") }}
              render={() => (
                <View className="rounded-lg ">
                  <View
                    ref={signatureViewRef}
                    className="relative items-center justify-center"
                    style={{ height: verticalScale(300) }}
                    {...panResponder.panHandlers}
                  >
                    <Svg
                      height={verticalScale(300)}
                      width={screenWidth - scale(40)}
                      className="absolute left-0 top-0"
                      pointerEvents="none"
                    >
                      {supervisorSignature && (
                        <Path
                          d={supervisorSignature}
                          stroke="#000"
                          strokeWidth="3"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </Svg>
                    {!supervisorSignature && (
                      <View
                        className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center"
                        pointerEvents="none"
                      >
                        <Text className="font-regular text-md text-center text-gray-500">
                          {t("Sign here")}
                        </Text>
                      </View>
                    )}
                  </View>
                  {errors.supervisorSignature && (
                    <Text className="font-regular mt-1 text-xs text-red-700">
                      {getErrorMessage(errors.supervisorSignature.message || "This field is required")}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="absolute bottom-6 left-0 right-0 min-h-[80px] flex-row gap-3 bg-white px-5 py-4">
        <TouchableOpacity
          className="flex-1 items-center justify-center rounded-lg border border-[#1B85F3] py-4"
          onPress={handleCancel}
          disabled={loading}
        >
          <Text className="font-regular text-base text-[#1B85F3]">
            {t("Cancel")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={
            loading
              ? "flex-1 items-center justify-center rounded-lg py-4 bg-gray-400"
              : "flex-1 items-center justify-center rounded-lg py-4 bg-[#1B85F3]"
          }
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
        >
          <Text className="text-base font-medium text-white">
            {loading ? t("Submitting...") : t("Confirm")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal (if needed) */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <LinearGradient
            colors={["white", "#00A5FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 5 }}
            style={{ borderRadius: 16, padding: 24, width: '80%', alignItems: 'center' }}
          >
            <Text className="mb-2 text-xl font-semibold text-center text-[#1B85F3]">{t("Capture Completed 🎉 successfully!")}</Text>
            <Text className="mb-4 text-lg text-[#1B85F3]">{t("Captured Dogs")}: {totalDogs}</Text>
            <TouchableOpacity
              className="mt-2 rounded-lg bg-white px-6 py-3"
              onPress={() => {
                setShowSuccessModal(false);
                router.replace("/ABC/operationalScreens");
              }}
            >
              <Text className="text-base font-medium text-[#1B85F3]">{t("Return Home")}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EndCaptureScreen;