import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminDashboard } from '@/views/screens/admin/AdminDashboard';
import { UserManagementScreen } from '@/views/screens/admin/UserManagementScreen';
import { ActivityLogsScreen } from '@/views/screens/admin/ActivityLogsScreen';
import { SystemHealthScreen } from '@/views/screens/admin/SystemHealthScreen';
import { FranchiseManagementScreen } from '@/views/screens/admin/FranchiseManagementScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { EditProfileScreen } from '@/views/screens/shared/EditProfileScreen';
import { HelpSupportScreen } from '@/views/screens/shared/HelpSupportScreen';
import { AboutScreen } from '@/views/screens/shared/AboutScreen';
import { LegalScreen } from '@/views/screens/shared/LegalScreen';
import { NotificationsScreen } from '@/views/screens/shared/NotificationsScreen';
import { SettingsScreen } from '@/views/screens/shared/SettingsScreen';
import { AnalyticsScreen } from '@/views/screens/admin/AnalyticsScreen';
import { uberTabScreenOptions, tabIcon } from '@/views/navigation/tabBarOptions';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AdminTabs = () => (
  <Tab.Navigator screenOptions={uberTabScreenOptions}>
    <Tab.Screen
      name="Dashboard"
      component={AdminDashboard}
      options={{ tabBarLabel: 'Home', tabBarIcon: tabIcon('view-dashboard', 'view-dashboard-outline') }}
    />
    <Tab.Screen
      name="MTOP"
      component={FranchiseManagementScreen}
      options={{ tabBarLabel: 'MTOP', tabBarIcon: tabIcon('card-account-details', 'card-account-details-outline') }}
    />
    <Tab.Screen
      name="Logs"
      component={ActivityLogsScreen}
      options={{ tabBarLabel: 'Logs', tabBarIcon: tabIcon('text-box', 'text-box-outline') }}
    />
    <Tab.Screen
      name="System"
      component={SystemHealthScreen}
      options={{ tabBarLabel: 'System', tabBarIcon: tabIcon('server') }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: 'Account', tabBarIcon: tabIcon('account', 'account-outline') }}
    />
  </Tab.Navigator>
);

export const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminMain" component={AdminTabs} />
    <Stack.Screen name="UserManagement" component={UserManagementScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    <Stack.Screen name="About" component={AboutScreen} />
    <Stack.Screen name="Legal" component={LegalScreen} />
    <Stack.Screen name="Analytics" component={AnalyticsScreen} />
  </Stack.Navigator>
);
