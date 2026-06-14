import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';

export const EmailLoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation<any>();

  const handleSignIn = () => {
    Keyboard.dismiss();

    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation', 'Please enter your email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }

    // Actual sign in logic would go here
    Alert.alert('Info', 'Sign in logic not yet connected.');
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sign in with email</Text>
          </View>

          {/* Intro */}
          <View style={styles.intro}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Enter your email credentials to access your Smart Trike dashboard.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
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

            <View style={styles.forgotActionRow}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <Button 
              variant="primary" 
              onPress={handleSignIn}
              style={styles.submitBtn}
            >
              Sign in
            </Button>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmailRegister')}>
              <Text style={styles.footerLink}>Sign up</Text>
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
    backgroundColor: colors.surface,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 16,
  },
  intro: {
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
  form: {
    marginBottom: spacing.xl,
  },
  forgotActionRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  forgotText: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '600',
  },
  submitBtn: {
    height: 52,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xl,
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
