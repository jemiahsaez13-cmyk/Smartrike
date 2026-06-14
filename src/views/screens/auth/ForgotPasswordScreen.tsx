import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '@/models/services/AuthService';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography, radius } from '@/views/styles/theme';

const authService = new AuthService();

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
    } catch {
      // Prototype mode fallback
    } finally {
      setLoading(false);
      setSent(true);
    }
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
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>Enter your email to receive instructions</Text>
          </View>

          <View style={styles.content}>
            {sent ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <MaterialCommunityIcons name="email-check-outline" size={48} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successText}>
                  Instructions have been sent to {email}. Please check your inbox and spam folder.
                </Text>
                <Button 
                  variant="primary" 
                  onPress={() => navigation.navigate('Login')}
                  style={styles.actionBtn}
                >
                  Return to Sign In
                </Button>
              </View>
            ) : (
              <>
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
                  style={styles.actionBtn}
                >
                  Send Reset Link
                </Button>

                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backLink}>
                  <Text style={styles.backText}>
                    Remembered it? <Text style={styles.backHighlight}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subtitle: { 
    ...typography.body,
    color: colors.textSecondary,
  },
  content: { 
    flex: 1,
  },
  actionBtn: {
    marginTop: spacing.md,
    height: 52,
  },
  backLink: { 
    marginTop: spacing.xl, 
    alignItems: 'center' 
  },
  backText: { 
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  backHighlight: { 
    color: colors.accent, 
    fontWeight: '700' 
  },
  successBox: { 
    alignItems: 'center', 
    paddingTop: spacing.lg 
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: { 
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  successText: { 
    ...typography.body,
    textAlign: 'center', 
    lineHeight: 22, 
    marginBottom: spacing.xl,
  },
});
