import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text, TextInput } from 'react-native-paper';
import { AuthService } from '@/models/services/AuthService';
import { Button } from '@/views/components/common/Button';
import { Input } from '@/views/components/common/Input';
import { colors, radius, spacing, typography } from '@/views/styles/theme';
import { notify } from '@/utils/confirm';

const authService = new AuthService();
const RESEND_SECONDS = 60;

export const EmailVerificationScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = String(route.params?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleVerify = async () => {
    if (!code) {
      setError('Enter the verification code from your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.verifySignupCode(email, code);
      await notify('Email verified', 'Your account registration is complete. You can now sign in.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (verificationError: any) {
      setError(verificationError?.message || 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      await authService.resendSignupCode(email);
      setCode('');
      setResendIn(RESEND_SECONDS);
      await notify('Code sent', 'A new verification code has been sent. The previous code is no longer valid.');
    } catch (resendError: any) {
      setError(resendError?.message || 'A new verification code could not be sent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="email-check-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{`\n`}
            <Text style={styles.email}>{email}</Text>
          </Text>

          <Input
            label="Verification code"
            placeholder="000000"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            errorText={error}
            left={<TextInput.Icon icon="shield-key-outline" color={colors.textMuted} />}
          />

          <Text style={styles.helper}>The code expires in 10 minutes and can only be used once.</Text>

          <Button
            variant="primary"
            onPress={handleVerify}
            loading={loading}
            disabled={code.length !== 6 || loading}
            style={styles.cta}
          >
            Verify email
          </Button>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendIn > 0 || loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: resendIn > 0 || loading }}
          >
            <Text style={[styles.resendText, resendIn > 0 && styles.disabledText]}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, fontSize: 28, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 23, marginBottom: spacing.xl },
  email: { ...typography.label, color: colors.text, fontWeight: '700' },
  helper: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 19, marginTop: -spacing.xs },
  cta: { height: 54, marginTop: spacing.xl },
  resendButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  resendText: { ...typography.labelSmall, color: colors.accent, fontWeight: '700' },
  disabledText: { color: colors.textMuted },
});
