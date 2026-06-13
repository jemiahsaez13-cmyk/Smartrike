import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, ScrollView, Platform, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { colors } from '@/views/styles/theme';

const { width } = Dimensions.get('window');

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const buttonScale1 = useRef(new Animated.Value(1)).current;
  const buttonScale2 = useRef(new Animated.Value(1)).current;
  const buttonScale3 = useRef(new Animated.Value(1)).current;

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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateButton = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDemoMode = (userType: 'passenger' | 'driver') => {
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

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#1E90FF', '#0DA5C0', '#00C9FF']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Animated.Text style={[styles.appName, { transform: [{ translateY: slideAnim }] }]}>
          Smart Trike
        </Animated.Text>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }
        ]}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>Choose your sign in method</Text>
          </View>

          <View style={styles.authOptions}>
            {/* Google Sign-In */}
            <Animated.View style={{ transform: [{ scale: buttonScale1 }] }}>
              <TouchableOpacity 
                style={styles.authButton}
                onPress={() => {
                  animateButton(buttonScale1);
                  navigation.navigate('GoogleSignIn');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#1E90FF', '#0DA5C0']} 
                  style={styles.authGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <MaterialCommunityIcons name="google" size={24} color="#fff" />
                  <Text style={styles.authButtonText}>Sign in with Google</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Phone Sign-In */}
            <Animated.View style={{ transform: [{ scale: buttonScale2 }] }}>
              <TouchableOpacity 
                style={styles.authButton}
                onPress={() => {
                  animateButton(buttonScale2);
                  navigation.navigate('PhoneLogin');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#1E90FF', '#0DA5C0']} 
                  style={styles.authGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <MaterialCommunityIcons name="phone" size={24} color="#fff" />
                  <Text style={styles.authButtonText}>Sign in with Phone</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Email Sign-In */}
            <Animated.View style={{ transform: [{ scale: buttonScale3 }] }}>
              <TouchableOpacity 
                style={styles.authButton}
                onPress={() => {
                  animateButton(buttonScale3);
                  navigation.navigate('EmailLogin');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.emailButtonGradient}>
                  <MaterialCommunityIcons name="email-outline" size={24} color={colors.primary} />
                  <Text style={styles.emailButtonText}>Sign in with Email</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>
              Don't have an account? <Text style={styles.signUpLink} onPress={() => navigation.navigate('Register')}>Sign Up</Text>
            </Text>
          </View>

          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>DEMO MODE</Text>
            <View style={styles.demoButtons}>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleDemoMode('passenger')}
                activeOpacity={0.7}
              >
                <LinearGradient 
                  colors={['#E3F2FD', '#F0F7FF']}
                  style={styles.demoBtnGradient}
                >
                  <MaterialCommunityIcons name="account" size={28} color={colors.primary} />
                  <Text style={styles.demoBtnText}>Passenger</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleDemoMode('driver')}
                activeOpacity={0.7}
              >
                <LinearGradient 
                  colors={['#E3F2FD', '#F0F7FF']}
                  style={styles.demoBtnGradient}
                >
                  <MaterialCommunityIcons name="car" size={28} color={colors.primary} />
                  <Text style={styles.demoBtnText}>Driver</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  scrollContent: { 
    flexGrow: 1 
  },
  header: {
    paddingTop: 60,
    paddingBottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40
  },
  welcomeContainer: { 
    marginBottom: 40, 
    alignItems: 'center' 
  },
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
  authOptions: {
    marginBottom: 40,
    gap: 12
  },
  authButton: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  authGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3
  },
  emailButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primaryLight,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3
  },
  signUpContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  signUpText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  signUpLink: {
    color: colors.primary,
    fontWeight: '700'
  },
  demoSection: {
    marginTop: 'auto',
    paddingBottom: 20
  },
  demoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textLight,
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center'
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 12
  },
  demoBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3
  },
  demoBtnGradient: {
    padding: 16,
    alignItems: 'center'
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
    letterSpacing: 0.3
  }
});
