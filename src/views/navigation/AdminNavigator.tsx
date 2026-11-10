import { ReportsAndViolationsScreen } from '@/views/screens/admin/ReportsAndViolationsScreen';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminDashboard } from '@/views/screens/admin/AdminDashboard';
import { UserManagementScreen } from '@/views/screens/admin/UserManagementScreen';
import { FareSettingsScreen } from '@/views/screens/admin/FareSettingsScreen';
import { PlaceManagementScreen } from '@/views/screens/admin/PlaceManagementScreen';
import { ActivityLogsScreen } from '@/views/screens/admin/ActivityLogsScreen';
import { SystemHealthScreen } from '@/views/screens/admin/SystemHealthScreen';
import { FranchiseManagementScreen } from '@/views/screens/admin/FranchiseManagementScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';
import { EditProfileScreen } from '@/views/screens/shared/EditProfileScreen';
import { HelpSupportScreen } from '@/views/screens/shared/HelpSupportScreen';
import { AboutScreen } from '@/views/screens/shared/AboutScreen';
import { LegalScreen } from '@/views/screens/shared/LegalScreen';
import { ChangePasswordScreen } from '@/views/screens/shared/ChangePasswordScreen';
import { NotificationsScreen } from '@/views/screens/shared/NotificationsScreen';
import { SettingsScreen } from '@/views/screens/shared/SettingsScreen';
import { AnalyticsScreen } from '@/views/screens/admin/AnalyticsScreen';
import { AdminMessagesScreen } from '@/views/screens/admin/AdminMessagesScreen';
import { DriverProfileScreen } from '@/views/screens/passenger/DriverProfileScreen';
import { FranchiseRegistryScreen } from '@/views/screens/admin/FranchiseRegistryScreen';
import { ManagementReportsScreen } from '@/views/screens/admin/ManagementReportsScreen';
import { RidePaymentManagementScreen } from '@/views/screens/admin/RidePaymentManagementScreen';
import { MtopBillingScreen } from '@/views/screens/admin/MtopBillingScreen';
import { RevenueDetailsScreen } from '@/views/screens/admin/RevenueDetailsScreen';
import { AdminMtopPaymentSettingsScreen } from '@/views/screens/admin/AdminMtopPaymentSettingsScreen';
import { AdminAnnouncementScreen } from '@/views/screens/admin/AdminAnnouncementScreen';
import { BookingMonitoringScreen } from '@/views/screens/admin/BookingMonitoringScreen';
import { TodaAssignmentScreen } from '@/views/screens/admin/TodaAssignmentScreen';
import { TodaManagementScreen } from '@/views/screens/admin/TodaManagementScreen';
import { uberTabScreenOptions, tabIcon, tabIconWithBadge } from '@/views/navigation/tabBarOptions';
import { useAppSelector } from '@/controllers/store';
import { useAdminPendingCounts } from '@/controllers/hooks/useAdminPendingCounts';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AdminTabs = () => {
  // Live red badges (migration 083): unread admin notifications on Home, MTOP
  // work waiting on the admin on the MTOP tab.
  const user = useAppSelector((state) => state.auth.user);
  const unread = useAppSelector((state) =>
    state.notification.userId === user?.id ? state.notification.unreadCount : 0
  );
  const pending = useAdminPendingCounts();
  return (
  <Tab.Navigator screenOptions={uberTabScreenOptions}>
    <Tab.Screen
      name="Dashboard"
      component={AdminDashboard}
      options={{
        tabBarLabel: 'Home',
        tabBarIcon: tabIconWithBadge('view-dashboard', 'view-dashboard-outline', unread),
      }}
    />
    <Tab.Screen
      name="MTOP"
      component={FranchiseManagementScreen}
      options={{
        tabBarLabel: 'MTOP',
        tabBarIcon: tabIconWithBadge('card-account-details', 'card-account-details-outline', pending.mtop),
      }}
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
      options={{ tabBarLabel: 'Account', tabBarIcon: tabIconWithBadge('account', 'account-outline', unread) }}
    />
  </Tab.Navigator>
  );
};

export const AdminNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminMain" component={AdminTabs} />
    <Stack.Screen name="UserManagement" component={UserManagementScreen} />
    <Stack.Screen name="FareSettings" component={FareSettingsScreen} />
    <Stack.Screen name="PlaceManagement" component={PlaceManagementScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    <Stack.Screen name="About" component={AboutScreen} />
    <Stack.Screen name="Legal" component={LegalScreen} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <Stack.Screen name="Analytics" component={AnalyticsScreen} />
    <Stack.Screen name="Reports" component={ReportsAndViolationsScreen} />
    <Stack.Screen name="AdminMessages" component={AdminMessagesScreen} />
    <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
    <Stack.Screen name="FranchiseRegistry" component={FranchiseRegistryScreen} />
    <Stack.Screen name="ManagementReports" component={ManagementReportsScreen} />
    <Stack.Screen name="RidePaymentManagement" component={RidePaymentManagementScreen} />
    <Stack.Screen name="MtopBilling" component={MtopBillingScreen} />
    <Stack.Screen name="RevenueDetails" component={RevenueDetailsScreen} />
    <Stack.Screen name="AdminMtopPaymentSettings" component={AdminMtopPaymentSettingsScreen} />
    <Stack.Screen name="ViolationManagement" component={ReportsAndViolationsScreen} />
    <Stack.Screen name="Announcements" component={AdminAnnouncementScreen} />
    <Stack.Screen name="BookingMonitoring" component={BookingMonitoringScreen} />
    <Stack.Screen name="TodaAssignment" component={TodaAssignmentScreen} />
    <Stack.Screen name="TodaManagement" component={TodaManagementScreen} />
  </Stack.Navigator>
);
