import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { api } from '~/utils/api';
import { useTranslation } from '~/utils/LanguageContext';

const { width } = Dimensions.get('window');

interface Dog {
  id: string;
  dogImageUrl: string;
  gender: string;
  dog_tag_id?: string | null;
  location: string | null;
  status?: string | null;
  releaseStatus?: string | null;
  dogColor?: string | null;
  weight?: number | null;
  cageNo?: string | null;
  surgeryStatus?: string | null;
  coordinates?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  } | null;
  fullAddress?: string | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}

export default function ReleaseDogListScreen() {
  const { t } = useTranslation();
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  // Track user location once permission is granted
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('Location permission denied');
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLocation(loc);

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (locUpdate) => setUserLocation(locUpdate)
        );
      } catch (error) {
        console.error('Error fetching location:', error);
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const { batchId, circleName } = useLocalSearchParams<{ batchId?: string; circleName?: string }>();

  const { data: dogsData = [], isLoading } = api.dogs.getDogsByBatchId.useQuery(
    { batchId: batchId || '' },
    {
      enabled: !!batchId,
    }
  );

  // Cast API data to local Dog type for easier handling
  const dogs = useMemo(() => dogsData as unknown as Dog[], [dogsData]);

  // Local visible list: hide dogs already released
  const visibleDogs = useMemo(
    () =>
      dogs.filter(d => {
        const state = (d.releaseStatus ?? d.status) ?? '';
        return state !== 'released' && state !== 'missing';
      }),
    [dogs]
  );

  // Get unique locations for map markers
  const dogLocations = useMemo(() => {
    return visibleDogs
      .filter(dog => (dog.coordinates?.lat ?? dog.coordinates?.latitude) && (dog.coordinates?.lng ?? dog.coordinates?.longitude))
      .map(dog => ({
        id: dog.id,
        coordinates: {
          latitude: dog.coordinates!.lat ?? dog.coordinates!.latitude!,
          longitude: dog.coordinates!.lng ?? dog.coordinates!.longitude!,
        },
        title: `Dog ${dog.dog_tag_id ?? dog.id.substring(0, 6)}`,
        description: `Status: ${dog.status}`,
      }));
  }, [visibleDogs]);

  // Calculate map region based on dog locations
  const mapRegion = useMemo(() => {
    if (dogLocations.length === 0) {
      return {
        latitude: 12.9716, // Default to Bangalore
        longitude: 77.5946,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }

    // Calculate bounds
    const lats = dogLocations.map(loc => loc.coordinates.latitude);
    const lngs = dogLocations.map(loc => loc.coordinates.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const padding = 0.01; // Add some padding around markers

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + padding,
      longitudeDelta: (maxLng - minLng) + padding,
    };
  }, [dogLocations]);

  const formatDate = (dateString?: Date | string) => {
    if (!dateString) return t('N/A');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleRelease = (dog: Dog) => {
    router.push({
      pathname: '/ABC/operationalScreens/releasedog',
      params: {
        id: dog.id,
        dog_tag_id: dog.dog_tag_id ?? undefined,
        batchId: batchId ?? undefined,
      },
    });
  };

  const renderDogCard = useCallback(
    ({ item }: { item: Dog }) => {
      console.log('RenderDogCard:', { itemId: item.id, coordinates: item.coordinates, userLocation });
      return (
        <View className="w-[157px] h-[195px] rounded-[10px] border border-gray-200 bg-white overflow-hidden shadow-[0_1px_2px_0_rgba(0,0,0,0.1)]">
          <Image
            source={{ uri: item.dogImageUrl || 'https://via.placeholder.com/157x120' }}
            className="w-full h-[120px] bg-gray-100"
            resizeMode="cover"
          />
          <View className="p-2 min-h-[75px]">
            <Text className="text-sm font-semibold text-blue-500 mb-1">
              #{(item.dog_tag_id ?? item.id.substring(0, 6)).toUpperCase()}
            </Text>
            <View className="flex-row items-center mb-1">
              <Text className="text-xs text-gray-600">{item.gender || t('Unknown')}</Text>
              <Text className="text-xs text-gray-600 mx-0.5">•</Text>
              <Text className="text-xs text-gray-600">{formatDate(item.createdAt)}</Text>
            </View>
            {(() => {
              const dogLat = item.coordinates?.lat ?? item.coordinates?.latitude ?? null;
              const dogLng = item.coordinates?.lng ?? item.coordinates?.longitude ?? null;
              const isValidCoordinate = (coord: number | null) =>
                coord !== null && !isNaN(coord) && isFinite(coord);
              if (
                !userLocation ||
                !isValidCoordinate(dogLat) ||
                !isValidCoordinate(dogLng) ||
                !isValidCoordinate(userLocation.coords.latitude) ||
                !isValidCoordinate(userLocation.coords.longitude)
              ) {
                console.log('DistanceDebug Skipped:', { userLocation, dogLat, dogLng });
                return <Text className="text-sm text-gray-400">{t('Location unavailable')}</Text>;
              }
              console.log('DistanceDebug', {
                userCoords: userLocation.coords,
                dogCoords: item.coordinates,
              });
              const R = 6371e3;
              const toRad = (v: number) => (v * Math.PI) / 180;
              const dLat = toRad(dogLat - userLocation.coords.latitude);
              const dLon = toRad(dogLng - userLocation.coords.longitude);
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(userLocation.coords.latitude)) *
                Math.cos(toRad(dogLat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const distanceM = Math.round(R * c);
              console.log('DistanceDebug Result:', { distanceM });
              return (
                <Text className="text-sm text-gray-400">
                  {distanceM} {t('meters away')}
                </Text>
              );
            })()}
          </View>
          <TouchableOpacity
            className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-[#1B85F3] flex items-center justify-center shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]"
            onPress={() => handleRelease(item)}
          >
            <Ionicons name="chevron-forward" size={18} color="white" />
          </TouchableOpacity>
        </View>
      );
    },
    [userLocation]
  );

  const renderDogPairs = useCallback(
    ({ item, index }: { item: Dog[], index: number }) => (
      <View className="flex-row mb-4 justify-between">
        {item.map((dog, dogIndex) => (
          <View key={dog.id} className={`w-[${(width - 48) / 2}px] ${dogIndex === 1 ? 'ml-2' : ''}`}>
            {renderDogCard({ item: dog })}
          </View>
        ))}
      </View>
    ),
    [renderDogCard]
  );

  // Group dogs into pairs for 2-column layout
  const dogPairs = useMemo(() => {
    const pairs: Dog[][] = [];
    for (let i = 0; i < visibleDogs.length; i += 2) {
      pairs.push(visibleDogs.slice(i, i + 2));
    }
    return pairs;
  }, [visibleDogs]);

  const handleEndTask = () => {
    // Only allow ending task if all dogs are released
    if (visibleDogs.length > 0) {
      return;
    }

    const releasedDogsCount = dogs.filter(d => (d.releaseStatus ?? d.status) === 'released').length;
    router.push({
      pathname: '/ABC/operationalScreens/release_EndTask',
      params: {
        batchId: batchId ?? undefined,
        releasedDogs: String(releasedDogsCount),
        circleName: circleName ?? undefined,
      },
    });
  };

  // Check if all dogs are released
  const allDogsReleased = visibleDogs.length === 0;

  // Calculate male and female counts
  const maleCount = visibleDogs.filter(dog => dog.gender?.toLowerCase() === 'male').length;
  const femaleCount = visibleDogs.filter(dog => dog.gender?.toLowerCase() === 'female').length;
  const lastUpdated = useMemo(() => {
    if (visibleDogs.length === 0) return new Date().toLocaleDateString();
    const ts = visibleDogs[0]?.updatedAt ?? visibleDogs[0]?.createdAt ?? Date.now();
    return new Date(ts).toLocaleDateString();
  }, [visibleDogs]);

  const locationTitle = circleName ?? (visibleDogs.length > 0 ? visibleDogs[0]?.location : t('Location not available'));

  return (
    <View className="flex-1 bg-white">
      {/* Location and Stats View */}
      <View className="p-4 bg-white mb-4">
        <Text className="text-2xl font-bold mb-2">{locationTitle}</Text>
        <Text className="text-sm text-gray-500 mb-4">
          {t('Please carefully release as per location given in the bio of each card')}
        </Text>
        <View className="mt-2">
          <Text className="text-xl font-bold text-black mb-2">{t('Information')}</Text>
          <View className="flex-row items-center">
            <View className="flex-row items-center mr-6">
              <MaterialIcons name="male" size={20} color="#1B85F3" className="mr-2" />
              <Text className="text-base text-gray-700">{maleCount} {t('Males')}</Text>
            </View>
            <View className="flex-row items-center mr-6">
              <MaterialIcons name="female" size={20} color="#1B85F3" className="mr-2" />
              <Text className="text-base text-gray-700">{femaleCount} {t('Females')}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="calendar" size={20} color="#1B85F3" className="mr-2" />
              <Text className="text-base text-gray-700">{lastUpdated}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dog List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-8">
          <Text>{t('Loading dogs...')}</Text>
        </View>
      ) : (
        <FlatList
          data={dogPairs}
          keyExtractor={(item, index) => `pair-${index}`}
          renderItem={renderDogPairs}
          extraData={userLocation}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* End Task Button */}
      <View className="absolute justify-center items-center flex-1 bottom-8 left-4 right-4">
        <TouchableOpacity
          className={`py-4 rounded-xl w-3/4 items-center justify-center ${allDogsReleased ? 'bg-blue-500' : 'bg-blue-300'
            }`}
          onPress={handleEndTask}
          disabled={!allDogsReleased}
        >
          <Text className={`text-base font-semibold ${allDogsReleased ? 'text-white' : 'text-white'
            }`}>
            {t('End Task')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}