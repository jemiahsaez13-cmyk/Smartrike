import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '@/models/services/AuthService';
import { colors, spacing } from '@/views/styles/theme';

const authService = new AuthService();

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
    } catch {
      // In prototype mode the reset always "succeeds".
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>We'll help you get back in</Text>
      </LinearGradient>

      <View style={styles.content}>
        {sent ? (
          <View style={styles.successBox}>
            <View style={styles.successIcon}>
              <MaterialCommunityIcons name="email-check-outline" size={48} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              If an account exists for {email}, you'll receive password reset instructions shortly.
            </Text>
            <TouchableOpacity style={styles.resetBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.8}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.resetGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.resetBtnText}>Back to Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.instructions}>
              Enter the email address linked to your account and we'll send you a reset link.
            </Text>

            <View style={[styles.inputWrapper, focused && styles.inputFocused]}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={focused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </View>

            <TouchableOpacity
              style={[styles.resetBtn, (!email.trim() || loading) && { opacity: 0.6 }]}
              onPress={handleReset}
              disabled={!email.trim() || loading}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.resetGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.resetBtnText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backLink}>
              <Text style={styles.backText}>
                Remembered it? <Text style={styles.backHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  content: { flex: 1, padding: spacing.lg, paddingTop: spacing.xl },
  instructions: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.xl },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  inputFocused: { borderColor: colors.primary },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  resetBtn: { height: 56, borderRadius: 16, overflow: 'hidden' },
  resetGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resetBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  backLink: { marginTop: spacing.lg, alignItems: 'center' },
  backText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  backHighlight: { color: colors.primary, fontWeight: '700' },
  successBox: { alignItems: 'center', paddingTop: spacing.xl },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  successText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
});
