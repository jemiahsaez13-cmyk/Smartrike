import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '@/models/services/AuthService';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { isValidEmail, normalizeEmail } from '@/utils/validationUtils';

const authService = new AuthService();

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleReset = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError('');
    setLoading(true);
    try {
      await authService.resetPassword(normalizedEmail);
      navigation.navigate('PasswordResetCode', { email: normalizedEmail });
    } catch (error: any) {
      setEmailError(error?.message || 'The verification email could not be sent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

              <>
                <View style={styles.headerSection}>
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="lock-reset" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.title}>Reset password</Text>
                  <Text style={styles.subtitle}>
                    Enter your registered email and we'll send a 6-digit verification code.
                  </Text>
                </View>

                <Input
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  errorText={emailError}
                  onChangeText={(value) => { setEmail(value); setEmailError(''); }}
                  left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
                />

                <Button
                  variant="primary"
                  onPress={handleReset}
                  disabled={!email.trim() || loading}
                  loading={loading}
                  style={styles.cta}
                >
                  Send verification code
                </Button>

                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  style={styles.footer}
                >
                  <Text style={styles.footerText}>
                    Remembered it?{'  '}
                    <Text style={styles.footerLink}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </>
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
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primaryLight,
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
    lineHeight: 22,
  },
  cta: {
    height: 54,
    marginTop: spacing.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
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
