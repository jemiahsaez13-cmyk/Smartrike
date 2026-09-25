import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Keyboard, ScrollView, Animated,
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
import {
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  PASSWORD_REQUIREMENTS,
  isValidDriverPlateNumber,
  isValidDriverLicenseNumber,
  normalizePlateNumber,
  normalizeDriverLicenseNumber,
  PLATE_NUMBER_FORMAT,
  LICENSE_NUMBER_FORMAT,
} from '@/utils/validationUtils';

type Field =
  | 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword'
  | 'licenseNumber' | 'plateNumber';

export const EmailRegisterScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'passenger' | 'driver'>('passenger');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  // Wraps a setter so editing a field clears its inline error.
  const edit = (field: Field, setter: (v: string) => void) => (v: string) => {
    setter(v);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };
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
    const cleanEmail = normalizeEmail(email);

    // Checked top to bottom so the popup names the first field to fix; the same
    // message is shown under that field until the user edits it.
    const checks: [Field, boolean, string, string][] = [
      ['firstName', !firstName.trim(), 'First name required', 'Please enter your first name.'],
      ['lastName', !lastName.trim(), 'Last name required', 'Please enter your last name.'],
      ['email', !cleanEmail, 'Email required', 'Please enter your email address.'],
      ['email', !!cleanEmail && !isValidEmail(cleanEmail), 'Invalid email', `"${cleanEmail}" is not a valid email address. Example: juana@gmail.com`],
      ['password', !password, 'Password required', 'Please enter a password.'],
      ['password', !!password && !isValidPassword(password).valid, 'Weak password', `Your password is missing: ${isValidPassword(password).errors.join(', ').toLowerCase()}. ${PASSWORD_REQUIREMENTS}`],
      ['confirmPassword', password !== confirmPassword, 'Passwords do not match', 'Please re-type the same password in both fields.'],
    ];
    if (userType === 'driver') {
      checks.push(
        ['licenseNumber', !licenseNumber.trim(), 'License number required', 'Enter your driver\'s license number.'],
        ['licenseNumber', !!licenseNumber.trim() && !isValidDriverLicenseNumber(licenseNumber), 'Invalid license number', `"${licenseNumber.trim()}" is not a valid license number. ${LICENSE_NUMBER_FORMAT}`],
        ['plateNumber', !plateNumber.trim(), 'Plate number required', 'Enter your vehicle plate number.'],
        ['plateNumber', !!plateNumber.trim() && !isValidDriverPlateNumber(plateNumber), 'Invalid plate number', `"${plateNumber.trim()}" is not a valid plate number. ${PLATE_NUMBER_FORMAT}`],
      );
    }
    const failed = checks.find(([, bad]) => bad);
    if (failed) {
      const [field, , title, message] = failed;
      setErrors({ [field]: message });
      notify(title, message);
      return;
    }
    setErrors({});

    if (!agreedToTerms) {
      notify('Almost there', 'Please agree to the terms and conditions to continue.');
      return;
    }

    try {
      const result: any = await register(cleanEmail, password, {
        name: cleanName,
        user_type: userType,
        ...(userType === 'driver'
          ? {
              license_number: normalizeDriverLicenseNumber(licenseNumber),
              vehicle_details: {
                plate_number: normalizePlateNumber(plateNumber),
                make: vehicleMake.trim(),
                model: vehicleModel.trim(),
              },
            }
          : {}),
      });
      if (result?.needsEmailConfirmation) {
        navigation.navigate('EmailVerification', { email: cleanEmail });
        return;
      }
      await notify('Account created', 'Your account is ready. Welcome to Smart Trike.');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Registration failed.';
      notify('Sign up failed', msg);
    }
  };

  if (loading) return <Loading message="Creating your account..." />;

  const roleOptions: { key: 'passenger' | 'driver'; label: string; icon: string }[] = [
    { key: 'passenger', label: 'Passenger', icon: 'account' },
    { key: 'driver', label: 'Driver', icon: 'rickshaw' },
  ];

  return (
    <View style={styles.container}>
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
                onChangeText={edit('firstName', setFirstName)}
              errorText={errors.firstName}
                autoCapitalize="words"
                containerStyle={styles.nameField}
                left={<TextInput.Icon icon="account-outline" color={colors.textMuted} />}
              />
              <Input
                label="Last name"
                placeholder="Dela Cruz"
                value={lastName}
                onChangeText={edit('lastName', setLastName)}
              errorText={errors.lastName}
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
              onChangeText={edit('email', setEmail)}
              errorText={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={edit('password', setPassword)}
              errorText={errors.password}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              left={<TextInput.Icon icon="lock-outline" color={colors.textMuted} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowPassword(!showPassword)}
                  color={colors.textSecondary}
                />
              }
            />

            <Text style={styles.passwordHint}>{PASSWORD_REQUIREMENTS}</Text>

            <Input
              label="Confirm password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={edit('confirmPassword', setConfirmPassword)}
              errorText={errors.confirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoComplete="new-password"
              textContentType="newPassword"
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

            {userType === 'driver' && (
              <View style={styles.driverDetails}>
                <Text style={styles.sectionLabel}>DRIVER DETAILS</Text>
                <Input
                  label="License number"
                  placeholder="A01-23-456789"
                  value={licenseNumber}
                  onChangeText={edit('licenseNumber', setLicenseNumber)}
              errorText={errors.licenseNumber}
                  autoCapitalize="characters"
                  left={<TextInput.Icon icon="card-account-details-outline" color={colors.textMuted} />}
                />
                <Input
                  label="Vehicle plate number"
                  placeholder="123 ABC or AB 1234"
                  value={plateNumber}
                  onChangeText={edit('plateNumber', setPlateNumber)}
              errorText={errors.plateNumber}
                  autoCapitalize="characters"
                  left={<TextInput.Icon icon="tricycle" color={colors.textMuted} />}
                />
                <View style={styles.nameRow}>
                  <Input
                    label="Vehicle make (optional)"
                    placeholder="Kawasaki"
                    value={vehicleMake}
                    onChangeText={setVehicleMake}
                    containerStyle={styles.nameField}
                  />
                  <Input
                    label="Model (optional)"
                    placeholder="Barako"
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                    containerStyle={styles.nameField}
                  />
                </View>
                {/* TODA membership is assigned by the administrator from the
                    registered TODA list (the app matches members by TODA name),
                    so it is not typed in at sign-up. */}
                <Text style={styles.passwordHint}>
                  Your TODA will be assigned by the FEDTODAB administrator when your account is approved.
                </Text>
              </View>
            )}

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
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  passwordHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  driverDetails: {
    marginBottom: spacing.sm,
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
