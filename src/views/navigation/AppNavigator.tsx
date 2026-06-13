import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/controllers/hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { PassengerNavigator } from './PassengerNavigator';
import { DriverNavigator } from './DriverNavigator';
import { AdminNavigator } from './AdminNavigator';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthNavigator />
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
