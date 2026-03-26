import React, { useState, useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_300Light,
  DMSans_100Thin,
} from "@expo-google-fonts/dm-sans";
import { TRPCProvider } from "~/utils/api";
import SplashScreen from "./ABC/_components/SplashScreen";
import * as AppSplashScreen from "expo-splash-screen";
import "../styles.css";
import { View, StyleSheet } from "react-native";
import { AppUserContext } from "~/utils/context";
import { LanguageProvider } from "~/utils/LanguageContext";
import { fetchSecurely } from "~/utils/session-store";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  const currentRoute = usePathname();
  const [appUser, setUserApp] = useState(null);
  console.log("Current route:", currentRoute);

  const [fontsLoaded] = useFonts({
    "DMSans-Regular": DMSans_400Regular,
    "DMSans-Bold": DMSans_700Bold,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Light": DMSans_300Light,
    "DMSans-Thin": DMSans_100Thin,
    "DMSans-SemiBold": DMSans_600SemiBold,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let splashHidden = false;

    // Show the splash screen immediately when the component mounts
    const showSplash = async () => {
      try {
        await AppSplashScreen.preventAutoHideAsync();
      } catch (e) {
        console.warn("Splash screen warning:", e);
      }
    };

    const initializeApp = async () => {
      try {
        const storedUser = await fetchSecurely("appUser");
        if (isMounted && storedUser) {
          setUserApp(storedUser);
        }

        // When fonts are ready, we can start showing our React tree
        if (isMounted && fontsLoaded) {
          // Show custom splash for at least 2.2s
          setTimeout(() => {
            if (isMounted) {
              setLoading(false);
              splashHidden = true;
            }
          }, 2200);
        }
      } catch (error) {
        console.error("Init error:", error);
        if (isMounted) {
          setLoading(false);
          splashHidden = true;
        }
      }
    };

    showSplash().then(() => {
      if (isMounted) {
        initializeApp();
      }
    });

    return () => {
      isMounted = false;
      // Ensure splash is hidden when component unmounts
      if (!splashHidden) {
        AppSplashScreen.hideAsync().catch(console.warn);
      }
    };
  }, [fontsLoaded]);

  // Callback for custom splash animation
  const handleAnimationDone = async () => {
    try {
      // Hide the splash screen when animation completes
      await AppSplashScreen.hideAsync().catch(console.warn);
    } catch (err) {
      console.warn("Warning hiding splash:", err);
    }
  };

  // Render SplashScreen immediately
  return (
    <GestureHandlerRootView style={styles.container}>
      <LanguageProvider>
          <AppUserContext.Provider value={{ appUser, setUserApp }}>
        <TRPCProvider>
          {loading ? (
            <SplashScreen onAnimationComplete={handleAnimationDone} />
          ) : (
            <View style={{ flex: 1 }}>
              <StatusBar />
              <Stack screenOptions={{ headerShown: false }} />
            </View>
          )}
        </TRPCProvider>
      </AppUserContext.Provider>
        </LanguageProvider>
    </GestureHandlerRootView>
  );
}