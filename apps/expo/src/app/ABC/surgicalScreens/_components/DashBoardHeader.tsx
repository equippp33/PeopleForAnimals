import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Entypo } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

const customIcon = require('../../../../../assets/images/menu_icon.webp');

const DashboardHeader: React.FC<{ onMenuPress: () => void }> = ({ onMenuPress }) => {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const routeTitles: Record<string, string> = {
    '/surgicalScreens': 'Dashboard',
    '/ABC/surgicalScreens/batchrelease': 'Batch Release',
    '/ABC/surgicalScreens/dogprofile': 'Dog Profile',
    '/ABC/surgicalScreens/profile': 'Batch Wise - Dog List',
  };

  const title = routeTitles[pathname] || 'Dashboard';

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="flex-row justify-between items-center mb-2 mt-3 pt-2 px-4 bg-[#FFF]"
    >
      {/* Menu Icon */}
      <TouchableOpacity onPress={onMenuPress}>
        <Image
          source={customIcon}
          style={{ width: 34, height: 34 }}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Title */}
      <Text className="flex-1 text-lg font-medium text-black text-center">
        {title}
      </Text>

      {/* More Icon */}
      <TouchableOpacity className="p-2 px-3">
        <Entypo name="dots-three-horizontal" size={24} color="#1B85F3" />
      </TouchableOpacity>
    </View>
  );
};

export default DashboardHeader;