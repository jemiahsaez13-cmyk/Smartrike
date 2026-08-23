import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/views/screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '@/views/screens/auth/ForgotPasswordScreen';
import { EmailRegisterScreen } from '@/views/screens/auth/EmailRegisterScreen';
import { EmailVerificationScreen } from '@/views/screens/auth/EmailVerificationScreen';
import { PasswordResetCodeScreen } from '@/views/screens/auth/PasswordResetCodeScreen';
import { NewPasswordScreen } from '@/views/screens/auth/NewPasswordScreen';
import { colors } from '@/views/styles/theme';

const Stack = createNativeStackNavigator();

export const AuthNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: colors.surface },
    }}
  >
    <Stack.Screen
      name="Login"
      component={LoginScreen}
      options={{ animation: 'fade' }}
    />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen
      name="EmailRegister"
      component={EmailRegisterScreen}
      options={{ animation: 'slide_from_bottom' }}
    />
    <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
    <Stack.Screen name="PasswordResetCode" component={PasswordResetCodeScreen} />
    <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
  </Stack.Navigator>
);
