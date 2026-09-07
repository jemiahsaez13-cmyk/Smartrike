import React, { useState, useRef, useEffect } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, TouchableOpacity, View,
  Animated, useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/controllers/hooks/useAuth';
import { notify } from '@/utils/confirm';
import { isValidEmail } from '@/utils/validationUtils';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography } from '@/views/styles/theme';

export const LoginScreen = () => {
  const { height } = useWindowDimensions();
  const shortScreen = height < 600;
  const navigation = useNavigation<any>();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  if (loading) return <Loading message="Authenticating..." />;

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'android' ? 0 : undefined }]}>
      {/* ── Black Hero ── */}
      <Animated.View style={[styles.hero, shortScreen && styles.heroCompact, { opacity: heroOpacity }]}>
        <TricycleIcon size={shortScreen ? 28 : 50} color="#fff" />
        {!shortScreen && <Text style={styles.heroKicker}>FEDTODAB</Text>}
        <Text style={styles.heroTitle}>Smart Trike</Text>
        {!shortScreen && <Text style={styles.heroSub}>Your ride, your way.</Text>}
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to Smart Trike?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmailRegister')}>
                <Text style={styles.footerLink}>Create account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
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
  heroCompact: { paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
    minHeight: 54,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xl,
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
