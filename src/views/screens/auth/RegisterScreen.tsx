import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput as RNTextInput, Animated, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors } from '@/views/styles/theme';

export const RegisterScreen = () => {
  const [userType, setUserType] = useState<'passenger' | 'driver'>('passenger');
  const [nameFocused, setNameFocused] = useState(false);
  const [fullName, setFullName] = useState('');
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale1 = useRef(new Animated.Value(1)).current;
  const buttonScale2 = useRef(new Animated.Value(1)).current;

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

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient 
        colors={['#1E90FF', '#0DA5C0', '#00C9FF']} 
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us to get started</Text>
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
            <Text style={styles.sectionTitle}>Choose Account Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, userType === 'passenger' && styles.typeOptionSelected]}
                onPress={() => setUserType('passenger')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="account" 
                  size={32} 
                  color={userType === 'passenger' ? colors.primary : colors.textLight}
                />
                <Text style={[styles.typeText, userType === 'passenger' && styles.typeTextSelected]}>
                  Passenger
                </Text>
                <Text style={styles.typeSubtext}>Book rides</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeOption, userType === 'driver' && styles.typeOptionSelected]}
                onPress={() => setUserType('driver')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="car" 
                  size={32} 
                  color={userType === 'driver' ? colors.primary : colors.textLight}
                />
                <Text style={[styles.typeText, userType === 'driver' && styles.typeTextSelected]}>
                  Driver
                </Text>
                <Text style={styles.typeSubtext}>Earn money</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>Sign Up With</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.authOptions}>
              <Animated.View style={{ transform: [{ scale: buttonScale1 }] }}>
                <TouchableOpacity 
                  style={styles.authButton}
                  onPress={() => {
                    animateButton(buttonScale1);
                    // Handle Google signup
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
                    <Text style={styles.authButtonText}>Google</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: buttonScale2 }] }}>
                <TouchableOpacity 
                  style={styles.authButton}
                  onPress={() => {
                    animateButton(buttonScale2);
                    navigation.navigate('PhoneLogin');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.phoneAuthGradient}>
                    <MaterialCommunityIcons name="phone" size={24} color={colors.primary} />
                    <Text style={styles.phoneAuthButtonText}>Phone</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.signInContainer}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
    letterSpacing: -0.5
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border
  },
  typeOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  typeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
    marginTop: 8
  },
  typeTextSelected: {
    color: colors.primary
  },
  typeSubtext: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
    fontWeight: '500'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
    gap: 12
  },
  line: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.border
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.5
  },
  authOptions: {
    gap: 12
  },
  authButton: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
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
  phoneAuthGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    height: 56,
    borderRadius: 16
  },
  phoneAuthButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3
  },
  signInContainer: {
    alignItems: 'center'
  },
  signInText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  signInLink: {
    color: colors.primary,
    fontWeight: '700'
  }
});
