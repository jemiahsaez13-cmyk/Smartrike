import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Animated, TouchableOpacity, TextInput as RNTextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Loading } from '@/views/components/common/Loading';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';

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
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
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
      const result = await login(email, password);
      if (result.user.user_type === 'passenger') navigation.replace('Passenger');
      else if (result.user.user_type === 'driver') navigation.replace('Driver');
      else navigation.replace('Admin');
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
        <LinearGradient colors={['#059669', '#10B981', '#34D399']} style={styles.header}>
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']} style={styles.iconCircle}>
              <MaterialCommunityIcons name="bike" size={48} color="#fff" />
            </LinearGradient>
          </Animated.View>
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
                  color={emailFocused ? '#10B981' : '#9CA3AF'} 
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
                  placeholderTextColor="#9CA3AF"
                />
              </Animated.View>

              <Animated.View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputFocused
              ]}>
                <MaterialCommunityIcons 
                  name="lock-outline" 
                  size={20} 
                  color={passwordFocused ? '#10B981' : '#9CA3AF'} 
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
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color="#9CA3AF" 
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity 
                style={styles.signInBtn} 
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#10B981', '#059669']} 
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

          <View style={styles.quickAccessSection}>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.quickAccessLabel}>QUICK ACCESS</Text>
              <View style={styles.line} />
            </View>
            <View style={styles.quickAccessButtons}>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => handleDemoMode('passenger')}
                activeOpacity={0.7}
              >
                <View style={styles.quickIconBox}>
                  <MaterialCommunityIcons name="account" size={28} color="#10B981" />
                </View>
                <Text style={styles.quickAccessBtnText}>Passenger</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => handleDemoMode('driver')}
                activeOpacity={0.7}
              >
                <View style={styles.quickIconBox}>
                  <MaterialCommunityIcons name="car" size={28} color="#10B981" />
                </View>
                <Text style={styles.quickAccessBtnText}>Driver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingTop: 70,
    paddingBottom: 50,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40
  },
  iconContainer: { marginBottom: 16 },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 0.5
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -20
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8
  },
  welcomeContainer: { marginBottom: 32, alignItems: 'center' },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500'
  },
  inputContainer: { marginBottom: 24 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  inputFocused: {
    backgroundColor: '#fff',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500'
  },
  signInBtn: {
    height: 58,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
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
    marginTop: 24,
    alignItems: 'center'
  },
  signUpText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500'
  },
  signUpHighlight: {
    color: '#10B981',
    fontWeight: '700'
  },
  quickAccessSection: {
    marginTop: 32,
    paddingBottom: 40
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginHorizontal: 16
  },
  quickAccessButtons: {
    flexDirection: 'row',
    gap: 16
  },
  quickAccessBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  quickIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  quickAccessBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.3
  }
});
