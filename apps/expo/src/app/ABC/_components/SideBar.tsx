import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { EvilIcons, Ionicons, Fontisto, Feather, MaterialCommunityIcons, Entypo } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { api } from '~/utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { deleteSecurely } from '~/utils/session-store';
import { AppUserContext } from '~/utils/context';
import { useTranslation } from '~/utils/LanguageContext';

const { width } = Dimensions.get('window');

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

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, setIsLoggingOut }) => {
  const { t, language, setLanguage } = useTranslation();
  const { setUserApp } = useContext(AppUserContext);

  // Helper function to transliterate names
  const transliterateName = (name: string) => {
    if (!name || language === "en") return name;

    let transliterated = name;

    if (language === "hi") {
      // Common name transliterations
      transliterated = transliterated
        .replace(/Dr\./gi, "डॉ.")
        .replace(/Mr\./gi, "श्री")
        .replace(/Mrs\./gi, "श्रीमती")
        .replace(/Ms\./gi, "सुश्री")
        .replace(/Admin/gi, "एडमिन")
        .replace(/Manager/gi, "मैनेजर")
        .replace(/Officer/gi, "ऑफिसर")
        .replace(/Supervisor/gi, "सुपरवाइजर")
        .replace(/Team Lead/gi, "टीम लीड")
        .replace(/Coordinator/gi, "कोऑर्डिनेटर");
    } else if (language === "te") {
      // Common name transliterations
      transliterated = transliterated
        .replace(/Dr\./gi, "డాక్టర్")
        .replace(/Mr\./gi, "శ్రీ")
        .replace(/Mrs\./gi, "శ్రీమతి")
        .replace(/Ms\./gi, "కుమారి")
        .replace(/Admin/gi, "అడ్మిన్")
        .replace(/Manager/gi, "మేనేజర్")
        .replace(/Officer/gi, "ఆఫీసర్")
        .replace(/Supervisor/gi, "సూపర్‌వైజర్")
        .replace(/Team Lead/gi, "టీమ్ లీడ్")
        .replace(/Coordinator/gi, "కోఆర్డినేటర్");
    }

    return transliterated;
  };

  const insets = useSafeAreaInsets();
  const [skipQuery, setSkipQuery] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // Reanimated shared values for sidebar/overlay/success banner
  const sidebarTranslateX = useSharedValue(-width * 0.8);
  const overlayOpacity = useSharedValue(0);
  const successTranslateX = useSharedValue(-width * 0.8);

  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidebarTranslateX.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const successAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: successTranslateX.value }],
  }));

  const { data: user, isLoading, error: userError } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: isOpen && !skipQuery,
    retry: false,
    // onError: (err) => {
    //   console.log('getCurrentUser error:', err.message, { skipQuery, isOpen });
    // },
  });
  const utils = api.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
    },
  });

  const signOutMutation = api.auth.signOut.useMutation({
    onMutate: () => {
      setIsLoggingOut(true);
      setSkipQuery(true);
      console.log('Initiating logout, disabling getCurrentUser');
      utils.user.getCurrentUser.cancel();
    },
    onSuccess: async () => {
      await AsyncStorage.removeItem("auth_session");
      utils.user.getCurrentUser.setData(undefined, undefined);
      onClose();
      Toast.show({
        type: 'success',
        text1: 'Logged out successfully',
        text2: 'You have been logged out of your account.',
        visibilityTime: 1000,
        position: 'top',
        topOffset: insets.top + 20,
      });
      setTimeout(() => {
        router.replace('/(auth)');
        setIsLoggingOut(false);
      }, 1300);
    },
    onError: (error) => {
      console.error('Logout failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to log out',
        text2: error.message,
        visibilityTime: 3000,
        position: 'top',
        topOffset: insets.top + 20,
      });
      setIsLoggingOut(false);
      setSkipQuery(false);
    },
  });

  const updateUserMutation = api.user.updateCurrentUser.useMutation({
    onSuccess: () => {
      // Trigger slide-in animation for success banner
      setShowSuccess(true);
      successTranslateX.value = -width * 0.8;
      successTranslateX.value = withTiming(0, { duration: 200 });

      // Slide out after 2 seconds
      setTimeout(() => {
        successTranslateX.value = withTiming(-width * 0.8, { duration: 200 });
        setShowSuccess(false);
      }, 2000);

      utils.user.getCurrentUser.invalidate();
      setIsEditing(false);
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: error.message,
        visibilityTime: 3000,
        position: 'top',
        topOffset: insets.top + 20,
        props: { style: { zIndex: 1000 } },
      });
    },
  });

  // Animate sidebar + overlay when open state changes
  useEffect(() => {
    if (isOpen) {
      sidebarTranslateX.value = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(0.5, { duration: 300 });
    } else {
      sidebarTranslateX.value = withTiming(-width * 0.8, { duration: 300 });
      overlayOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isOpen, sidebarTranslateX, overlayOpacity]);

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
      });
    }
  }, [user, reset]);

  useEffect(() => {
    const unauthorizedError = userError && 'data' in userError ? userError.data?.code === 'UNAUTHORIZED' : false;
    if (unauthorizedError && !signOutMutation.isSuccess) {
      console.log('Session expired detected, redirecting to /(auth)');
      onClose();
      Toast.show({
        type: 'error',
        text1: 'Session expired',
        text2: 'Please log in again',
        visibilityTime: 2000,
        position: 'top',
        topOffset: insets.top + 20,
        props: { style: { zIndex: 1000 } },
      });
      setSkipQuery(true);
      setIsLoggingOut(true);
      setTimeout(() => {
        router.replace('/(auth)');
      }, 2000);
    }
  }, [userError, signOutMutation.isSuccess, setIsLoggingOut, onClose, insets]);

  useEffect(() => {
    return () => {
      if (signOutMutation.isSuccess) {
        setSkipQuery(true);
        setIsEditing(false);
      }
    };
  }, [signOutMutation.isSuccess]);

  const onSubmit = (data: FormData) => {
    if (user?.id) {
      // API already identifies the current user; extra id property breaks the type
      updateUserMutation.mutate(data);
    }
  };

  const handleLogout = async () => {
    signOutMutation.mutate();
    await deleteSecurely("appUser")
    setUserApp(null)
  };

  const buttonWidth = '60%';

  return (
    <>
      {/* Overlay with smooth opacity transition */}
      {isOpen && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '100%',
              backgroundColor: 'black',
              zIndex: 40,
            },
            overlayAnimatedStyle,
          ]}
        >
          <TouchableOpacity
            style={{ width: '100%', height: '100%' }}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>
      )}
      {/* Sidebar with smooth slide-in transition */}
      <Animated.View
        className="absolute top-0 left-0 h-full bg-white p-5 z-50"
        style={[{ width: width * 0.8 }, sidebarAnimatedStyle]}
      >
        <View
          className="flex-row justify-between mt-[10px]"
          style={{ marginTop: insets.top }}
        >
          <TouchableOpacity className="bg-[#F4F4F4] rounded-full p-2" onPress={onClose}>
            <Ionicons name="chevron-back" size={20} color="#1E1E2D" />
          </TouchableOpacity>
          <TouchableOpacity 
          activeOpacity={1}
          className="bg-[#F4F4F4] rounded-full p-2" onPress={() => setIsEditing(!isEditing)}>
            <MaterialCommunityIcons name="account-edit-outline" size={20} color="black" />
          </TouchableOpacity>
        </View>
        {user && (
          <View className="mt-10 py-6">
            <View>
              <Entypo name="users" className="self-center mb-4 bg-gray-100 p-6 rounded-full" size={40} color="gray" />
              <Text className="text-sm text-gray-600 text-center font-regular mb-4">{user.category} - {user.role}</Text>
            </View>
            {isEditing ? (
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text className="text-sm font-regular text-gray-500 mb-1">{t('Full Name')}</Text>
                    <TextInput
                      className="text-lg font-regular text-black text-start border border-gray-300 rounded p-2"
                      value={value}
                      onChangeText={onChange}
                      autoCapitalize="words"
                    />
                  </View>
                )}
              />
            ) : (
              <View className="mb-4 border-b border-gray-300 pb-3 gap-2">
                <Text className="text-sm font-regular text-gray-500 mb-1">{t('Full Name')}</Text>
                <View className="flex-row items-center gap-2">
                  <EvilIcons name="user" size={24} color="black" />
                  <Text className="text-lg font-regular text-black text-start">{transliterateName(user.name || 'N/A')}</Text>
                </View>
              </View>
            )}
            {isEditing ? (
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text className="text-sm font-regular text-gray-500 mb-1">{t('Email Address')}</Text>
                    <TextInput
                      className="text-sm text-black font-regular text-start border border-gray-300 rounded p-2"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                )}
              />
            ) : (
              <View className="mb-4 border-b border-gray-300 pb-3 gap-2">
                <Text className="text-sm font-regular text-gray-500 mb-1">{t('Email Address')}</Text>
                <View className="flex-row items-center gap-2">
                  <Fontisto name="email" size={20} color="black" />
                  <Text className="text-sm font-regular text-black text-start">{user.email || 'N/A'}</Text>
                </View>
              </View>
            )}

            {/* Phone Number */}
            {isEditing ? (
              <Controller
                control={control}
                name="phoneNumber"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-4">
                    <Text className="text-sm font-regular text-gray-500 mb-1">{t('Phone Number')}</Text>
                    <TextInput
                      className="text-sm text-gray-600 text-start font-regular border border-gray-300 rounded p-2"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="phone-pad"
                    />
                  </View>
                )}
              />
            ) : (
              <View className="mb-4 border-b border-gray-300 pb-3 gap-2">
                <Text className="text-sm font-regular text-gray-500 mb-1">{t('Phone Number')}</Text>
                <View className="flex-row items-center gap-2">
                  <Feather name="phone" size={20} color="black" />
                  <Text className="text-sm font-regular text-black text-start">{user.phoneNumber || 'N/A'}</Text>
                </View>
              </View>
            )}

            {/* History Item */}
            <TouchableOpacity
              className="mb-4 relative top-4 border-b  border-gray-300 pb-3 gap-2"
              onPress={() => {
                onClose();
                router.navigate('ABC/operationalScreens/history');
              }}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="time-outline" size={20} color="black" />
                <Text className="text-sm font-regular text-black">{t('History')}</Text>
              </View>
            </TouchableOpacity>

            {showSuccess && (
              <Animated.View
                className="flex-row items-center bg-green-500 p-3 rounded-lg mb-4"
                style={[{ zIndex: 1000 }, successAnimatedStyle]}
              >
                <Feather name="check-circle" size={20} color="white" />
                <Text className="text-white font-regular ml-2">{t('Profile updated successfully')}</Text>
              </Animated.View>
            )}
            <View className="flex-1" />
            <View className="p-4 relative top-32">
              {/* Language Selector */}
              <View className="flex-row justify-center gap-4 mb-4">
                {(['en', 'hi', 'te'] as const).map((lng) => (
                  <TouchableOpacity key={lng} onPress={() => setLanguage(lng as any)}
                     activeOpacity={1}
                  >
                    <Text className={`text-sm ${language === lng ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                      {lng === 'en' ? 'English' : lng === 'hi' ? 'हिंदी' : 'తెలుగు'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="flex-row justify-center items-center gap-2 mb-4">
                <Text className="text-xs font-regular text-gray-500 text-center">{t('Joined')}</Text>
                <Text className="text-sm font-regular text-gray-600 text-center">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                className="bg-[#FF2F52] p-3 rounded-lg items-center self-center"
                onPress={() => {
                  if (isEditing) handleSubmit(onSubmit)();
                  else handleLogout();
                }}
                style={{ width: buttonWidth }}
              >
                <Text className="text-white font-regular text-center">
                  {isEditing ? t('Save') : t('Logout')}
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