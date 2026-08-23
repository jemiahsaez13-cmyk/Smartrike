import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text, TextInput } from 'react-native-paper';
import { AuthService } from '@/models/services/AuthService';
import { Button } from '@/views/components/common/Button';
import { Input } from '@/views/components/common/Input';
import { colors, spacing, typography } from '@/views/styles/theme';
import { notify } from '@/utils/confirm';
import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/utils/validationUtils';

const authService = new AuthService();

export const NewPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = String(route.params?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const passwordResult = isValidPassword(password);
    if (!passwordResult.valid) {
      setPasswordError(PASSWORD_REQUIREMENTS);
      return;
    }
    if (!confirmPassword) {
      setConfirmError('Confirm your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError('The passwords do not match.');
      return;
    }

    setLoading(true);
    setPasswordError('');
    setConfirmError('');
    try {
      await authService.completePasswordReset(email, password);
      await notify('Password reset successful', 'Your new password has been saved. Sign in with it to continue.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error: any) {
      setPasswordError(error?.message || 'Your password could not be updated. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="lock-check-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Create a new password</Text>
          <Text style={styles.subtitle}>Your code was verified. Choose a strong password for your account.</Text>

          <Input
            label="New Password"
            placeholder="Enter your new password"
            value={password}
            onChangeText={(value) => { setPassword(value); setPasswordError(''); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            errorText={passwordError}
            left={<TextInput.Icon icon="lock-outline" color={colors.textMuted} />}
          />
          <Text style={styles.helper}>{PASSWORD_REQUIREMENTS}</Text>
          <Input
            label="Confirm New Password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChangeText={(value) => { setConfirmPassword(value); setConfirmError(''); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            errorText={confirmError}
            left={<TextInput.Icon icon="lock-check-outline" color={colors.textMuted} />}
          />

          <Button
            variant="primary"
            onPress={handleSave}
            loading={loading}
            disabled={!password || !confirmPassword || loading}
            style={styles.cta}
          >
            Save new password
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
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
  helper: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 19, marginTop: -spacing.sm, marginBottom: spacing.md },
  cta: { height: 54, marginTop: spacing.md },
});
