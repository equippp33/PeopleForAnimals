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
import { Controller, useForm } from "react-hook-form";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const ReleaseEndTaskScreen = () => {
    const router = useRouter();
    const utils = api.useUtils();
    const { t } = useTranslation();

    const params = useLocalSearchParams<{
        batchId?: string;
        releasedDogs?: string;
        circleName?: string;
    }>();

    const { batchId, releasedDogs = "0", circleName } = params;

    // Fetch authoritative released-dogs count from backend
    const {
        data: releasedCountResp,
        isLoading: releasedCountLoading,
    } = api.task.getReleasedDogsCount.useQuery(
        { batchId: batchId! },
        { enabled: !!batchId },
    );

    // Prefer server value when available; fallback to param for immediate UX
    const releasedDogsCount =
        releasedCountResp?.success && typeof releasedCountResp.count === "number"
            ? releasedCountResp.count
            : parseInt(releasedDogs, 10) || 0;

    // mutation to mark op-task completed (reuse existing)
    const updateStatus = api.task.updateStatus.useMutation();
    const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();

    const { mutate: updateReleaseDetails } =
        api.task.updateReleaseSupervisorDetails.useMutation({
            onSuccess: async () => {
                try {
                    // invalidate caches so Vehicle Assignment UI reopens controls
                    await Promise.all([
                        utils.task.getTasksByType.invalidate(),
                        utils.task.getAllReleaseTasks.invalidate(),
                    ]);
                } catch { }
                setShowSuccessModal(true);
            },
            onError: () => {
                Alert.alert(t("Error"), t("Failed to complete release task. Please try again."));
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
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

    const supervisorPhoto = watch("supervisorPhotoUrl");
    const supervisorSignature = watch("supervisorSignature");

    // utilities
    const showDatePicker = () => setDatePickerVisible(true);
    const hideDatePicker = () => setDatePickerVisible(false);
    const handleConfirm = (date: Date) => {
        setSelectedDate(date);
        hideDatePicker();
    };

    const uploadImage = async (uri: string): Promise<string> => {
        const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
        const contentType = `image/${extension === "jpg" ? "jpeg" : extension}`;

        const uploadUrlResponse = await getUploadURL({
            folderName: "release-supervisor",
            contentType,
        });

        if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
            throw new Error("Failed to get upload URL");
        }

        const imageBlob = await (await fetch(uri)).blob();
        await fetch(uploadUrlResponse.data.uploadParams, {
            method: "PUT",
            body: imageBlob,
            headers: { "Content-Type": contentType },
        });

        return uploadUrlResponse.data.fileUrl;
    };

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
                Alert.alert(t("Permission denied"), t("Camera permission is required"));
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
            Alert.alert(t("Error"), t("Failed to take photo"));
        } finally {
            setLoading(false);
        }
    };

    const pickFromGallery = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert(t("Permission denied"), t("Gallery permission is required"));
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
            Alert.alert(t("Error"), t("Failed to pick image from gallery"));
        } finally {
            setLoading(false);
        }
    };

    const handleCameraPress = () => {
        Alert.alert(
            t("Select Image"),
            t("Choose how you want to add the supervisor's photo"),
            [
                {
                    text: t("Camera"),
                    onPress: () => takePhoto(),
                },
                {
                    text: t("Gallery"),
                    onPress: () => pickFromGallery(),
                },
                {
                    text: t("Cancel"),
                    style: "cancel",
                },
            ],
            { cancelable: true }
        );
    };

    const handleDeletePhoto = () => {
        Alert.alert(t("Delete Photo"), t("Are you sure you want to delete this photo?"), [
            { text: t("Cancel"), style: "cancel" },
            {
                text: t("Delete"),
                style: "destructive",
                onPress: () => setValue("supervisorPhotoUrl", null),
            },
        ]);
    };

    const clearSignature = () => {
        setValue("supervisorSignature", "");
        pathRef.current = "";
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

    const onSubmit = async (data: FormData) => {
        if (!batchId) {
            Alert.alert(t("Error"), t("No batch ID provided"));
            return;
        }
        if (!data.supervisorPhotoUrl) {
            Alert.alert(t("Error"), t("Please capture a supervisor photo"));
            return;
        }
        if (!data.supervisorName) {
            Alert.alert(t("Error"), t("Please enter supervisor name"));
            return;
        }
        if (!data.supervisorSignature) {
            Alert.alert(t("Error"), t("Please provide a supervisor signature"));
            return;
        }

        try {
            setLoading(true);
            const uploadedUrl = await uploadImage(data.supervisorPhotoUrl);
            Alert.alert(
                t("Confirm Completion"),
                t("Are you sure you want to complete this release task?"),
                [
                    { text: t("Cancel"), style: "cancel" },
                    {
                        text: t("Complete"),
                        onPress: async () => {
                            await updateReleaseDetails({
                                batchId,
                                supervisorName: data.supervisorName,
                                supervisorPhotoUrl: uploadedUrl,
                                supervisorSignatureUrl: data.supervisorSignature,
                                releasedDogs: releasedDogsCount,
                            });
                        },
                    },
                ],
            );
        } catch (err) {
            Alert.alert(t("Error"), t("Failed to complete task. Please try again."));
            console.error("Error submitting:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => router.back();

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
                {/* Release Task Details Card */}
                <View className="mb-5 rounded-2xl bg-white shadow-md">
                    <View className="px-6 pt-6">
                        <View className="flex-row justify-between">
                            <Text className="text-2xl font-medium text-black">
                                {t("Release Task")}
                            </Text>
                            <Text className="text-2xl font-medium text-black">
                                {circleName}
                            </Text>
                        </View>
                    </View>
                    <View className="rounded-lg px-6 py-6">
                        <View className="mb-2 flex-row justify-between">
                            <Text className="font-regular text-md text-[#A4ACB9]">
                                {t("Total Dogs Released")}
                            </Text>
                            {releasedCountLoading ? (
                                <ActivityIndicator size="small" />
                            ) : (
                                <Text className="text-md font-medium text-black">
                                    {releasedDogsCount}
                                </Text>
                            )}
                        </View>
                        <View className="h-px w-full" />
                        <View className="flex-row justify-between">
                            <Text className="font-regular text-md text-[#A4ACB9]">
                                {t("Time of Completion")}
                            </Text>
                            <Text className="text-md font-medium text-black">
                                {currentDateTime}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Supervisor Photo Section */}
                <View className="mb-3 items-center rounded-2xl bg-white p-4 py-6 shadow-md">
                    <Controller
                        control={control}
                        name="supervisorPhotoUrl"
                        rules={{ required: t("This field is required") }}
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
                                        {t(errors.supervisorPhotoUrl.message!)}
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
                        rules={{ required: t("This field is required") }}
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-1">
                                <TextInput
                                    className="font-regular rounded-lg py-2.5 text-lg text-black"
                                    placeholder={t("Enter Supervisor name")}
                                    placeholderTextColor="#999"
                                    value={value}
                                    onChangeText={onChange}
                                />
                                {errors.supervisorName && (
                                    <Text className="font-regular mt-1 text-xs text-red-700">
                                        {t(errors.supervisorName.message!)}
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
                                <Text className="text-xs font-light text-white">
                                    {t("Clear")}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Signature Canvas */}
                    <View className="mb-5 mt-4 rounded-2xl bg-[#F9F9F9]">
                        <Controller
                            control={control}
                            name="supervisorSignature"
                            rules={{ required: t("This field is required") }}
                            render={() => (
                                <View className="rounded-lg">
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
                                            {t(errors.supervisorSignature.message!)}
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
                    className={`flex-1 items-center justify-center rounded-lg py-4 ${loading ? "bg-gray-400" : "bg-[#1B85F3]"}`}
                    onPress={handleSubmit(onSubmit)}
                    disabled={loading}
                >
                    <Text className="text-base font-medium text-white">
                        {loading ? t("Submitting...") : t("Confirm")}
                    </Text>
                </TouchableOpacity>
            </View>

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
                        style={{ borderRadius: 16, padding: 24, width: "80%", alignItems: "center" }}
                    >
                        <Text className="mb-2 text-xl font-semibold text-center text-[#1B85F3]">
                            {t("Release Completed 🎉 successfully!")}
                        </Text>
                        <Text className="mb-4 text-lg text-[#1B85F3]">
                            {t("Released Dogs:")} {releasedDogsCount}
                        </Text>
                        <TouchableOpacity
                            className="mt-2 rounded-lg bg-white px-6 py-3"
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.replace("/ABC/operationalScreens");
                            }}
                        >
                            <Text className="text-base font-medium text-[#1B85F3]">
                                {t("Return Home")}
                            </Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default ReleaseEndTaskScreen;