import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DriverDashboard } from '@/views/screens/driver/DriverDashboard';
import { BookingRequestScreen } from '@/views/screens/driver/BookingRequestScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { TripHistoryScreen } from '@/views/screens/passenger/TripHistoryScreen'; // Reusing for now
import { colors } from '@/views/styles/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DriverTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textLight,
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        elevation: 10,
        height: 65,
        paddingBottom: 10,
        paddingTop: 8,
        backgroundColor: colors.surface,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '600',
      }
    }}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={DriverDashboard} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="car-hatchback" size={size + 4} color={color} />
      }}
    />
    <Tab.Screen 
      name="Trips" 
      component={TripHistoryScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="format-list-bulleted" size={size + 4} color={color} />
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" size={size + 4} color={color} />
      }}
    />
  </Tab.Navigator>
);

export const DriverNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverDashboard" component={DriverTabs} />
    <Stack.Screen name="BookingRequests" component={BookingRequestScreen} />
  </Stack.Navigator>
);
