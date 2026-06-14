import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput as RNTextInput, Animated, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors } from '@/views/styles/theme';

export const EmailRegisterScreen = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'passenger' | 'driver'>('passenger');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCreateAccount = () => {
    Keyboard.dismiss();
    animateButton();

    if (!fullName.trim()) {
      Alert.alert('Validation', 'Please enter your full name');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Validation', 'Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }

    if (!password.trim() || password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match');
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Validation', 'Please agree to the terms and conditions');
      return;
    }

    Alert.alert('Success', 'Account created!', [
      {
        text: 'OK',
        onPress: () => {
          navigation.navigate('EmailLogin');
        }
      }
    ]);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient 
        colors={[colors.primaryDark, colors.primary, colors.secondary]} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Smart Trike</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <View style={[
              styles.inputContainer,
              nameFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="account-outline" 
                size={20} 
                color={nameFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="John Doe"
                value={fullName}
                onChangeText={setFullName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Email Address</Text>
            <View style={[
              styles.inputContainer,
              emailFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="email-outline" 
                size={20} 
                color={emailFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <View style={[
              styles.inputContainer,
              passwordFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="lock-outline" 
                size={20} 
                color={passwordFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={colors.textLight}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
            <View style={[
              styles.inputContainer,
              confirmPasswordFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="lock-check-outline" 
                size={20} 
                color={confirmPasswordFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
                secureTextEntry={!showConfirmPassword}
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name={showConfirmPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={colors.textLight}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>Account Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, userType === 'passenger' && styles.typeOptionSelected]}
                onPress={() => setUserType('passenger')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="account" 
                  size={28} 
                  color={userType === 'passenger' ? colors.primary : colors.textLight}
                />
                <Text style={[styles.typeText, userType === 'passenger' && styles.typeTextSelected]}>
                  Passenger
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeOption, userType === 'driver' && styles.typeOptionSelected]}
                onPress={() => setUserType('driver')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="car" 
                  size={28} 
                  color={userType === 'driver' ? colors.primary : colors.textLight}
                />
                <Text style={[styles.typeText, userType === 'driver' && styles.typeTextSelected]}>
                  Driver
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && (
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                )}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity 
                style={styles.createBtn}
                onPress={handleCreateAccount}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={[colors.primary, colors.primaryDark]} 
                  style={styles.createBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.createBtnText}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <TouchableOpacity 
            style={styles.signInContainer}
            onPress={() => navigation.navigate('EmailLogin')}
            activeOpacity={0.7}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  headerContent: {
    flex: 1
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40
  },
  content: {
    flex: 1
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  inputFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  inputIcon: {
    marginRight: 12
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500'
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border
  },
  typeOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textLight,
    marginTop: 8
  },
  typeTextSelected: {
    color: colors.primary
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  termsText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500'
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700'
  },
  createBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  createBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  createBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3
  },
  signInContainer: {
    alignItems: 'center'
  },
  signInText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  signInLink: {
    color: colors.primary,
    fontWeight: '700'
  }
});
