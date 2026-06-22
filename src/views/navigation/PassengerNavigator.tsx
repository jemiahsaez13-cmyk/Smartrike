import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PassengerDashboard } from '@/views/screens/passenger/PassengerDashboard';
import { BookRideScreen } from '@/views/screens/passenger/BookRideScreen';
import { ConfirmBookingScreen } from '@/views/screens/passenger/ConfirmBookingScreen';
import { ActiveTripScreen } from '@/views/screens/passenger/ActiveTripScreen';
import { TripHistoryScreen } from '@/views/screens/passenger/TripHistoryScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { NotificationsScreen } from '@/views/screens/shared/NotificationsScreen';
import { SettingsScreen } from '@/views/screens/shared/SettingsScreen';
import { PaymentScreen } from '@/views/screens/shared/PaymentScreen';
import { DriverProfileScreen } from '@/views/screens/passenger/DriverProfileScreen';
import { EMoneyWalletScreen } from '@/views/screens/driver/EMoneyWalletScreen';
import { uberTabScreenOptions, tabIcon } from '@/views/navigation/tabBarOptions';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const PassengerTabs = () => (
  <Tab.Navigator screenOptions={uberTabScreenOptions}>
    <Tab.Screen
      name="Home"
      component={PassengerDashboard}
      options={{ tabBarLabel: 'Home', tabBarIcon: tabIcon('home-variant', 'home-variant-outline') }}
    />
    <Tab.Screen
      name="History"
      component={TripHistoryScreen}
      options={{ tabBarLabel: 'Activity', tabBarIcon: tabIcon('clock-time-four', 'clock-time-four-outline') }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: 'Account', tabBarIcon: tabIcon('account', 'account-outline') }}
    />
  </Tab.Navigator>
);

export const PassengerNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PassengerDashboard" component={PassengerTabs} />
    <Stack.Screen name="BookRide" component={BookRideScreen} />
    <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} />
    <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} />
    <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
    <Stack.Screen name="EMoneyWallet" component={EMoneyWalletScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="Payment" component={PaymentScreen} />
  </Stack.Navigator>
);
