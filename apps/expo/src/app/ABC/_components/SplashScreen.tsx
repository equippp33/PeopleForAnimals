import React, { useEffect } from "react";
import { Image, View, useColorScheme } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";

interface SplashScreenProps {
  onAnimationComplete?: () => void; // Define prop type
}

const SplashScreen = ({ onAnimationComplete }: SplashScreenProps) => {
  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.5);
  const colorScheme = useColorScheme();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const handleAnimationComplete = () => {
    console.log("Animation completed at:", new Date().toISOString());
    if (onAnimationComplete) onAnimationComplete();
  };

  useEffect(() => {
    console.log("Animation starting at:", new Date().toISOString());
    
    // Start fade animation
    fadeAnim.value = withTiming(1, { duration: 1800 });
    
    // Start scale animation with completion callback
    scaleAnim.value = withTiming(1, { duration: 1400 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(handleAnimationComplete)();
      }
    });
  }, [onAnimationComplete]);

  const backgroundColor = colorScheme === "dark" ? "#1A202C" : "#F5F5F5";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={require("../../../../assets/images/abc-mobile-2.png")}
          style={{ width: 460, height: 240 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

export default SplashScreen;