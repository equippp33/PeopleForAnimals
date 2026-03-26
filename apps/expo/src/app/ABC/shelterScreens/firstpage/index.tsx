import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import CalendarHeader from '../_components/CaldenderHeader';

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');

// Mock data - replace with your actual data source
const mockAssignments = [
  {
    id: 1,
    type: 'Capture - Shankarpalle',
    team: 'Team A',
    date: 'Feb 2nd, 2025',
    time: '(10:47 pm)',
    totalDogs: 88,
    status: 'Onboard'
  },
  {
    id: 2,
    type: 'Capture - Shankarpalle',
    team: 'Team A',
    date: 'Feb 2nd, 2025',
    time: '(10:47 pm)',
    totalDogs: 88,
    status: 'Onboard'
  },
  // Add more assignments as needed
];

const FirstPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssignments = mockAssignments.filter(assignment =>
    assignment.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assignment.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOnboard = () => {
    // Navigate to second page
    router.push('/ABC/shelterScreens/sencondpage');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Calendar Header */}
      <CalendarHeader
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

      {/* Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Search Bar */}
        <View className="flex-row items-center mb-4">
          <View className="mx-4 mt-3 flex-1 flex-row items-center bg-transparent rounded-3xl px-3 py-1 border border-gray-300">
            <TextInput
              className="flex-1 mx-2 text-sm text-black"
              placeholder="Search"
              placeholderTextColor="#A0AEC0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Ionicons name="search-outline" size={20} color="#00000089" />
          </View>
          <TouchableOpacity className="mt-2 mr-4">
            <Ionicons name="filter" size={24} color="#00000089" />
          </TouchableOpacity>
        </View>

        {/* Assignment Cards */}
        {filteredAssignments.map((assignment) => (
          <View
            key={assignment.id}
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              borderRadius: 15,
              padding: 16,
              backgroundColor: '#CFEEFF',
              minHeight: 220, // Use minHeight instead of fixed height
            }}
          >
            {/* Assignment Type */}
            <View className="bg-blue-200 rounded-lg px-3 py-1 self-start mb-4">
              <Text className="text-[#104D8D] font-medium text-sm">
                {assignment.type}
              </Text>
            </View>

            {/* Assignment Details */}
            <View className="flex-1">
              {/* Team */}
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[#104D8D] font-medium text-base">Team</Text>
                <Text className="text-[#104D8D] font-medium text-base">{assignment.team}</Text>
              </View>

              {/* Date */}
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[#104D8D] font-medium text-base">Date</Text>
                <Text className="text-[#104D8D] font-medium text-base">{assignment.date}</Text>
              </View>

              {/* Time */}
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[#104D8D] font-medium text-base">Time</Text>
                <Text className="text-[#104D8D] font-medium text-base">{assignment.time}</Text>
              </View>

              {/* Total Dogs */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[#104D8D] font-medium text-base">Total Dogs</Text>
                <Text className="text-[#104D8D] font-medium text-base">{assignment.totalDogs}</Text>
              </View>

              {/* Onboard Button */}
              <View className="flex-row justify-end">
                <TouchableOpacity
                  onPress={() => handleOnboard()}
                  style={{
                    backgroundColor: '#007AFF',
                    borderRadius: 15,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
            
                  <Text className="text-white font-semibold text-sm">Onboard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {/* Empty State */}
        {filteredAssignments.length === 0 && (
          <View className="flex-1 justify-center items-center py-20">
            <Ionicons name="document-text-outline" size={80} color="#D1D5DB" />
            <Text className="text-gray-500 text-lg mt-4">No assignments found</Text>
            <Text className="text-gray-400 text-center mt-2 px-8">
              {searchQuery ? 'Try adjusting your search terms' : 'Check back later for new assignments'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FirstPage;