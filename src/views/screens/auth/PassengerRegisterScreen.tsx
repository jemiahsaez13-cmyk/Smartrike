import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, SafeAreaView, Animated, Keyboard,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { useAuth } from '@/controllers/hooks/useAuth';
import { notify } from '@/utils/confirm';

export const PassengerRegisterScreen = () => {
  const navigation = useNavigation<any>();
  const { register } = useAuth();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (formData.phone.trim().length < 10) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const fullName = [formData.firstName, formData.middleName, formData.lastName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
      const result: any = await register(formData.email.trim(), formData.password, {
        name: fullName,
        phone: formData.phone.trim(),
        user_type: 'passenger',
      });
      // If the project requires email confirmation, no session is returned yet.
      if (result?.needsEmailConfirmation) {
        setLoading(false);
        notify(
          'Confirm your email',
          'We sent a confirmation link to your email. Tap it, then sign in to continue.'
        );
        navigation.navigate('Login');
        return;
      }
      // Otherwise navigation happens automatically via Redux state change in AppNavigator
    } catch (error: any) {
      const msg = typeof error === 'string' ? error : error?.message || 'Registration failed. Please try again.';
      notify('Registration error', msg);
      setLoading(false);
    }
  };

  const field = (key: keyof typeof formData) => ({
    value: formData[key],
    onChangeText: (text: string) => setFormData({ ...formData, [key]: text }),
    errorText: errors[key],
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerSection}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="account-group-outline" size={28} color={colors.accent} />
              </View>
              <Text style={styles.title}>Passenger Sign Up</Text>
              <Text style={styles.subtitle}>
                Create your account to start booking rides.
              </Text>
            </View>

            <View style={styles.nameRow}>
              <Input
                label="First name"
                placeholder="Juan"
                containerStyle={styles.nameField}
                autoCapitalize="words"
                {...field('firstName')}
                left={<TextInput.Icon icon="account-outline" color={colors.textMuted} />}
              />
              <Input
                label="Last name"
                placeholder="Dela Cruz"
                containerStyle={styles.nameField}
                autoCapitalize="words"
                {...field('lastName')}
              />
            </View>

            <Input
              label="Middle name (optional)"
              placeholder="Reyes"
              autoCapitalize="words"
              {...field('middleName')}
              left={<TextInput.Icon icon="account-outline" color={colors.textMuted} />}
            />

            <Input
              label="Email address"
              placeholder="juan@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              {...field('email')}
              left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
            />

            <Input
              label="Phone number"
              placeholder="0912 345 6789"
              keyboardType="phone-pad"
              {...field('phone')}
              left={<TextInput.Icon icon="phone-outline" color={colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              {...field('password')}
              left={<TextInput.Icon icon="lock-outline" color={colors.textMuted} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowPassword(!showPassword)}
                  color={colors.textSecondary}
                />
              }
            />

            <Input
              label="Confirm password"
              placeholder="••••••••"
              secureTextEntry={!showConfirmPassword}
              {...field('confirmPassword')}
              left={<TextInput.Icon icon="lock-check-outline" color={colors.textMuted} />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  color={colors.textSecondary}
                />
              }
            />

            <Button
              variant="primary"
              onPress={handleRegister}
              loading={loading}
              style={styles.cta}
            >
              Create Passenger Account
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerSection: {
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameField: {
    flex: 1,
    width: undefined,
  },
  cta: {
    height: 54,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
  },
  footerLink: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
});
