import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '@/models/services/AuthService';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography, radius } from '@/views/styles/theme';

const authService = new AuthService();

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const successScale = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
    } catch {}
    finally {
      setLoading(false);
      setSent(true);
      Animated.parallel([
        Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(successScale, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  };

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

            {sent ? (
              <Animated.View
                style={[
                  styles.successSection,
                  { opacity: successOpacity, transform: [{ scale: successScale }] },
                ]}
              >
                <View style={styles.successIconCircle}>
                  <MaterialCommunityIcons name="email-check-outline" size={36} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Check your inbox</Text>
                <Text style={styles.successText}>
                  Reset instructions have been sent to{'\n'}
                  <Text style={styles.successEmail}>{email}</Text>
                </Text>
                <Button
                  variant="primary"
                  onPress={() => navigation.navigate('Login')}
                  style={styles.cta}
                >
                  Return to Sign In
                </Button>
                <Text style={styles.spamNote}>
                  Didn't receive it? Check your spam folder.
                </Text>
              </Animated.View>
            ) : (
              <>
                <View style={styles.headerSection}>
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name="lock-reset" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.title}>Reset password</Text>
                  <Text style={styles.subtitle}>
                    Enter your email and we'll send you reset instructions.
                  </Text>
                </View>

                <Input
                  label="Email address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
                />

                <Button
                  variant="primary"
                  onPress={handleReset}
                  disabled={!email.trim() || loading}
                  loading={loading}
                  style={styles.cta}
                >
                  Send reset link
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
            )}
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
  successSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  successEmail: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
  },
  spamNote: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
