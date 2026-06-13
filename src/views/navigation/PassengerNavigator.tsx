import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PassengerDashboard } from '@/views/screens/passenger/PassengerDashboard';
import { BookRideScreen } from '@/views/screens/passenger/BookRideScreen';
import { ConfirmBookingScreen } from '@/views/screens/passenger/ConfirmBookingScreen';
import { ActiveTripScreen } from '@/views/screens/passenger/ActiveTripScreen';
import { TripHistoryScreen } from '@/views/screens/passenger/TripHistoryScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';

const Stack = createNativeStackNavigator();

export const PassengerNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="PassengerDashboard" component={PassengerDashboard} options={{ title: 'Home' }} />
    <Stack.Screen name="BookRide" component={BookRideScreen} options={{ title: 'Book a Ride' }} />
    <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} options={{ title: 'Confirm' }} />
    <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ title: 'Your Trip' }} />
    <Stack.Screen name="TripHistory" component={TripHistoryScreen} options={{ title: 'History' }} />
    <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
  </Stack.Navigator>
);
