import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/controllers/hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { PassengerNavigator } from './PassengerNavigator';
import { DriverNavigator } from './DriverNavigator';
import { AdminNavigator } from './AdminNavigator';
import { SplashScreen } from '@/views/screens/auth/SplashScreen';
import { ProfileSetupScreen } from '@/views/screens/auth/ProfileSetupScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { isAuthenticated, user, loading, checkAuth } = useAuth();
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

  if (loading || initializing || (isAuthenticated && !user)) {
    return <SplashScreen />;
  }

  // New accounts (including Google sign-in) must finish profile setup before
  // entering the app. Admins and demo sessions are exempt.
  const needsOnboarding =
    !!user &&
    user.user_type !== 'admin' &&
    !user.profile_completed &&
    !user.id?.startsWith('demo-');

  return (
    <NavigationContainer>
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
