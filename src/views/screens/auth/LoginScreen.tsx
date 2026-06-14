import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Animated, TouchableOpacity, TextInput as RNTextInput, KeyboardAvoidingView, Platform, Keyboard, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Loading } from '@/views/components/common/Loading';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { colors, spacing } from '@/views/styles/theme';

const { width, height } = Dimensions.get('window');

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { login, loading } = useAuth();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
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

  const handleLogin = async () => {
    Keyboard.dismiss();
    animateButton();
    try {
      // AppNavigator swaps to the correct role stack once auth state updates,
      // so no manual navigation is needed here.
      await login(email, password);
    } catch (err) {
      Alert.alert('Login Failed', 'Invalid credentials');
    }
  };

  const handleDemoMode = (userType: 'passenger' | 'driver') => {
    animateButton();
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
      rating: 4.5,
      total_trips: 10
    };
    dispatch(setDemoUserReducer(demoUser));
  };

  if (loading) return <Loading message="Signing in..." />;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        style={{ opacity: fadeAnim }}
      >
        <LinearGradient 
          colors={['#1E90FF', '#0DA5C0', '#00C9FF']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Animated.Text style={[styles.appName, { transform: [{ translateY: slideAnim }] }]}>
            Smart Trike
          </Animated.Text>
          <Animated.Text style={[styles.tagline, { opacity: fadeAnim }]}>
            Your Journey, Simplified
          </Animated.Text>
        </LinearGradient>

        <Animated.View style={[styles.content, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.formCard}>
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>Sign in to continue your ride</Text>
            </View>

            <View style={styles.inputContainer}>
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
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  placeholderTextColor={colors.textLight}
                />
              </Animated.View>

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
                  value={password}
                  onChangeText={setPassword}
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

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotLink}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.signInBtn}
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#1E90FF', '#0DA5C0']} 
                  style={styles.signInGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.signInBtnText}>Sign In</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.signUpLink}>
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpHighlight}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.socialSection}>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
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

          <View style={styles.quickAccessSection}>
            <View style={styles.demoHeader}>
              <Text style={styles.demoLabel}>QUICK ACCESS - DEMO MODE</Text>
            </View>
            <View style={styles.quickAccessButtons}>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => handleDemoMode('passenger')}
                activeOpacity={0.7}
              >
                <LinearGradient 
                  colors={['#E3F2FD', '#F0F7FF']}
                  style={styles.quickAccessGradient}
                >
                  <View style={styles.quickIconBox}>
                    <MaterialCommunityIcons name="account" size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.quickAccessBtnText}>Passenger</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => handleDemoMode('driver')}
                activeOpacity={0.7}
              >
                <LinearGradient 
                  colors={['#E3F2FD', '#F0F7FF']}
                  style={styles.quickAccessGradient}
                >
                  <View style={styles.quickIconBox}>
                    <MaterialCommunityIcons name="car" size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.quickAccessBtnText}>Driver</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingTop: 70,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 8
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.5
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -24
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
  welcomeContainer: { marginBottom: 28, alignItems: 'center' },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: -0.5
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  inputContainer: { marginBottom: 24 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16
  },
  forgotText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600'
  },
  signInBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  signInGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  signInBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5
  },
  signUpLink: {
    marginTop: 20,
    alignItems: 'center'
  },
  signUpText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  signUpHighlight: {
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
  },
  quickAccessSection: {
    marginTop: 24,
    paddingBottom: 40
  },
  demoHeader: {
    marginBottom: 16,
    alignItems: 'center'
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textLight,
    letterSpacing: 1.5
  },
  quickAccessButtons: {
    flexDirection: 'row',
    gap: 12
  },
  quickAccessBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3
  },
  quickAccessGradient: {
    padding: 18,
    alignItems: 'center'
  },
  quickIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  quickAccessBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3
  }
});
