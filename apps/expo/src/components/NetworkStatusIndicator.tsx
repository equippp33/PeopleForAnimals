import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkStatusIndicatorProps {
  style?: any;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ style }) => {
  const { isOnline, showStatusChange, isConnected, isServerReachable } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showStatusChange) {
      // Slide down and fade in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // After 2.5 seconds, slide up and fade out
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 2500);
    }
  }, [showStatusChange, slideAnim, opacityAnim]);

  if (!showStatusChange) {
    return null;
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: isOnline ? '#10B981' : '#EF4444',
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons
          name={isOnline ? 'wifi' : 'wifi-outline'}
          size={20}
          color="white"
          style={{ marginRight: 8 }}
        />
        <Text
          style={{
            color: 'white',
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          {isOnline 
            ? 'Back Online' 
            : !isConnected 
              ? 'No Internet Connection'
              : !isServerReachable 
                ? 'Server Unavailable'
                : 'Connection Issues'
          }
        </Text>
      </View>
    </Animated.View>
  );
};

// Persistent status bar for current connection status - Clean banner style
export const NetworkStatusBar: React.FC<{ style?: any }> = ({ style }) => {
  const { isOnline, isConnected, isServerReachable, showStatusChange } = useNetworkStatus();

  // Show green "We are back" when coming back online
  if (showStatusChange && isOnline) {
    return (
      <View
        style={[
          {
            backgroundColor: '#22C55E',
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
          },
          style,
        ]}
      >
        <Ionicons
          name="checkmark-circle"
          size={18}
          color="white"
          style={{ marginRight: 8 }}
        />
        <Text
          style={{
            color: 'white',
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          We are back...
        </Text>
      </View>
    );
  }

  // Don't show anything when online and not transitioning
  if (isOnline) {
    return null;
  }

  const getStatusInfo = () => {
    if (!isConnected) {
      return {
        text: 'Could not connect to internet',
        icon: 'warning' as const,
        color: '#EF4444'
      };
    } else if (!isServerReachable) {
      return {
        text: 'Could not connect to server',
        icon: 'warning' as const,
        color: '#EF4444'
      };
    } else {
      return {
        text: 'Could not connect to internet',
        icon: 'warning' as const,
        color: '#EF4444'
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <View
      style={[
        {
          backgroundColor: statusInfo.color,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        },
        style,
      ]}
    >
      <Ionicons
        name={statusInfo.icon}
        size={18}
        color="white"
        style={{ marginRight: 8 }}
      />
      <Text
        style={{
          color: 'white',
          fontSize: 14,
          fontWeight: '600',
        }}
      >
        {statusInfo.text}
      </Text>
    </View>
  );
};
