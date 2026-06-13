import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PassengerDashboard } from '@/views/screens/passenger/PassengerDashboard';
import { BookRideScreen } from '@/views/screens/passenger/BookRideScreen';
import { ConfirmBookingScreen } from '@/views/screens/passenger/ConfirmBookingScreen';
import { ActiveTripScreen } from '@/views/screens/passenger/ActiveTripScreen';
import { TripHistoryScreen } from '@/views/screens/passenger/TripHistoryScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { colors } from '@/views/styles/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const PassengerTabs = () => (
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
      name="Home" 
      component={PassengerDashboard} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" size={size + 4} color={color} />
      }}
    />
    <Tab.Screen 
      name="History" 
      component={TripHistoryScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="history" size={size + 4} color={color} />
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

export const PassengerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PassengerDashboard" component={PassengerTabs} />
    <Stack.Screen name="BookRide" component={BookRideScreen} />
    <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} />
    <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} />
  </Stack.Navigator>
);
