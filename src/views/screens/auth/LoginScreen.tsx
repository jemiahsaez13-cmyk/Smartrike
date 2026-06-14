import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { useAuth } from '@/controllers/hooks/useAuth';
import { Loading } from '@/views/components/common/Loading';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, spacing, typography } from '@/views/styles/theme';

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Credentials', 'Please enter your email and password.');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch {
      Alert.alert('Access Denied', 'Invalid email or password. Please try again.');
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
      rating: 5.0,
      total_trips: 150,
    };
    dispatch(setDemoUserReducer(demoUser));
  };

  if (loading) return <Loading message="Authenticating..." />;

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
          {/* Top Brand Branding */}
          <View style={styles.header}>
            <TricycleIcon size={56} color={colors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.brandKicker}>FEDTODAB</Text>
              <Text style={styles.brandName}>Smart Trike</Text>
            </View>
          </View>

          {/* Intro Section */}
          <View style={styles.intro}>
            <Text style={styles.title}>Sign in to platform</Text>
            <Text style={styles.subtitle}>Enter your details below to access your account.</Text>
          </View>

          {/* Form */}
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
                  icon={showPassword ? "eye-off-outline" : "eye-outline"} 
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

            <Button 
              variant="primary" 
              onPress={handleLogin}
              style={styles.submitBtn}
            >
              Sign in
            </Button>
          </View>

          {/* Dividers & Alternates */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.alternateRow}>
            <Button 
              variant="outline" 
              style={styles.altBtn}
              onPress={() => navigation.navigate('PhoneLogin')}
            >
              <MaterialCommunityIcons name="phone-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              Phone
            </Button>
            <Button 
              variant="outline" 
              style={styles.altBtn}
            >
              <MaterialCommunityIcons name="google" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              Google
            </Button>
          </View>

          {/* Demo/Dev Tools */}
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>QUICK ACCESS MODES</Text>
            <View style={styles.demoGrid}>
              <TouchableOpacity style={styles.demoItem} onPress={() => handleDemoMode('passenger')}>
                <Text style={styles.demoText}>PASSENGER</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.demoItem} onPress={() => handleDemoMode('driver')}>
                <Text style={styles.demoText}>DRIVER</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.demoItem, { backgroundColor: colors.accent }]} onPress={() => handleDemoMode('admin')}>
                <Text style={[styles.demoText, { color: '#fff' }]}>ADMIN</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Register Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Smart Trike?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  headerText: {
    marginLeft: spacing.md,
  },
  brandKicker: {
    ...typography.labelSmall,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  brandName: {
    ...typography.h2,
    fontSize: 24,
    marginTop: -2,
  },
  intro: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  forgotLabel: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '600',
  },
  submitBtn: {
    height: 52,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.labelSmall,
    fontSize: 10,
    letterSpacing: 1.5,
    marginHorizontal: spacing.md,
    color: colors.textMuted,
  },
  alternateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  altBtn: {
    flex: 1,
    minHeight: 48,
    maxWidth: 160,
  },
  demoBox: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  demoTitle: {
    ...typography.labelSmall,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: spacing.md,
    textAlign: 'center',
    color: colors.textMuted,
  },
  demoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  demoItem: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoText: {
    ...typography.labelSmall,
    fontSize: 9,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
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
