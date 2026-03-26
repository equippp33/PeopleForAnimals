import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, startOfWeek } from 'date-fns';
import { twMerge } from 'tailwind-merge';
// import DashboardHeader from './DashboardHeader';

interface CalendarHeaderProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  showPlusIcon?: boolean;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  selectedDate,
  setSelectedDate,
}) => {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  // Fixed 15-day window anchored to *today*: [today-7 … today … today+7]
  const scrollRef = useRef<ScrollView>(null);
  const today = new Date();
  const start = addDays(today, -7);
  const days = Array.from({ length: 15 }, (_, i) => addDays(start, i));

  const handleDayPress = (date: Date) => setSelectedDate(date);

  const handleMonthChange = (event: any, date?: Date) => {
    setShowMonthPicker(false);
    if (date) setSelectedDate(date);
  };

  // Scroll so that today is visible on mount
  useEffect(() => {
    // Delay to allow rendering
    setTimeout(() => {
      // Rough width per item (px-3 + margins) ~70; adjust if design changes
      const itemWidth = 45;
      scrollRef.current?.scrollTo({ x: itemWidth * 8, animated: false });
    }, 0);
  }, []);

  return (
    <View className="bg-[#FFF] gap-4 px-4 py-2 pb-2">

      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        {days.map((day, index) => {
          const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDayPress(day)}
              className={twMerge(
                'items-center justify-center gap-1 rounded-xl px-3 py-2 mr-2 border bg-white border-[#dadfe3]',
                isSelected ? 'bg-blue-100 text-[#1B85F3] border-[#D1E6FF]' : ''
              )}
            >
              <Text className={twMerge(isSelected ? 'text-[#1B85F3] font-medium text-lg' : 'text-[#606873] font-medium')}>
                {format(day, 'dd')}
              </Text>
              <Text className={twMerge(isSelected ? 'text-[#1B85F3] font-medium' : 'text-[#A0AEC0] font-medium')}>
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