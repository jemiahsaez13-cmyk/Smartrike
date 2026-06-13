import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, TextInput as RNTextInput, Animated, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Loading } from '@/views/components/common/Loading';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/views/styles/theme';

const { width } = Dimensions.get('window');

export const RegisterScreen = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    userType: 'passenger'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const { register, loading } = useAuth();
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
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

  const handleRegister = async () => {
    animateButton();
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await register(formData.email, formData.password, {
        name: formData.name,
        phone: formData.phone,
        user_type: formData.userType
      });
      Alert.alert('Success', 'Account created! Please sign in.');
      navigation.replace('Login');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    }
  };

  if (loading) return <Loading message="Creating your account..." />;

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#1E90FF', '#0DA5C0', '#00C9FF']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us to start your journey</Text>
        </View>
      </LinearGradient>

      <Animated.ScrollView 
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.formCard}>
          {/* User Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radioOption, formData.userType === 'passenger' && styles.radioOptionSelected]}
                onPress={() => setFormData({ ...formData, userType: 'passenger' })}
              >
                <View style={[styles.radioCircle, formData.userType === 'passenger' && styles.radioCircleSelected]}>
                  {formData.userType === 'passenger' && <View style={styles.radioDot} />}
                </View>
                <View style={styles.radioLabel}>
                  <MaterialCommunityIcons name="account" size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.radioText}>Passenger</Text>
                    <Text style={styles.radioSubtext}>Book rides easily</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.radioOption, formData.userType === 'driver' && styles.radioOptionSelected]}
                onPress={() => setFormData({ ...formData, userType: 'driver' })}
              >
                <View style={[styles.radioCircle, formData.userType === 'driver' && styles.radioCircleSelected]}>
                  {formData.userType === 'driver' && <View style={styles.radioDot} />}
                </View>
                <View style={styles.radioLabel}>
                  <MaterialCommunityIcons name="car" size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.radioText}>Driver</Text>
                    <Text style={styles.radioSubtext}>Earn by driving</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Animated.View style={[
              styles.inputWrapper,
              nameFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="account-outline" 
                size={20} 
                color={nameFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Full Name"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </Animated.View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Animated.View style={[
              styles.inputWrapper,
              emailFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="email-outline" 
                size={20} 
                color={emailFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Email Address"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </Animated.View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Animated.View style={[
              styles.inputWrapper,
              phoneFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="phone-outline" 
                size={20} 
                color={phoneFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Phone Number"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                keyboardType="phone-pad"
                style={styles.input}
                placeholderTextColor={colors.textLight}
              />
            </Animated.View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Animated.View style={[
              styles.inputWrapper,
              passwordFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="lock-outline" 
                size={20} 
                color={passwordFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Password"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                style={[styles.input, { flex: 1 }]}
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialCommunityIcons 
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color={colors.textLight}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Animated.View style={[
              styles.inputWrapper,
              confirmPasswordFocused && styles.inputFocused
            ]}>
              <MaterialCommunityIcons 
                name="lock-check-outline" 
                size={20} 
                color={confirmPasswordFocused ? colors.primary : colors.textLight}
                style={styles.inputIcon}
              />
              <RNTextInput
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                onFocus={() => setConfirmPasswordFocused(true)}
                onBlur={() => setConfirmPasswordFocused(false)}
                secureTextEntry={!showConfirmPassword}
                style={[styles.input, { flex: 1 }]}
                placeholderTextColor={colors.textLight}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialCommunityIcons 
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} 
                  size={20} 
                  color={colors.textLight}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Terms */}
          <View style={styles.termsSection}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and{'\n'}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>

          {/* Create Account Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={styles.createBtn} 
              onPress={handleRegister}
              activeOpacity={0.8}
            >
              <LinearGradient 
                colors={['#1E90FF', '#0DA5C0']} 
                style={styles.createGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.createBtnText}>Create Account</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Sign In Link */}
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signInLink}>
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Social Login */}
        <View style={styles.socialSection}>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialBtn}>
              <MaterialCommunityIcons name="google" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <MaterialCommunityIcons name="facebook" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <MaterialCommunityIcons name="twitter" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>
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
    borderBottomRightRadius: 32
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  headerContent: {},
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500'
  },
  content: {
    flex: 1,
    marginTop: -16
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16
  },
  section: {
    marginBottom: 24
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12
  },
  radioGroup: {
    gap: 12
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border
  },
  radioOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff'
  },
  radioLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  radioText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  radioSubtext: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2
  },
  inputGroup: {
    marginBottom: 16
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  inputFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500'
  },
  termsSection: {
    marginTop: 8,
    marginBottom: 24
  },
  termsText: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600'
  },
  createBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  createGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  createBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5
  },
  signInLink: {
    marginTop: 20,
    alignItems: 'center'
  },
  signInText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  signInHighlight: {
    color: colors.primary,
    fontWeight: '700'
  },
  socialSection: {
    marginBottom: 24
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textLight,
    letterSpacing: 1,
    marginHorizontal: 12
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center'
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  }
});
