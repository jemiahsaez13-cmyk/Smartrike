import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/views/screens/auth/LoginScreen';
import { RegisterScreen } from '@/views/screens/auth/RegisterScreen';
import { PassengerRegisterScreen } from '@/views/screens/auth/PassengerRegisterScreen';
import { DriverRegisterScreen } from '@/views/screens/auth/DriverRegisterScreen';
import { PhoneLoginScreen } from '@/views/screens/auth/PhoneLoginScreen';
import { OTPVerificationScreen } from '@/views/screens/auth/OTPVerificationScreen';
import { ForgotPasswordScreen } from '@/views/screens/auth/ForgotPasswordScreen';
import { EmailLoginScreen } from '@/views/screens/auth/EmailLoginScreen';
import { EmailRegisterScreen } from '@/views/screens/auth/EmailRegisterScreen';

const Stack = createNativeStackNavigator();

export const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="PassengerRegister" component={PassengerRegisterScreen} />
    <Stack.Screen name="DriverRegister" component={DriverRegisterScreen} />
    <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
    <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
    <Stack.Screen name="EmailRegister" component={EmailRegisterScreen} />
  </Stack.Navigator>
);

