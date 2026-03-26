import type { FC } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Linking,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { router, useLocalSearchParams } from "expo-router";
import {
  Entypo,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

import { api } from "~/utils/api";
import { useTranslation } from "~/utils/LanguageContext";
const styles = StyleSheet.create({
  mapContainer: {
    height: 150,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  shadowContainer: {
    elevation: Platform.OS === "android" ? 32 : 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: Platform.OS === "ios" ? 0.4 : 0,
    shadowRadius: Platform.OS === "ios" ? 10 : 0,
    overflow: "visible",
  },
});

const DogProfile: FC = () => {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { id: dogId } = params;
  const { language, t } = useTranslation();

  // Helper function to get translated text
  const getTranslatedText = (key: string) => {
    if (language === "hi") {
      const translations: Record<string, string> = {
        "Loading dog details...": "डॉग डिटेल्स लोड हो रहे हैं...",
        "Dog not found": "डॉग नहीं मिला",
        "Date & Time of Capture": "कैप्चर की तारीख और समय",
        "Feeder": "फीडर",
        "Contact": "संपर्क",
        "GPS Location": "जीपीएस लोकेशन",
        "Go back": "वापस जाएं",
        "Female": "मादा",
        "Male": "नर"
      };
      return translations[key] || key;
    } else if (language === "te") {
      const translations: Record<string, string> = {
        "Loading dog details...": "డాగ్ వివరాలు లోడ్ అవుతున్నాయి...",
        "Dog not found": "డాగ్ కనుగొనబడలేదు",
        "Date & Time of Capture": "క్యాప్చర్ తేదీ మరియు సమయం",
        "Feeder": "ఫీడర్",
        "Contact": "సంప్రదింపు",
        "GPS Location": "జీపీఎస్ లొకేషన్",
        "Go back": "వెనుకకు వెళ్ళండి",
        "Female": "ఆడ",
        "Male": "మగ"
      };
      return translations[key] || key;
    } else {
      return key;
    }
  };

  // Helper function to transliterate feeder names
  const transliterateFeederName = (name: string) => {
    if (!name || language === "en") return name;
    
    if (language === "hi") {
      return name
        .replace(/Feeder/gi, "फीडर")
        .replace(/Mr\./gi, "श्री")
        .replace(/Mrs\./gi, "श्रीमती")
        .replace(/Ms\./gi, "सुश्री")
        .replace(/Dr\./gi, "डॉ.");
    } else if (language === "te") {
      return name
        .replace(/Feeder/gi, "ఫీడర్")
        .replace(/Mr\./gi, "శ్రీ")
        .replace(/Mrs\./gi, "శ్రీమతి")
        .replace(/Ms\./gi, "కుమారి")
        .replace(/Dr\./gi, "డాక్టర్");
    }
    
    return name;
  };

  // Helper function to transliterate date and time
  const transliterateDateTime = (dateString: string) => {
    if (language === "en") return dateString;
    
    let transliterated = dateString;
    
    if (language === "hi") {
      transliterated = dateString
        .replace(/January/gi, "जनवरी")
        .replace(/February/gi, "फरवरी")
        .replace(/March/gi, "मार्च")
        .replace(/April/gi, "अप्रैल")
        .replace(/May/gi, "मई")
        .replace(/June/gi, "जून")
        .replace(/July/gi, "जुलाई")
        .replace(/August/gi, "अगस्त")
        .replace(/September/gi, "सितंबर")
        .replace(/October/gi, "अक्टूबर")
        .replace(/November/gi, "नवंबर")
        .replace(/December/gi, "दिसंबर");
    } else if (language === "te") {
      transliterated = dateString
        .replace(/January/gi, "జనవరి")
        .replace(/February/gi, "ఫిబ్రవరి")
        .replace(/March/gi, "మార్చి")
        .replace(/April/gi, "ఏప్రిల్")
        .replace(/May/gi, "మే")
        .replace(/June/gi, "జూన్")
        .replace(/July/gi, "జులై")
        .replace(/August/gi, "ఆగస్ట్")
        .replace(/September/gi, "సెప్టెంబర్")
        .replace(/October/gi, "అక్టోబర్")
        .replace(/November/gi, "నవంబర్")
        .replace(/December/gi, "డిసెంబర్");
    }
    
    return transliterated;
  };

  // Helper function to transliterate GPS location address
  const transliterateAddress = (address: string) => {
    if (!address || language === "en") return address;
    
    let transliterated = address;
    
    if (language === "hi") {
      transliterated = address
        // Common location terms
        .replace(/Street/gi, "स्ट्रीट")
        .replace(/Road/gi, "रोड")
        .replace(/Lane/gi, "लेन")
        .replace(/Avenue/gi, "एवेन्यू")
        .replace(/Block/gi, "ब्लॉक")
        .replace(/Sector/gi, "सेक्टर")
        .replace(/Phase/gi, "फेज")
        .replace(/Colony/gi, "कॉलोनी")
        .replace(/Nagar/gi, "नगर")
        .replace(/Gali/gi, "गली")
        .replace(/Marg/gi, "मार्ग")
        .replace(/Cross/gi, "क्रॉस")
        .replace(/Junction/gi, "जंक्शन")
        .replace(/Circle/gi, "सर्कल")
        .replace(/Square/gi, "स्क्वायर")
        .replace(/Park/gi, "पार्क")
        .replace(/Garden/gi, "गार्डन")
        .replace(/Market/gi, "मार्केट")
        .replace(/Bazaar/gi, "बाजार")
        .replace(/Hospital/gi, "अस्पताल")
        .replace(/School/gi, "स्कूल")
        .replace(/College/gi, "कॉलेज")
        .replace(/University/gi, "विश्वविद्यालय")
        .replace(/Temple/gi, "मंदिर")
        .replace(/Mosque/gi, "मस्जिद")
        .replace(/Church/gi, "चर्च")
        .replace(/Metro/gi, "मेट्रो")
        .replace(/Station/gi, "स्टेशन")
        .replace(/Airport/gi, "एयरपोर्ट")
        .replace(/Bridge/gi, "पुल")
        .replace(/Mall/gi, "मॉल")
        .replace(/Complex/gi, "कॉम्प्लेक्स")
        .replace(/Building/gi, "बिल्डिंग")
        .replace(/Tower/gi, "टावर")
        .replace(/Apartment/gi, "अपार्टमेंट")
        .replace(/Flat/gi, "फ्लैट")
        .replace(/House/gi, "घर")
        .replace(/Villa/gi, "विला")
        .replace(/Office/gi, "ऑफिस")
        .replace(/Near/gi, "के पास")
        .replace(/Opposite/gi, "के सामने")
        .replace(/Behind/gi, "के पीछे")
        .replace(/Next to/gi, "के बगल में");
    } else if (language === "te") {
      transliterated = address
        // Common location terms
        .replace(/Street/gi, "స్ట్రీట్")
        .replace(/Road/gi, "రోడ్")
        .replace(/Lane/gi, "లేన్")
        .replace(/Avenue/gi, "అవెన్యూ")
        .replace(/Block/gi, "బ్లాక్")
        .replace(/Sector/gi, "సెక్టర్")
        .replace(/Phase/gi, "ఫేజ్")
        .replace(/Colony/gi, "కాలనీ")
        .replace(/Nagar/gi, "నగర్")
        .replace(/Gali/gi, "గలి")
        .replace(/Marg/gi, "మార్గ్")
        .replace(/Cross/gi, "క్రాస్")
        .replace(/Junction/gi, "జంక్షన్")
        .replace(/Circle/gi, "సర్కిల్")
        .replace(/Square/gi, "స్క్వేర్")
        .replace(/Park/gi, "పార్క్")
        .replace(/Garden/gi, "గార్డెన్")
        .replace(/Market/gi, "మార్కెట్")
        .replace(/Bazaar/gi, "బజార్")
        .replace(/Hospital/gi, "హాస్పిటల్")
        .replace(/School/gi, "స్కూల్")
        .replace(/College/gi, "కాలేజ్")
        .replace(/University/gi, "విశ్వవిద్యాలయం")
        .replace(/Temple/gi, "గుడి")
        .replace(/Mosque/gi, "మస్జిద్")
        .replace(/Church/gi, "చర్చి")
        .replace(/Metro/gi, "మెట్రో")
        .replace(/Station/gi, "స్టేషన్")
        .replace(/Airport/gi, "ఎయిర్‌పోర్ట్")
        .replace(/Bridge/gi, "వంతెన")
        .replace(/Mall/gi, "మాల్")
        .replace(/Complex/gi, "కాంప్లెక్స్")
        .replace(/Building/gi, "బిల్డింగ్")
        .replace(/Tower/gi, "టవర్")
        .replace(/Apartment/gi, "అపార్ట్‌మెంట్")
        .replace(/Flat/gi, "ఫ్లాట్")
        .replace(/House/gi, "ఇల్లు")
        .replace(/Villa/gi, "విల్లా")
        .replace(/Office/gi, "ఆఫీస్")
        .replace(/Near/gi, "దగ్గర")
        .replace(/Opposite/gi, "ఎదురుగా")
        .replace(/Behind/gi, "వెనుక")
        .replace(/Next to/gi, "పక్కన");
    }
    
    return transliterated;
  };

  // Fetch single dog details
  const { data: dogDetails, isLoading } = api.dogs.getDogById.useQuery(
    { dogId: dogId as string },
    { enabled: !!dogId },
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">{getTranslatedText("Loading dog details...")}</Text>
      </View>
    );
  }

  if (!dogDetails) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-red-500">{getTranslatedText("Dog not found")}</Text>
      </View>
    );
  }

  const isFemale = dogDetails.gender === "Female";
  const imageWidth = width * 0.9;
  const imageHeight = imageWidth;

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with Dog Image */}
        <View>
          <View className="items-center">
      <Image
              source={{ uri: dogDetails.dogImageUrl }}
              style={{ width: imageWidth, height: imageHeight }}
              className="rounded-2xl"
        resizeMode="cover"
      />
          </View>
          <View className="absolute flex-row items-center p-4">
            <TouchableOpacity
              className="left-4 rounded-full bg-[#00000033] p-2"
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
          {/* Dog Details Overlay */}
          <View className="relative bottom-32 left-6 p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Text className="mr-2 text-2xl font-bold text-white">
                  {(dogDetails as any).dog_tag_id ?? dogDetails.id.slice(0, 6)}
                </Text>
                <View
                  className={`rounded-full ${
                    isFemale ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"
                  } h-6 w-6 items-center justify-center`}
                >
                  <Entypo name="check" size={10} color="white" />
                </View>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
          <View
                className={`flex-row items-center justify-center rounded-full px-3 py-3 ${
                  isFemale ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"
                }`}
              >
                <Text className="px-2 text-sm font-medium text-white">
                  {getTranslatedText(dogDetails.gender)}
                </Text>
                <MaterialCommunityIcons
                  name="gender-female"
                  size={18}
              color="white"
            />
          </View>
              {(dogDetails as any).dogColor && (
                <View
                  className={`flex-row items-center justify-center rounded-full px-3 py-3 ${
                    isFemale ? "bg-[#FF2F9E]" : "bg-[#1B85F3]"
                  }`}
                >
                  <Text className="px-2 text-sm font-medium text-white">
                    {(dogDetails as any).dogColor}
            </Text>
                  <MaterialIcons name="color-lens" size={18} color="white" />
                </View>
          )}
        </View>
      </View>
        </View>

        {/* Details Section with Rounded Corners and Shadow */}
        <View
          className="mt-[-80px] gap-4 rounded-t-[40px] bg-white p-8"
          style={styles.shadowContainer}
        >
          {/* Capture Date */}
          <View className="mb-2 flex-row items-center gap-4">
            <Entypo
              name="calendar"
              size={18}
              color={isFemale ? "#FF2F9E" : "#1B85F3"}
              className={`rounded-lg p-3 ${
                isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"
              }`}
            />
            <View className="flex-col items-start justify-center">
              <Text className="text-sm text-gray-600">
                {getTranslatedText("Date & Time of Capture")}
              </Text>
              <Text className="text-lg font-semibold text-gray-800">
                {dogDetails.createdAt ? transliterateDateTime(new Date(dogDetails.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
                })) : "N/A"}
              </Text>
            </View>
          </View>

          {/* Feeder Name */}
          {(dogDetails as any).feederName && (
            <View className="mb-2 flex-row items-center gap-4">
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={isFemale ? "#FF2F9E" : "#1B85F3"}
                className={`rounded-lg p-3 ${
                  isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"
                }`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm text-gray-600">{getTranslatedText("Feeder")}</Text>
                <Text className="text-lg font-semibold text-gray-800">
                  {transliterateFeederName((dogDetails as any).feederName)}
                </Text>
              </View>
            </View>
          )}

          {/* Feeder Phone */}
          {(dogDetails as any).feederPhoneNumber && (
            <View className="mb-2 flex-row items-center gap-4">
              <MaterialIcons
                name="phone"
                size={18}
                color={isFemale ? "#FF2F9E" : "#1B85F3"}
                className={`rounded-lg p-3 ${
                  isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"
                }`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm text-gray-600">{getTranslatedText("Contact")}</Text>
                <Text className="text-lg font-semibold text-gray-800">
                  {(dogDetails as any).feederPhoneNumber}
                </Text>
              </View>
            </View>
          )}

          {/* Location */}
          {dogDetails.fullAddress && (
            <View className="mb-2 flex-row items-center gap-4">
              <MaterialIcons
                name="location-on"
                size={18}
                color={isFemale ? "#FF2F9E" : "#1B85F3"}
                className={`rounded-lg p-3 ${
                  isFemale ? "bg-[#FF2F9E30]" : "bg-[#D1E6FF80]"
                }`}
              />
              <View className="flex-col items-start justify-center">
                <Text className="text-sm text-gray-600">{getTranslatedText("GPS Location")}</Text>
                <Text className="text-lg font-semibold text-gray-800">
                  {transliterateAddress(dogDetails.fullAddress)}
                </Text>
              </View>
            </View>
          )}

          {/* Map View */}
          {dogDetails.coordinates && (
            <View style={styles.mapContainer}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
            latitude: (
                    dogDetails.coordinates as {
                      latitude: number;
                      longitude: number;
                    }
            ).latitude,
            longitude: (
                    dogDetails.coordinates as {
                      latitude: number;
                      longitude: number;
                    }
            ).longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: (
                      dogDetails.coordinates as {
                        latitude: number;
                        longitude: number;
                      }
                    ).latitude,
                    longitude: (
                      dogDetails.coordinates as {
                        latitude: number;
                        longitude: number;
                      }
                    ).longitude,
                  }}
                />
              </MapView>
              <View className="absolute bottom-4 left-1/2 mt-2 -translate-x-1/2 transform rounded-full border-4 border-[#FFFFFF] bg-purple-500 p-2">
                <MaterialCommunityIcons name="dog" size={24} color="white" />
              </View>
              <TouchableOpacity
                className="absolute right-2 top-2 rounded-2xl bg-[#2A3240] p-3"
                onPress={() => {
                  const { latitude, longitude } = dogDetails.coordinates as {
                    latitude: number;
                    longitude: number;
                  };
                  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                  void Linking.openURL(url);
                }}>
                <Ionicons name="expand-outline" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {/* Button */}
          <View className="mt-4">
        <TouchableOpacity
              className="rounded-lg border border-[#1B85F3] p-3"
          onPress={() => router.back()}
        >
              <Text className="text-center font-medium text-[#1B85F3]">
                {getTranslatedText("Go back")}
              </Text>
        </TouchableOpacity>
      </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default DogProfile;
