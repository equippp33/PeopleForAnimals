import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, startOfWeek } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { Entypo} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const customIcon = require('../../../../assets/images/menu_icon.webp');

// CalendarHeader.tsx
const CalendarHeader = ({
  selectedDate,
  setSelectedDate,
  showPlusIcon = true,
}: {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  showPlusIcon?: boolean;
}) => {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 14 }, (_, i) => addDays(startDate, i));

  const handleDayPress = (date: Date) => setSelectedDate(date);

  const handleMonthChange = (event: any, date?: Date) => {
    setShowMonthPicker(false);
    if (date) setSelectedDate(date);
  };

  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top }} className="pt-5 bg-[#F8F8F8] gap-4 px-4">
      {/* Header Section */}
      <View className="flex-row justify-between items-center mb-4 pt-2">

        <TouchableOpacity className="p-2">
          {/* <Ionicons name="menu-outline" size={26} color="#1B85F3" /> */}
          <Image
            source={customIcon}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Dashboard Text */}
        <Text className="text-lg font-medium absolute left-0 right-0 text-center">
          Dashboard
        </Text>

      
          <TouchableOpacity className="p-2">
            <Entypo name="dots-three-horizontal" size={24} color="#1B85F3" />
          </TouchableOpacity>
        
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        {days.map((day, index) => {
          const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDayPress(day)}
              className={twMerge(
                'items-center justify-center gap-1 rounded-xl px-3 py-2 mr-2 border border-[#ECEFF2]',
                isSelected ? 'bg-blue-100 text-[#1B85F3] border-[#D1E6FF]' : ''
              )}
            >
              <Text className={twMerge(isSelected ? 'text-[#1B85F3] font-bold text-lg' : 'text-[#606873] font-bold')}>
                {format(day, 'dd')}
              </Text>
              <Text className={twMerge(isSelected ? 'text-[#1B85F3] font-bold' : 'text-[#A0AEC0]')}>
                {format(day, 'EEE')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showMonthPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={handleMonthChange}
        />
      )}
    </View>
  );
};

export default CalendarHeader;