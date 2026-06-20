import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput as PaperTextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { AuthService } from '@/models/services/AuthService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import { isSupabaseConfigured } from '@/config/supabase';
import { notify } from '@/utils/confirm';
import { Input } from '@/views/components/common/Input';
import { colors, layout, radius, shadows, spacing, typography } from '@/views/styles/theme';

const authService = new AuthService();

export const ChangePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const isDemo = !isSupabaseConfigured || !!(user?.id && user.id.startsWith('demo-'));

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const sendCode = async () => {
    if (newPassword.length < 6) {
      notify('Weak password', 'Your new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('Passwords do not match', 'Please re-type the same password in both fields.');
      return;
    }
    if (isDemo) {
      notify('Demo mode', 'Password changes are disabled for demo accounts.');
      return;
    }
    setSending(true);
    try {
      await authService.sendPasswordChangeCode();
      setStep('verify');
      notify('Code sent', `We emailed a verification code to ${user?.email}.`);
    } catch (e: any) {
      notify('Could not send code', e?.message || 'Please try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const updatePassword = async () => {
    if (code.trim().length < 6) {
      notify('Enter the code', 'Type the verification code we sent to your email.');
      return;
    }
    setUpdating(true);
    try {
      await authService.changePassword(newPassword, code);
      void ActivityLogService.logActivity({
        user_id: user?.id,
        action_type: 'user_action',
        entity_type: 'user',
        entity_id: user?.id,
        description: `${user?.name} changed their password.`,
        severity: 'info',
      });
      notify('Password updated', 'Your password has been changed successfully.');
      navigation.goBack();
    } catch (e: any) {
      notify('Update failed', e?.message || 'The code may be incorrect or expired. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name={step === 'form' ? 'lock-outline' : 'email-check-outline'} size={26} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>{step === 'form' ? 'Set a new password' : 'Verify it’s you'}</Text>
            <Text style={styles.heroSub}>
              {step === 'form'
                ? 'For your security, we’ll email a verification code before saving your new password.'
                : `Enter the code we sent to ${user?.email}.`}
            </Text>
          </View>

          {step === 'form' ? (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <Input
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                secureTextEntry={!showPw}
                autoCapitalize="none"
                right={
                  <PaperTextInput.Icon
                    icon={showPw ? 'eye-off' : 'eye'}
                    onPress={() => setShowPw((v) => !v)}
                    forceTextInputFocus={false}
                  />
                }
              />

              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-type your new password"
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, sending && { opacity: 0.6 }]}
                onPress={sendCode}
                disabled={sending}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="email-fast-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>{sending ? 'Sending Code…' : 'Send Verification Code'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Verification Code</Text>
              <Input
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="Enter the code from your email"
                keyboardType="number-pad"
                maxLength={8}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, updating && { opacity: 0.6 }]}
                onPress={updatePassword}
                disabled={updating}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="lock-check-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>{updating ? 'Updating…' : 'Update Password'}</Text>
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <TouchableOpacity onPress={() => setStep('form')} disabled={sending || updating}>
                  <Text style={styles.linkText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={sendCode} disabled={sending || updating}>
                  <Text style={styles.linkText}>{sending ? 'Resending…' : 'Resend code'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.tip}>
            <MaterialCommunityIcons name="shield-key-outline" size={16} color={colors.textMuted} />
            <Text style={styles.tipText}>
              Use a password you don’t use anywhere else. We never email your password — only a one-time code.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { ...typography.h3, fontSize: 18 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, paddingBottom: 120 },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  heroTitle: { ...typography.h2, fontSize: 22 },
  heroSub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
    ...shadows.md,
  },
  primaryBtnText: { ...typography.button, color: '#fff', fontSize: 15 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: 4,
  },
  linkText: { ...typography.label, color: colors.accent, fontWeight: '700', fontSize: 14 },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xs,
  },
  tipText: { flex: 1, ...typography.bodySmall, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
