import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput as RNTextInput, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Alert, SafeAreaView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Button } from '@/views/components/common/Button';

export const OTPVerificationScreen = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const inputRefs = useRef<RNTextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (text: string, index: number): void => {
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = numericText;
    setOtp(newOtp);

    if (numericText && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number): void => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = () => {
    Keyboard.dismiss();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Validation', 'Please enter all 6 digits');
      return;
    }

    Alert.alert('Success', 'OTP verified!', [
      {
        text: 'OK',
        onPress: () => navigation.navigate('Login')
      }
    ]);
  };

  const handleResendOTP = () => {
    setTimeLeft(45);
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    Alert.alert('Info', 'OTP sent to ' + route.params?.phoneNumber);
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
            <Text style={styles.title}>Verify phone</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to your phone</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.phoneSection}>
              <MaterialCommunityIcons name="cellphone-check" size={24} color={colors.primary} />
              <View style={styles.phoneInfo}>
                <Text style={styles.phoneLabel}>SENDING TO</Text>
                <Text style={styles.phoneNumber}>{route.params?.phoneNumber || '+63 9xx xxx xxxx'}</Text>
              </View>
            </View>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(ref) => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={[styles.otpBox, digit && styles.otpBoxFilled]}
                  value={digit}
                  onChangeText={(text: string) => handleOtpChange(text, index)}
                  onKeyPress={(e: any) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="-"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.primary}
                />
              ))}
            </View>

            <View style={styles.resendContainer}>
              {!canResend ? (
                <Text style={styles.timerText}>
                  Resend code in <Text style={styles.timerBold}>{timeLeft}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOTP}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button 
              variant="primary" 
              onPress={handleVerifyOTP}
              style={styles.verifyBtn}
            >
              Verify code
            </Button>

            <TouchableOpacity 
              style={styles.changePhoneBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.changePhoneText}>
                Wrong number? <Text style={styles.changePhoneLink}>Change</Text>
              </Text>
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
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: {
    flex: 1
  },
  phoneSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  phoneInfo: {
    marginLeft: spacing.md,
  },
  phoneLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  phoneNumber: {
    ...typography.subtitle,
    fontSize: 16,
    color: colors.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 20,
    ...typography.number,
    textAlign: 'center',
    backgroundColor: colors.surface,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  timerBold: {
    fontWeight: '700',
    color: colors.primary
  },
  resendLink: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
  verifyBtn: {
    height: 52,
    marginBottom: spacing.xl,
  },
  changePhoneBtn: {
    alignItems: 'center'
  },
  changePhoneText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  changePhoneLink: {
    color: colors.accent,
    fontWeight: '700'
  }
});
