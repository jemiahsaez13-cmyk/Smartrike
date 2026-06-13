import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverDashboard } from '@/views/screens/driver/DriverDashboard';
import { BookingRequestScreen } from '@/views/screens/driver/BookingRequestScreen';

const Stack = createNativeStackNavigator();

export const DriverNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="DriverDashboard" component={DriverDashboard} options={{ title: 'Home' }} />
    <Stack.Screen name="BookingRequests" component={BookingRequestScreen} options={{ title: 'Requests' }} />
  </Stack.Navigator>
);
