import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useAppDispatch } from '@/controllers/store';
import { sessionEnded } from '@/controllers/slices/authSlice';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { AuthNavigator } from './AuthNavigator';
import { PassengerNavigator } from './PassengerNavigator';
import { DriverNavigator } from './DriverNavigator';
import { AdminNavigator } from './AdminNavigator';
import { SplashScreen } from '@/views/screens/auth/SplashScreen';
import { ProfileSetupScreen } from '@/views/screens/auth/ProfileSetupScreen';
import { NotificationListener } from '@/views/components/common/NotificationListener';
import { colors, spacing, typography } from '@/views/styles/theme';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { isAuthenticated, user, checkAuth } = useAuth();
  const dispatch = useAppDispatch();
  const [initializing, setInitializing] = React.useState(true);

  React.useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();
      } catch (e) {
        console.log('No active session');
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, [checkAuth]);

  // When Supabase drops the session on its own (refresh token expired or
  // revoked), return to the login screen instead of leaving a signed-in shell
  // whose every request fails.
  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_OUT' && !session) dispatch(sessionEnded());
    });
    return () => data?.subscription?.unsubscribe();
  }, [dispatch]);

  // A release build without Supabase keys would silently run on in-memory demo
  // data, so sign-ups and rides would vanish on restart. Fail loudly instead.
  if (!isSupabaseConfigured && !__DEV__) {
    return (
      <View style={styles.configError}>
        <Text style={styles.configTitle}>App not configured</Text>
        <Text style={styles.configBody}>
          This build is missing its server settings (EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY). Add them to the EAS environment and rebuild.
        </Text>
      </View>
    );
  }

  // Only the initial session check shows the splash. Sign-in, sign-up and
  // profile saves show their own loading state; swapping the whole tree for the
  // splash here used to unmount the navigator, wiping forms and resetting
  // navigation (e.g. a failed sign-up dumped the user back on Login).
  if (initializing || (isAuthenticated && !user)) {
    return <SplashScreen />;
  }

  // New PASSENGER accounts (including Google sign-in) must finish profile
  // setup before entering the app. Drivers already submit their full details
  // on the driver application form, and admins/demo sessions are exempt.
  const needsOnboarding =
    !!user &&
    user.user_type === 'passenger' &&
    !user.profile_completed &&
    !user.id?.startsWith('demo-');

  return (
    <NavigationContainer>
      {isAuthenticated && <NotificationListener />}
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : needsOnboarding ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user?.user_type === 'passenger' && <Stack.Screen name="Passenger" component={PassengerNavigator} />}
          {user?.user_type === 'driver' && <Stack.Screen name="Driver" component={DriverNavigator} />}
          {user?.user_type === 'admin' && <Stack.Screen name="Admin" component={AdminNavigator} />}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  configError: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  configTitle: {
    ...typography.h1,
    fontSize: 22,
    marginBottom: spacing.md,
  },
  configBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
