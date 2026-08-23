import React, { useState, useRef, useEffect } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, TouchableOpacity, View,
  SafeAreaView, Animated,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/controllers/hooks/useAuth';
import { notify } from '@/utils/confirm';
import { isValidEmail } from '@/utils/validationUtils';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography, radius } from '@/views/styles/theme';

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const { login, loading, checkAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const panelY = useRef(new Animated.Value(80)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(panelY, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
        Animated.timing(panelOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    Keyboard.dismiss();
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      notify('Missing info', 'Please enter both email and password to continue.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      notify('Invalid email', 'Please enter a valid email address.');
      return;
    }

    try {
      await login(cleanEmail, password);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Something went wrong during sign in.';
      notify('Sign in failed', msg);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // Web: Supabase performs the full-page redirect itself, so we just kick it
      // off and let the page reload handle the session.
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
        return;
      }

      // Native: open Google in a secure in-app browser, then catch the redirect
      // back into the app (smarttrike://auth-callback) and exchange the one-time
      // code Supabase returns for a real session.
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Could not start Google sign-in.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      // User dismissed the browser without completing sign-in.
      if (result.type !== 'success' || !result.url) return;

      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.error_description || queryParams?.error) {
        throw new Error(String(queryParams.error_description || queryParams.error));
      }

      const code = queryParams?.code;
      if (!code) throw new Error('Google did not return a sign-in code.');

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(String(code));
      if (exchangeError) throw exchangeError;

      // Session is now stored; load the matching app profile into Redux so the
      // navigator switches the user into the app.
      await checkAuth();
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message;
      notify(
        'Google Sign-In Unavailable',
        msg
          ? `Google sign-in could not be completed.\n\n${msg}`
          : 'Google login isn’t configured yet. Please sign in with email.\n\nTip: enable the Google provider in your Supabase dashboard to turn this on.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  if (loading) return <Loading message="Authenticating..." />;

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Black Hero ── */}
      <Animated.View style={[styles.hero, { opacity: heroOpacity }]}>
        <TricycleIcon size={50} color="#fff" />
        <Text style={styles.heroKicker}>FEDTODAB</Text>
        <Text style={styles.heroTitle}>Smart Trike</Text>
        <Text style={styles.heroSub}>Your ride, your way.</Text>
      </Animated.View>

      {/* ── Animated White Panel ── */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateY: panelY }], opacity: panelOpacity },
        ]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.panelScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.panelHandle} />

            <Text style={styles.panelTitle}>Sign in</Text>
            <Text style={styles.panelSub}>Enter your credentials to continue.</Text>

            <View style={styles.form}>
              <Input
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
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
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                left={<TextInput.Icon icon="lock-outline" color={colors.textMuted} />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPassword(!showPassword)}
                    color={colors.textSecondary}
                  />
                }
              />
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotLabel}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <Button variant="primary" onPress={handleLogin} style={styles.cta}>
              Sign in
            </Button>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divLabel}>OR CONTINUE WITH</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.altRow}>
              <TouchableOpacity
                style={[styles.altBtn, googleLoading && { opacity: 0.6 }]}
                activeOpacity={0.75}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
              >
                <MaterialCommunityIcons name="google" size={20} color={colors.text} />
                <Text style={styles.altBtnText}>{googleLoading ? 'Opening…' : 'Google'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to Smart Trike?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmailRegister')}>
                <Text style={styles.footerLink}>Create account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  hero: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  heroKicker: {
    ...typography.labelSmall,
    fontSize: 10,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.45)',
    marginTop: spacing.lg,
  },
  heroTitle: {
    ...typography.display,
    color: '#fff',
    fontSize: 38,
    marginTop: 2,
  },
  heroSub: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  panel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  panelScroll: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: spacing.lg,
  },
  panelTitle: {
    ...typography.h1,
    fontSize: 30,
    marginBottom: spacing.xs,
  },
  panelSub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  form: {
    marginBottom: spacing.xs,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  forgotLabel: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '600',
  },
  cta: {
    height: 54,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  divLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },
  altRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  altBtn: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  altBtnText: {
    ...typography.label,
    fontSize: 14,
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
