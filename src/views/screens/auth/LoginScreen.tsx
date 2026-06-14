import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { useAuth } from '@/controllers/hooks/useAuth';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, gradients, radius, shadows, spacing } from '@/views/styles/theme';

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const signInScale = useRef(new Animated.Value(1)).current;
  const passengerScale = useRef(new Animated.Value(1)).current;
  const driverScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const animateButton = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    animateButton(signInScale);

    if (!email.trim() || !password.trim()) {
      Alert.alert('Sign In', 'Enter your email and password to continue.');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      Alert.alert('Login Failed', 'Check your credentials and try again.');
    }
  };

  const handleDemoMode = (userType: 'passenger' | 'driver', scale: Animated.Value) => {
    animateButton(scale);
    const demoUser: any = {
      id: `demo-${userType}`,
      auth_id: 'demo-auth',
      user_type: userType,
      email: `demo@${userType}.com`,
      phone: '09123456789',
      name: `Demo ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
      profile_photo_url: null,
      created_at: new Date(),
      status: 'active',
      rating: 4.5,
      total_trips: 10,
    };
    dispatch(setDemoUserReducer(demoUser));
  };

  if (loading) return <Loading message="Signing you in..." />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.brandMark}>
            <TricycleIcon size={56} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>Smart Trike</Text>
          <Text style={styles.tagline}>Boac TODA booking for passengers and verified drivers.</Text>
        </LinearGradient>

        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.welcomeTitle}>Welcome back</Text>
              <Text style={styles.welcomeSubtitle}>Sign in to manage rides, requests, and trips.</Text>
            </View>

            <Text style={styles.label}>Email address</Text>
            <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
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
                autoComplete="email"
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color={passwordFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoComplete="password"
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
                style={styles.iconButton}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Animated.View style={{ transform: [{ scale: signInScale }] }}>
              <TouchableOpacity style={styles.signInBtn} onPress={handleLogin} activeOpacity={0.86}>
                <LinearGradient
                  colors={gradients.action}
                  style={styles.signInGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.signInText}>Sign In</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.secondaryActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('PhoneLogin')}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('EmailLogin')}>
                <MaterialCommunityIcons name="email-fast-outline" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => Alert.alert('Google Sign In', 'Google sign in is not configured yet.')}
              >
                <MaterialCommunityIcons name="google" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Google</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.demoCard}>
            <View>
              <Text style={styles.demoTitle}>Quick demo</Text>
              <Text style={styles.demoSubtitle}>Open the app with a sample role.</Text>
            </View>
            <View style={styles.demoButtons}>
              <Animated.View style={[styles.demoButtonWrap, { transform: [{ scale: passengerScale }] }]}>
                <TouchableOpacity
                  style={styles.demoButton}
                  onPress={() => handleDemoMode('passenger', passengerScale)}
                  activeOpacity={0.82}
                >
                  <MaterialCommunityIcons name="account-outline" size={22} color={colors.primary} />
                  <Text style={styles.demoButtonText}>Passenger</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={[styles.demoButtonWrap, { transform: [{ scale: driverScale }] }]}>
                <TouchableOpacity
                  style={styles.demoButton}
                  onPress={() => handleDemoMode('driver', driverScale)}
                  activeOpacity={0.82}
                >
                  <MaterialCommunityIcons name="car-hatchback" size={22} color={colors.primary} />
                  <Text style={styles.demoButtonText}>Driver</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.signUpContainer}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.7}
          >
            <Text style={styles.signUpText}>
              New to Smart Trike? <Text style={styles.signUpLink}>Create an account</Text>
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
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    minHeight: 268,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    justifyContent: 'flex-end',
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  tagline: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    marginTop: -28,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    ...shadows.lg,
  },
  cardHeader: {
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  welcomeSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: spacing.xs,
  },
  inputWrapper: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  signInBtn: {
    height: 54,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.lg,
    ...shadows.md,
  },
  signInGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  demoCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  demoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  demoSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  demoButtonWrap: {
    flex: 1,
  },
  demoButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  demoButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  signUpContainer: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  signUpText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  signUpLink: {
    color: colors.primary,
    fontWeight: '800',
  },
});
