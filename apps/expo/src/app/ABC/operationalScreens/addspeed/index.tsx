import React, { useRef, useState } from "react";
import {
  Alert,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { api } from "~/utils/api";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Disable the default Stack header for this screen
export const options = {
  headerShown: false,
};

export default function AddSpeedScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [reading, setReading] = useState<string>("");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');

  const [permission, requestPermission] = useCameraPermissions();

  // API mutations
  const { mutateAsync: getUploadURL } = api.task.getUploadURL.useMutation();
  const createVehicleData = api.vehicleData.create.useMutation();

  const takePhoto = async (): Promise<void> => {
    console.log('takePhoto called');
    if (!cameraRef.current) {
      console.log('cameraRef is null');
      Alert.alert("Error", "Camera not ready. Please try again.");
      return;
    }

    type PhotoResult = {
      uri: string;
      width?: number;
      height?: number;
    };

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      setCaptureLoading(true);
      console.log('Taking picture...');

      // First, ensure the camera is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      const photo = await new Promise<PhotoResult>(async (resolve, reject) => {
        try {
          timeoutId = setTimeout(() => {
            reject(new Error('Camera capture timed out after 5 seconds'));
          }, 5000);

          console.log('Calling takePictureAsync...');
          const options = {
            quality: 0.7,
            skipProcessing: Platform.OS === 'android', // true for Android, false for iOS
            exif: false,
            base64: false,
          };
          console.log('Camera options:', options);

          const result = await cameraRef.current?.takePictureAsync(options);

          if (timeoutId) clearTimeout(timeoutId);

          if (!result || !result.uri) {
            throw new Error('No photo data returned from camera');
          }

          console.log('takePictureAsync result:', result);
          resolve(result as PhotoResult);
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('Error in takePictureAsync:', error);
          reject(error);
        }
      });

      if (photo?.uri) {
        console.log('Photo captured, URI:', photo.uri);

        // For Android, ensure the URI is properly formatted
        let fixedUri = photo.uri;
        if (Platform.OS === 'android') {
          if (!fixedUri.startsWith('file://')) {
            fixedUri = `file://${fixedUri}`;
          }
          // Add a small delay for Android to process the image
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log('Setting capturedUri to:', fixedUri);
        setCapturedUri(fixedUri);
      } else {
        throw new Error('No photo data available');
      }
    } catch (error: unknown) {
      console.error("Photo capture failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert("Error", `Failed to capture image: ${errorMessage}`);
    } finally {
      setCaptureLoading(false);
    }
  };

  const retake = (): void => {
    setCapturedUri(null);
  };

  const uploadImage = async (uri: string): Promise<string> => {
    try {
      console.log('Starting image upload...');
      const extension = uri.split('.').pop()?.toLowerCase() || '';
      const contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      console.log('Getting upload URL...');
      const uploadUrlResponse = await getUploadURL({
        folderName: 'vehicle-readings',
        contentType,
      });

      if (!uploadUrlResponse.success || !uploadUrlResponse.data?.uploadParams) {
        console.error('Failed to get upload URL:', uploadUrlResponse);
        throw new Error('Failed to get upload URL');
      }

      console.log('Uploading image to:', uploadUrlResponse.data.uploadParams);
      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrlResponse.data.uploadParams, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      console.log('Image uploaded successfully');
      return uploadUrlResponse.data.fileUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${errorMessage}`);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!capturedUri) {
      Alert.alert('Error', 'Please capture an image of the speedometer');
      return;
    }

    if (!reading.trim()) {
      Alert.alert('Error', 'Please enter the vehicle reading');
      return;
    }

    try {
      setSubmitLoading(true);
      console.log('Starting form submission...');

      // Upload the image first
      console.log('Uploading image...');
      const imageUrl = await uploadImage(capturedUri);

      console.log('Image uploaded to:', imageUrl);

      console.log('Creating vehicle data record...');
      // Save the vehicle data
      const result = await createVehicleData.mutateAsync({
        date: new Date(),
        vehicleReading: reading,
        imageId: imageUrl,
      });

      if (result.success) {
        console.log('Vehicle data saved successfully');

        // Persist a flag for today's reading so other screens can validate
        const todayKey = `vehicle_reading_${new Date().toISOString().slice(0, 10)}`;
        await AsyncStorage.setItem(todayKey, 'true');

        Alert.alert('Success', 'Vehicle reading saved successfully', [
          {
            text: 'OK',
            onPress: () => router.replace('/ABC/operationalScreens'),
          },
        ]);
      } else {
        throw new Error('Failed to save vehicle data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving vehicle reading:', error);
      Alert.alert(
        'Error',
        `Failed to save vehicle reading: ${errorMessage}`,
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGoToDashboard = (): void => {
    if (!reading.trim()) {
      Alert.alert("Input Required", "Please enter the vehicle reading");
      return;
    }

    // Navigate to dashboard/main page if needed
    router.replace("/ABC/operationalScreens");
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
        <Text className="mt-2 text-white">Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-4">
        <StatusBar barStyle="light-content" />
        <Text className="mb-4 text-center text-lg font-semibold text-white">
          Camera permission is required to capture the speedometer reading.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="rounded-md bg-blue-600 px-4 py-2"
        >
          <Text className="text-white">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black">
          <StatusBar barStyle="light-content" />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Full Screen Camera or Captured Image */}
            <View className="flex-1 items-center justify-center overflow-hidden bg-black min-h-[400px]">
              {capturedUri ? (
                <View style={{ flex: 1, width: '100%', height: '100%' }}>
                  <Image
                    source={{ uri: capturedUri }}
                    className="h-full w-full"
                    resizeMode="cover"
                    onLoadStart={() => console.log('Starting to load image...')}
                    onLoadEnd={() => console.log('Image load ended')}
                    onError={(error) => {
                      console.error('Error loading image:', error.nativeEvent.error);
                      console.log('Failed URI:', capturedUri);
                      Alert.alert(
                        "Error",
                        "Failed to display captured image. Please try again."
                      );
                      // Reset on error to allow retry
                      setCapturedUri(null);
                    }}
                  />
                  {captureLoading && (
                    <View className="absolute inset-0 items-center justify-center bg-black/40">
                      <ActivityIndicator size="large" color="#fff" />
                      <Text className="mt-2 text-white">Processing image...</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ flex: 1, width: '100%', height: '100%' }}>
                  <CameraView
                    ref={cameraRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      flex: 1
                    }}
                    facing={facing}
                    enableTorch={false}
                    onCameraReady={() => {
                      console.log('Camera ready event received');
                      // Add a small delay to ensure camera is fully initialized
                      setTimeout(() => {
                        console.log('Camera should be fully initialized now');
                      }, 500);
                    }}
                    onMountError={(error) => {
                      console.error('Camera mount error:', error);
                      Alert.alert(
                        'Camera Error',
                        'Failed to load camera. Please check app permissions and try again.'
                      );
                    }}
                  >
                    {/* Add a small transparent view to ensure the camera has content */}
                    <View style={{ flex: 1, backgroundColor: 'transparent' }} />
                  </CameraView>
                </View>
              )}

              {captureLoading && (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            </View>

            {/* Curved White Panel - Bottom Section with Concave Design */}
            <View
              style={{
                backgroundColor: '#fff',
                paddingHorizontal: 24,
                paddingTop: 40,
                paddingBottom: 24,
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                marginTop: -30,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 8,
              }}
              className="relative"
            >

              <Text className="mb-4 text-lg font-semibold text-center">
                <Text className="text-blue-600">Enter</Text> Vehicle Reading
              </Text>

              <TextInput
                value={reading}
                onChangeText={setReading}
                placeholder="Enter number"
                keyboardType="numeric"
                className="mb-6 rounded-lg bg-gray-100 px-4 py-3 text-base text-gray-800 text-center"
                editable={!submitLoading}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {/* Button Logic - Fixed condition */}
              {!capturedUri ? (
                // BEFORE CAPTURE: Show only Capture button
                <TouchableOpacity
                  onPress={takePhoto}
                  disabled={captureLoading}
                  className="items-center justify-center rounded-full bg-blue-500 px-4 py-4 mb-4"
                  style={{ minHeight: 50 }}
                >
                  <Text className="text-white text-lg font-semibold">
                    {captureLoading ? "Processing..." : "Capture"}
                  </Text>
                </TouchableOpacity>
              ) : (
                // AFTER CAPTURE: Show Retake + Submit buttons
                <View className="space-y-3">
                  <View className="flex-row justify-between mb-4">
                    <TouchableOpacity
                      onPress={retake}
                      disabled={submitLoading}
                      className="mr-2 flex-1 items-center justify-center rounded-full bg-white border border-gray-300 px-4 py-3"
                      style={{
                        minHeight: 48,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2
                      }}
                    >
                      <Text className="text-gray-700 font-medium">Retake</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={submitLoading}
                      className="ml-2 flex-1 items-center justify-center rounded-full bg-blue-500 px-4 py-3"
                      style={{
                        minHeight: 48,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2
                      }}
                    >
                      <Text className="text-white font-medium">
                        {submitLoading ? 'Saving...' : 'Submit'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}