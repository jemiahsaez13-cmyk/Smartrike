import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput as RNTextInput, Animated, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '@/views/styles/theme';

export const OTPVerificationScreen = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const inputRefs = useRef<RNTextInput[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleOtpChange = (text: string, index: number): void => {
    // Only allow digits
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = numericText;
    setOtp(newOtp);

    // Auto focus next input
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
    animateButton();

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Validation', 'Please enter all 6 digits');
      return;
    }

    // TODO: Verify OTP with backend
    Alert.alert('Success', 'OTP verified!', [
      {
        text: 'OK',
        onPress: () => {
          // Navigate to next screen after OTP verification
          navigation.navigate('Login');
        }
      }
    ]);
  };

  const handleResendOTP = () => {
    animateButton();
    setTimeLeft(45);
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
    Alert.alert('Info', 'OTP sent to ' + route.params?.phoneNumber);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient 
        colors={[colors.primaryDark, colors.primary, colors.secondary]} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to your phone</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.card}>
            <View style={styles.phoneSection}>
              <MaterialCommunityIcons 
                name="phone-check" 
                size={28} 
                color={colors.primary}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.phoneLabel}>Phone Number</Text>
                <Text style={styles.phoneNumber}>{route.params?.phoneNumber}</Text>
              </View>
            </View>

            <Text style={styles.label}>Enter OTP</Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
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
                  placeholderTextColor={colors.textLight}
                  selectionColor={colors.primary}
                />
              ))}
            </View>

            <View style={styles.resendContainer}>
              {!canResend ? (
                <Text style={styles.timerText}>
                  Resend OTP in <Text style={styles.timerBold}>{timeLeft}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOTP} activeOpacity={0.7}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity 
                style={styles.verifyBtn}
                onPress={handleVerifyOTP}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={[colors.primary, colors.primaryDark]} 
                  style={styles.verifyBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.verifyBtnText}>Verify</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <TouchableOpacity 
            style={styles.changePhoneBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.changePhoneText}>
              Wrong number? <Text style={styles.changePhoneLink}>Change</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const TextInput = React.forwardRef<RNTextInput, any>(
  ({ style, ...props }, ref) => (
    <RNTextInput
      ref={ref}
      style={style}
      {...props}
    />
  )
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  headerContent: {
    flex: 1
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40
  },
  content: {
    flex: 1
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24
  },
  phoneSection: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.primary
  },
  phoneLabel: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600'
  },
  phoneNumber: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.background,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 28
  },
  timerText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  timerBold: {
    fontWeight: '700',
    color: colors.primary
  },
  resendLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  verifyBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  verifyBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  verifyBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3
  },
  changePhoneBtn: {
    alignItems: 'center'
  },
  changePhoneText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  changePhoneLink: {
    color: colors.primary,
    fontWeight: '700'
  }
});
