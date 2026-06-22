import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Keyboard, ScrollView, SafeAreaView, Animated,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { useAuth } from '@/controllers/hooks/useAuth';
import { notify } from '@/utils/confirm';
import { Loading } from '@/views/components/common/Loading';

export const EmailRegisterScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'passenger' | 'driver'>('passenger');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigation = useNavigation<any>();
  const { register, loading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleCreateAccount = async () => {
    Keyboard.dismiss();

    const cleanName = [firstName, middleName, lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');
    const cleanEmail = email.trim();

    if (!firstName.trim() || !lastName.trim() || !cleanEmail || !password) {
      notify('Missing details', 'Please fill in your first name, last name, email, and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      notify('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      notify('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      notify('Passwords do not match', 'Please re-type the same password in both fields.');
      return;
    }

    if (!agreedToTerms) {
      notify('Almost there', 'Please agree to the terms and conditions to continue.');
      return;
    }

    try {
      const result: any = await register(cleanEmail, password, {
        name: cleanName,
        user_type: userType,
      });
      if (result?.needsEmailConfirmation) {
        notify(
          'Confirm your email',
          'We sent a confirmation link to your email. Tap it, then sign in to continue.'
        );
        navigation.navigate('EmailLogin');
        return;
      }
      // Success: AppNavigator auto-routes into the app when isAuthenticated flips.
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Registration failed.';
      notify('Registration error', msg);
    }
  };

  if (loading) return <Loading message="Creating your account..." />;

  const roleOptions: { key: 'passenger' | 'driver'; label: string; icon: string }[] = [
    { key: 'passenger', label: 'Passenger', icon: 'account' },
    { key: 'driver', label: 'Driver', icon: 'rickshaw' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerSection}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Join Smart Trike and start your journey today.
              </Text>
            </View>

            <View style={styles.nameRow}>
              <Input
                label="First name"
                placeholder="Juana"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                containerStyle={styles.nameField}
                left={<TextInput.Icon icon="account-outline" color={colors.textMuted} />}
              />
              <Input
                label="Last name"
                placeholder="Dela Cruz"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                containerStyle={styles.nameField}
              />
            </View>

            <Input
              label="Middle name (optional)"
              placeholder="Reyes"
              value={middleName}
              onChangeText={setMiddleName}
              autoCapitalize="words"
              left={<TextInput.Icon icon="account-outline" color={colors.textMuted} />}
            />

            <Input
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
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
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              left={<TextInput.Icon icon="lock-check-outline" color={colors.textMuted} />}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  color={colors.textSecondary}
                />
              }
            />

            <Text style={styles.sectionLabel}>ACCOUNT TYPE</Text>
            <View style={styles.typeSelector}>
              {roleOptions.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.typeOption, userType === key && styles.typeOptionSelected]}
                  onPress={() => setUserType(key)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={22}
                    color={userType === key ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.typeText, userType === key && styles.typeTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && (
                  <MaterialCommunityIcons name="check" size={13} color="#fff" />
                )}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>

            <Button variant="primary" onPress={handleCreateAccount} style={styles.cta}>
              Create account
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
                <Text style={styles.footerLink}>Sign In</Text>
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
    flexGrow: 1,
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
  sectionLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  typeOptionSelected: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  typeText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  typeTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  termsLink: {
    color: colors.accent,
    fontWeight: '700',
  },
  cta: {
    height: 54,
    marginBottom: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
