import React, { useState, useRef, useMemo } from 'react';

import type {
  LayoutChangeEvent
} from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, startOfWeek } from 'date-fns';
import { twMerge } from 'tailwind-merge';

interface CalendarHeaderProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  showPlusIcon?: boolean;
  // Dates that have at least one release task assigned (formatted as "yyyy-MM-dd")
  assignedReleaseDates?: string[];
  // Dates with release tasks older than a month that are still not completed
  overdueReleaseDates?: string[];
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  selectedDate,
  setSelectedDate,
  assignedReleaseDates,
  overdueReleaseDates,
}) => {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  // Fixed 15-day window anchored to *today*: [today-7 … today … today+7]
  const scrollRef = useRef<ScrollView>(null);
  const hasAutoScrolledRef = useRef(false);
  const { today, days } = useMemo(() => {
    const t = new Date();
    const start = addDays(t, -7);
    const windowDays = Array.from({ length: 15 }, (_, i) => addDays(start, i));
    return { today: t, days: windowDays };
  }, []);

  const handleTodayLayout = (event: LayoutChangeEvent) => {
    if (hasAutoScrolledRef.current || !scrollRef.current) return;
    const { x } = event.nativeEvent.layout;
    scrollRef.current.scrollTo({ x, y: 0, animated: false });
    hasAutoScrolledRef.current = true;
  };

  const initialScrollX = useMemo(() => {
    // Rough width per item (px-3 + margins) ~45; adjust if design changes
    const itemWidth = 45;
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayIndex = days.findIndex(
      (d) => format(d, 'yyyy-MM-dd') === todayKey,
    );
    const index = todayIndex >= 0 ? todayIndex : 0;
    return itemWidth * index;
  }, [today, days]);

  const assignedSet = useMemo(
    () => new Set((assignedReleaseDates ?? []).map((d) => d)),
    [assignedReleaseDates],
  );
  const overdueSet = useMemo(
    () => new Set((overdueReleaseDates ?? []).map((d) => d)),
    [overdueReleaseDates],
  );

  const handleDayPress = (date: Date) => setSelectedDate(date);

  const handleMonthChange = (event: any, date?: Date) => {
    setShowMonthPicker(false);
    if (date) setSelectedDate(date);
  };

  return (
    <View className="bg-[#FFF] gap-4 px-4 py-2 pb-2">

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
        contentOffset={{ x: initialScrollX, y: 0 }}
      >
        {days.map((day, index) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const isSelected = dayKey === format(selectedDate, 'yyyy-MM-dd');
          const isToday = dayKey === format(today, 'yyyy-MM-dd');
          const isOverdue = overdueSet.has(dayKey);
          const isAssigned = assignedSet.has(dayKey) && !isOverdue;

          const containerBase = 'items-center justify-center gap-1 rounded-xl px-3 py-2 mr-2 border bg-white border-[#dadfe3]';
          let stateClasses = '';
          if (isSelected) {
            stateClasses = ' bg-blue-100 border-[#D1E6FF]';
          } else if (isOverdue) {
            stateClasses = ' bg-red-100 border-red-300';
          } else if (isAssigned) {
            stateClasses = ' bg-red-50 border-red-200';
          }

          const dayTextClasses = isSelected
            ? 'text-[#1B85F3] font-medium text-lg'
            : isOverdue
              ? 'text-red-600 font-medium'
              : isAssigned
                ? 'text-red-500 font-medium'
                : 'text-[#606873] font-medium';

          const weekdayTextClasses = isSelected
            ? 'text-[#1B85F3] font-medium'
            : isOverdue
              ? 'text-red-600 font-medium'
              : isAssigned
                ? 'text-red-500 font-medium'
                : 'text-[#A0AEC0] font-medium';
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDayPress(day)}
              onLayout={isToday ? handleTodayLayout : undefined}
              className={twMerge(
                containerBase,
                stateClasses,
              )}
              activeOpacity={1}
            >
              <Text className={twMerge(dayTextClasses)}>
                {format(day, 'dd')}
              </Text>
              <Text className={twMerge(weekdayTextClasses)}>
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