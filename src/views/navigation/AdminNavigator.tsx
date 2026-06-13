import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminDashboard } from '@/views/screens/admin/AdminDashboard';
import { UserManagementScreen } from '@/views/screens/admin/UserManagementScreen';

const Stack = createNativeStackNavigator();

export const AdminNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ title: 'Admin' }} />
    <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'Users' }} />
  </Stack.Navigator>
);
