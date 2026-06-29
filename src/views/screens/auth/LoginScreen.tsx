import React, { useState, useRef, useEffect } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, TouchableOpacity, View,
  SafeAreaView, Animated, Linking,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { useAuth } from '@/controllers/hooks/useAuth';
import { notify } from '@/utils/confirm';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography, radius } from '@/views/styles/theme';

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { login, loading } = useAuth();

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
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      notify('Missing info', 'Please enter both email and password to continue.');
      return;
    }

    try {
      await login(cleanEmail, cleanPassword);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Something went wrong during sign in.';
      notify('Sign in failed', msg);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // On web Supabase handles the full redirect; on native we get the auth URL
      // back and open it in the system browser ourselves.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { skipBrowserRedirect: Platform.OS !== 'web' },
      });
      if (error) throw error;
      if (Platform.OS !== 'web' && data?.url) {
        const canOpen = await Linking.canOpenURL(data.url);
        if (canOpen) await Linking.openURL(data.url);
      }
    } catch {
      notify(
        'Google Sign-In Unavailable',
        'Google login isn’t configured yet. Please sign in with email or phone.\n\nTip: enable the Google provider in your Supabase dashboard to turn this on.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoMode = (userType: 'passenger' | 'driver' | 'admin') => {
    const demoUser: any = {
      id: `demo-${userType}`,
      auth_id: 'demo-auth',
      user_type: userType,
      email: `demo@${userType}.com`,
      phone: '09123456789',
      name: `Demo ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
      profile_photo_url: null,
      created_at: new Date(),
      status: 'active',
      rating: 0,
      total_trips: 0,
    };
    dispatch(setDemoUserReducer(demoUser));
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
                style={styles.altBtn}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('PhoneLogin')}
              >
                <MaterialCommunityIcons name="phone-outline" size={20} color={colors.text} />
                <Text style={styles.altBtnText}>Phone</Text>
              </TouchableOpacity>
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

            {/* Demo quick-login dispatches fake users that only exist in the
                in-memory mock backend. Hide it when a real Supabase backend is
                configured, since those accounts would fail RLS / show empty data. */}
            {!isSupabaseConfigured && (
              <View style={styles.demoBox}>
                <Text style={styles.demoTitle}>QUICK ACCESS (DEMO)</Text>
                <View style={styles.demoRow}>
                  {(['passenger', 'driver', 'admin'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.demoChip, type === 'admin' && styles.demoChipAdmin]}
                      onPress={() => handleDemoMode(type)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.demoChipText,
                          type === 'admin' && styles.demoChipTextAdmin,
                        ]}
                      >
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to Smart Trike?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
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
  demoBox: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  demoTitle: {
    ...typography.labelSmall,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  demoChip: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoChipAdmin: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  demoChipText: {
    ...typography.labelSmall,
    fontSize: 9,
    color: colors.textSecondary,
  },
  demoChipTextAdmin: {
    color: '#fff',
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
