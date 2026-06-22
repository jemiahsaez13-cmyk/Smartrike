import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, SafeAreaView, Animated, Keyboard,
} from 'react-native';
import { Text, TextInput, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { useAuth } from '@/controllers/hooks/useAuth';
import { notify } from '@/utils/confirm';

export const DriverRegisterScreen = () => {
  const navigation = useNavigation<any>();
  const { register } = useAuth();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    license_number: '',
    plate_number: '',
    vehicle_make: '',
    vehicle_model: '',
    toda_membership: '',
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
      newErrors.email = 'Valid email is required';
    }

    if (!formData.license_number.trim()) newErrors.license_number = 'License number is required';
    if (!formData.plate_number.trim()) newErrors.plate_number = 'Plate number is required';
    
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
    if (!validate()) {
      notify('Check your details', 'Please complete the highlighted fields.');
      return;
    }

    setLoading(true);
    try {
      const fullName = [formData.firstName, formData.middleName, formData.lastName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ');
      const result: any = await register(formData.email.trim(), formData.password, {
        name: fullName,
        phone: formData.phone.trim(),
        user_type: 'driver',
        license_number: formData.license_number.trim(),
        toda_membership: formData.toda_membership.trim(),
        vehicle_details: {
          plate_number: formData.plate_number.trim().toUpperCase(),
          make: formData.vehicle_make.trim(),
          model: formData.vehicle_model.trim(),
        },
      });
      if (result?.needsEmailConfirmation) {
        setLoading(false);
        notify(
          'Confirm your email',
          'Your driver application was submitted. We sent a confirmation link to your email — tap it, then sign in to continue.'
        );
        navigation.navigate('Login');
        return;
      }
    } catch (error: any) {
      const msg = typeof error === 'string' ? error : error?.message || 'Application submission failed.';
      notify('Registration failed', msg);
      setLoading(false);
    }
  };

  const field = (key: keyof typeof formData) => ({
    value: formData[key],
    onChangeText: (text: string) => setFormData({ ...formData, [key]: text }),
    errorText: errors[key],
  });

  const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBox}>
        <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

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
                <MaterialCommunityIcons name="moped" size={28} color={colors.secondary} />
              </View>
              <Text style={styles.title}>Driver Sign Up</Text>
              <Text style={styles.subtitle}>
                Join our driver network and start earning today.
              </Text>
            </View>

            {/* Personal Info */}
            <View style={styles.formCard}>
              <SectionHeader title="Personal Information" icon="account-details" />
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
                placeholder="09xx xxx xxxx"
                keyboardType="phone-pad"
                {...field('phone')}
                left={<TextInput.Icon icon="phone-outline" color={colors.textMuted} />}
              />
            </View>

            {/* License & Membership */}
            <View style={styles.formCard}>
              <SectionHeader title="License & Membership" icon="card-account-details-outline" />
              <Input
                label="License number"
                placeholder="D01-XX-XXXXXX"
                autoCapitalize="characters"
                {...field('license_number')}
                left={<TextInput.Icon icon="card-account-details" color={colors.textMuted} />}
              />
              <Input
                label="TODA Membership ID"
                placeholder="TODA-12345"
                {...field('toda_membership')}
                left={<TextInput.Icon icon="badge-account-horizontal" color={colors.textMuted} />}
              />
            </View>

            {/* Vehicle */}
            <View style={styles.formCard}>
              <SectionHeader title="Vehicle Details" icon="tricycle" />
              <Input
                label="Plate number"
                placeholder="123 ABC"
                autoCapitalize="characters"
                {...field('plate_number')}
                left={<TextInput.Icon icon="numeric" color={colors.textMuted} />}
              />
              <View style={styles.row}>
                <Input
                  label="Make"
                  placeholder="Kawasaki"
                  containerStyle={{ flex: 1, marginRight: 8 }}
                  {...field('vehicle_make')}
                />
                <Input
                  label="Model"
                  placeholder="Barako"
                  containerStyle={{ flex: 1 }}
                  {...field('vehicle_model')}
                />
              </View>
            </View>

            {/* Security */}
            <View style={styles.formCard}>
              <SectionHeader title="Security" icon="shield-lock-outline" />
              <Input
                label="Password"
                placeholder="••••••••"
                secureTextEntry
                {...field('password')}
                left={<TextInput.Icon icon="lock-outline" color={colors.textMuted} />}
              />
              <Input
                label="Confirm password"
                placeholder="••••••••"
                secureTextEntry
                {...field('confirmPassword')}
                left={<TextInput.Icon icon="lock-check-outline" color={colors.textMuted} />}
              />
            </View>

            <Button
              variant="primary"
              onPress={handleRegister}
              loading={loading}
              style={styles.cta}
            >
              Submit Application
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
    backgroundColor: colors.background,
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
    backgroundColor: colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameField: {
    flex: 1,
    width: undefined,
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
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    fontSize: 15,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
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
