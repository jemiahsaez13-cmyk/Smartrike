import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Alert, SafeAreaView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';

export const EmailRegisterScreen = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'passenger' | 'driver'>('passenger');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigation = useNavigation<any>();

  const handleCreateAccount = () => {
    Keyboard.dismiss();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Validation', 'Please agree to the terms and conditions.');
      return;
    }

    Alert.alert('Success', 'Account created!', [
      { text: 'OK', onPress: () => navigation.navigate('EmailLogin') }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <TricycleIcon size={48} color={colors.primary} />
            <Text style={styles.title}>Join Smart Trike</Text>
            <Text style={styles.subtitle}>Create an account to start your journey</Text>
          </View>

          <View style={styles.content}>
            <Input
              label="Full name"
              placeholder="Juana Dela Cruz"
              value={fullName}
              onChangeText={setFullName}
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
                  icon={showPassword ? "eye-off-outline" : "eye-outline"} 
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
                  icon={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  color={colors.textSecondary}
                />
              }
            />

            <Text style={styles.sectionLabel}>ACCOUNT TYPE</Text>
            <View style={styles.typeSelector}>
              {(['passenger', 'driver'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, userType === type && styles.typeOptionSelected]}
                  onPress={() => setUserType(type)}
                >
                  <MaterialCommunityIcons 
                    name={type === 'passenger' ? 'account' : 'rickshaw'} 
                    size={24} 
                    color={userType === type ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.typeText, userType === type && styles.typeTextSelected]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
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
                {agreedToTerms && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>

            <Button 
              variant="primary" 
              onPress={handleCreateAccount}
              style={styles.submitBtn}
            >
              Create Account
            </Button>

            <TouchableOpacity 
              style={styles.footer}
              onPress={() => navigation.navigate('EmailLogin')}
            >
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.footerLink}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginLeft: -4,
  },
  header: {
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
  content: {
    flex: 1
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
    borderWidth: 1,
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
  },
  termsLink: {
    color: colors.accent,
    fontWeight: '700',
  },
  submitBtn: {
    height: 52,
    marginBottom: spacing.xl,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.accent,
    fontWeight: '700',
  },
});
