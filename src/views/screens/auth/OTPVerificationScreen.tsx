import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput as RNTextInput,
  KeyboardAvoidingView, Platform, Keyboard, ScrollView, Alert,
  SafeAreaView, Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Button } from '@/views/components/common/Button';
import { useAuth } from '@/controllers/hooks/useAuth';
import { Loading } from '@/views/components/common/Loading';

export const OTPVerificationScreen = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { verify, loginWithPhone, loading } = useAuth();
  const inputRefs = useRef<RNTextInput[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const boxScales = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const animateBox = (index: number, filled: boolean) => {
    Animated.sequence([
      Animated.timing(boxScales[index], {
        toValue: filled ? 1.14 : 0.92,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(boxScales[index], {
        toValue: 1,
        tension: 220,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleOtpChange = (text: string, index: number) => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = numericText;
    setOtp(newOtp);
    animateBox(index, !!numericText);

    if (numericText && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    Keyboard.dismiss();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Incomplete', 'Please enter all 6 digits.');
      return;
    }

    try {
      await verify(route.params?.phone, otpCode);
      // Navigation is automatic when isAuthenticated changes
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Verification failed.';
      Alert.alert('Error', msg);
    }
  };

  const handleResend = async () => {
    try {
      await loginWithPhone(route.params?.phone);
      setTimeLeft(45);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      Alert.alert('Sent', `A new code has been sent to ${route.params?.phone}`);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to resend code.');
    }
  };

  if (loading) return <Loading message="Verifying code..." />;

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
                <MaterialCommunityIcons name="shield-check-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.title}>Verify your phone</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to{'\n'}
                <Text style={styles.phoneHighlight}>
                  {route.params?.phone || '+63 9xx xxx xxxx'}
                </Text>
              </Text>
            </View>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <Animated.View
                  key={index}
                  style={{ transform: [{ scale: boxScales[index] }] }}
                >
                  <RNTextInput
                    ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={(e: any) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    placeholder="·"
                    placeholderTextColor={colors.textMuted}
                    selectionColor={colors.primary}
                  />
                </Animated.View>
              ))}
            </View>

            <View style={styles.resendRow}>
              {!canResend ? (
                <Text style={styles.timerText}>
                  Resend in{' '}
                  <Text style={styles.timerBold}>{timeLeft}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendLink}>Resend code</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button variant="primary" onPress={handleVerifyOTP} style={styles.cta}>
              Verify code
            </Button>

            <TouchableOpacity style={styles.changeBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.changeBtnText}>
                Wrong number?{' '}
                <Text style={styles.changeLink}>Change it</Text>
              </Text>
            </TouchableOpacity>
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
  phoneHighlight: {
    ...typography.label,
    color: colors.text,
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  otpBox: {
    width: 48,
    height: 60,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 22,
    ...typography.number,
    textAlign: 'center',
    backgroundColor: colors.surface,
    color: colors.text,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surfaceAlt,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  timerBold: {
    ...typography.label,
    fontWeight: '700',
    color: colors.text,
  },
  resendLink: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
  cta: {
    height: 54,
    marginBottom: spacing.xl,
  },
  changeBtn: {
    alignItems: 'center',
  },
  changeBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  changeLink: {
    color: colors.accent,
    fontWeight: '700',
  },
});
