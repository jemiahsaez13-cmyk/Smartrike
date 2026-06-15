import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Keyboard, ScrollView, SafeAreaView, Alert, Animated,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { useAuth } from '@/controllers/hooks/useAuth';
import { Loading } from '@/views/components/common/Loading';

export const PhoneLoginScreen = () => {
  const [phone, setPhone] = useState('');
  const navigation = useNavigation<any>();
  const { loginWithPhone, loading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRequestOTP = async () => {
    Keyboard.dismiss();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      Alert.alert('Validation', 'Please enter your phone number.');
      return;
    }
    
    try {
      await loginWithPhone(cleanPhone);
      navigation.navigate('OTPVerification', { phone: cleanPhone });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to send OTP.';
      Alert.alert('Error', msg);
    }
  };

  if (loading) return <Loading message="Sending code..." />;

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

            <View style={styles.headerSection}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="phone-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.title}>Sign in with phone</Text>
              <Text style={styles.subtitle}>
                Enter your mobile number and we'll send a one-time code.
              </Text>
            </View>

            <Input
              label="Phone number"
              placeholder="+63 9xx xxx xxxx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone-outline" color={colors.textMuted} />}
            />

            <Button variant="primary" onPress={handleRequestOTP} style={styles.cta}>
              Send code
            </Button>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Prefer email?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
                <Text style={styles.footerLink}>Sign in with email</Text>
              </TouchableOpacity>
            </View>
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
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
