import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getBaseUrl } from '../utils/base-url';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isWifiEnabled?: boolean;
  isServerReachable: boolean;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isServerReachable: true,
  });

  const [showStatusChange, setShowStatusChange] = useState(false);

  // Function to manually set server status
  const setServerStatus = useCallback((isReachable: boolean) => {
    setNetworkStatus(prev => {
      const newStatus = { ...prev, isServerReachable: isReachable };
      
      // Show status change animation when server status changes
      if (prev.isServerReachable !== isReachable) {
        setShowStatusChange(true);
        setTimeout(() => setShowStatusChange(false), 3000);
      }
      
      return newStatus;
    });
  }, []);

  useEffect(() => {
    // Get initial network state
    void NetInfo.fetch().then(state => {
      setNetworkStatus(prev => ({
        ...prev,
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type,
        isWifiEnabled: state.isWifiEnabled,
      }));
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const newStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type,
        isWifiEnabled: state.isWifiEnabled,
      };

      setNetworkStatus(prev => {
        // Show status change animation when connection changes
        if (prev.isConnected !== newStatus.isConnected) {
          setShowStatusChange(true);
          setTimeout(() => setShowStatusChange(false), 3000);
        }

        return { ...prev, ...newStatus };
      });
      
      console.log('Network status changed:', {
        isConnected: newStatus.isConnected,
        isInternetReachable: newStatus.isInternetReachable,
        type: newStatus.type,
      });
    });

    // Periodic server health check
    const checkServerHealth = async () => {
      try {
        // Only check if we have internet connection
        const netState = await NetInfo.fetch();
        if (!netState.isConnected || !netState.isInternetReachable) {
          return; // Don't check server if no internet
        }

        // Try to reach the server - use the network IP that works for your TRPC calls
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        // Use the same base URL that TRPC client uses
        const baseUrl = getBaseUrl();
        const response = await fetch(baseUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('Server health check response:', response.status);

        if (response.status < 500) { // Accept any non-server error response
          // Server is reachable
          setNetworkStatus(prev => {
            if (!prev.isServerReachable) {
              console.log('🟢 Server is back online! Status:', response.status);
              setShowStatusChange(true);
              setTimeout(() => setShowStatusChange(false), 3000);
            }
            return { ...prev, isServerReachable: true };
          });
        } else {
          throw new Error('Server not responding');
        }
      } catch (error) {
        // Server is not reachable
        console.log('Server health check failed:', error);
        setNetworkStatus(prev => {
          if (prev.isServerReachable) {
            console.log('Server went offline!');
            setShowStatusChange(true);
            setTimeout(() => setShowStatusChange(false), 3000);
          }
          return { ...prev, isServerReachable: false };
        });
      }
    };

    // Check server health every 5 seconds
    const healthCheckInterval = setInterval(() => {
      void checkServerHealth();
    }, 5000);
    
    // Initial health check
    void checkServerHealth();

    return () => {
      unsubscribe();
      clearInterval(healthCheckInterval);
    };
  }, []);

  const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable && networkStatus.isServerReachable;

  return {
    ...networkStatus,
    isOnline,
    showStatusChange,
    setServerStatus,
  };
};
