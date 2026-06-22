import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DriverDashboard } from '@/views/screens/driver/DriverDashboard';
import { BookingRequestScreen } from '@/views/screens/driver/BookingRequestScreen';
import { DriverTripScreen } from '@/views/screens/driver/DriverTripScreen';
import { EarningsScreen } from '@/views/screens/driver/EarningsScreen';
import { FranchiseScreen } from '@/views/screens/driver/FranchiseScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { EditProfileScreen } from '@/views/screens/shared/EditProfileScreen';
import { HelpSupportScreen } from '@/views/screens/shared/HelpSupportScreen';
import { AboutScreen } from '@/views/screens/shared/AboutScreen';
import { LegalScreen } from '@/views/screens/shared/LegalScreen';
import { ChangePasswordScreen } from '@/views/screens/shared/ChangePasswordScreen';
import { ChatScreen } from '@/views/screens/shared/ChatScreen';
import { TripHistoryScreen } from '@/views/screens/passenger/TripHistoryScreen';
import { NotificationsScreen } from '@/views/screens/shared/NotificationsScreen';
import { SettingsScreen } from '@/views/screens/shared/SettingsScreen';
import { uberTabScreenOptions, tabIcon } from '@/views/navigation/tabBarOptions';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DriverTabs = () => (
  <Tab.Navigator screenOptions={uberTabScreenOptions}>
    <Tab.Screen
      name="Dashboard"
      component={DriverDashboard}
      options={{ tabBarLabel: 'Home', tabBarIcon: tabIcon('view-dashboard', 'view-dashboard-outline') }}
    />
    <Tab.Screen
      name="Trips"
      component={TripHistoryScreen}
      options={{ tabBarLabel: 'Trips', tabBarIcon: tabIcon('clipboard-list', 'clipboard-list-outline') }}
    />
    <Tab.Screen
      name="Franchise"
      component={FranchiseScreen}
      options={{ tabBarLabel: 'MTOP', tabBarIcon: tabIcon('card-account-details', 'card-account-details-outline') }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: 'Account', tabBarIcon: tabIcon('account', 'account-outline') }}
    />
  </Tab.Navigator>
);

export const DriverNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverDashboard" component={DriverTabs} />
    <Stack.Screen name="BookingRequests" component={BookingRequestScreen} />
    <Stack.Screen name="DriverTrip" component={DriverTripScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="Earnings" component={EarningsScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    <Stack.Screen name="About" component={AboutScreen} />
    <Stack.Screen name="Legal" component={LegalScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
  </Stack.Navigator>
);
