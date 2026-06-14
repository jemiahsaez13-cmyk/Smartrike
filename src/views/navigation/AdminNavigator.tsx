import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminDashboard } from '@/views/screens/admin/AdminDashboard';
import { UserManagementScreen } from '@/views/screens/admin/UserManagementScreen';
import { ActivityLogsScreen } from '@/views/screens/admin/ActivityLogsScreen';
import { SystemHealthScreen } from '@/views/screens/admin/SystemHealthScreen';
import { FranchiseManagementScreen } from '@/views/screens/admin/FranchiseManagementScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { colors, layout, radius, shadows, typography } from '@/views/styles/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textLight,
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        height: layout.tabBarHeight,
        paddingBottom: 14,
        paddingTop: 8,
        backgroundColor: colors.surface,
        ...shadows.lg,
      },
      tabBarItemStyle: {
        minHeight: 56,
        borderRadius: radius.md,
        marginHorizontal: 4,
      },
      tabBarLabelStyle: {
        ...typography.label,
        fontSize: 11,
        letterSpacing: 0,
      }
    }}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={AdminDashboard} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard-outline" size={size + 4} color={color} />
      }}
    />
    <Tab.Screen
      name="MTOP"
      component={FranchiseManagementScreen}
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="card-account-details-outline" size={size + 4} color={color} />
      }}
    />
    <Tab.Screen
      name="Logs"
      component={ActivityLogsScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="text-box-outline" size={size + 4} color={color} />
      }}
    />
    <Tab.Screen 
      name="System" 
      component={SystemHealthScreen} 
      options={{
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="server" size={size + 4} color={color} />
      }}
    />
  </Tab.Navigator>
);

export const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminMain" component={AdminTabs} />
    <Stack.Screen name="UserManagement" component={UserManagementScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
  </Stack.Navigator>
);
