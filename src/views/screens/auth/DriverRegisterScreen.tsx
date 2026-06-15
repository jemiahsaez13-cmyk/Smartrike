import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert, SafeAreaView, Animated,
} from 'react-native';
import { Text, TextInput, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { useAuth } from '@/controllers/hooks/useAuth';

export const DriverRegisterScreen = () => {
  const navigation = useNavigation<any>();
  const { register } = useAuth();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
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
    if (!formData.name) newErrors.name = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.license_number) newErrors.license_number = 'License number is required';
    if (!formData.plate_number) newErrors.plate_number = 'Plate number is required';
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(formData.email, formData.password, {
        name: formData.name,
        phone: formData.phone,
        user_type: 'driver',
        license_number: formData.license_number,
        toda_membership: formData.toda_membership,
        vehicle_details: {
          plate_number: formData.plate_number,
          make: formData.vehicle_make,
          model: formData.vehicle_model,
        },
      });
      // Redux isAuthenticated becomes true → RootNavigator auto-redirects to app
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
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
              <Input
                label="Full name"
                placeholder="Juan Dela Cruz"
                {...field('name')}
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
