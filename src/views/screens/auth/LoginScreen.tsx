import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, Animated, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Input } from '@/views/components/common/Input';
import { Loading } from '@/views/components/common/Loading';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { colors, spacing, shadows } from '@/views/styles/theme';

const { height } = Dimensions.get('window');

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuth();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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

  const handleLogin = async () => {
    try {
      const result = await login(email, password);
      if (result.user.user_type === 'passenger') navigation.replace('Passenger');
      else if (result.user.user_type === 'driver') navigation.replace('Driver');
      else navigation.replace('Admin');
    } catch (err) {
      Alert.alert('Login Failed', error || 'Invalid credentials');
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
      rating: 4.5,
      total_trips: 10
    };
    dispatch(setDemoUserReducer(demoUser));
  };

  if (loading) return <Loading message="Signing in to your journey..." />;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <LinearGradient 
            colors={[colors.primaryDark, colors.primary]} 
            style={styles.headerGradient}
          >
            <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={styles.logoCircle}>
                <MaterialCommunityIcons name="bike" size={40} color="#fff" />
              </View>
              <Text style={styles.title}>Smart Trike</Text>
              <Text style={styles.subtitle}>Modern TODA Booking System</Text>
            </Animated.View>
          </LinearGradient>
          <View style={styles.headerCurve} />
        </View>

        <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.loginHintText}>Sign in to continue your ride</Text>

            <Input 
              label="Email Address" 
              value={email} 
              onChangeText={setEmail} 
              keyboardType="email-address" 
              autoCapitalize="none" 
              left={<Text style={styles.inputIcon}><MaterialCommunityIcons name="email-outline" size={18} color={colors.textSecondary} /></Text>}
            />
            <Input 
              label="Password" 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
              left={<Text style={styles.inputIcon}><MaterialCommunityIcons name="lock-outline" size={18} color={colors.textSecondary} /></Text>}
            />
            
            <Button 
              variant="primary" 
              onPress={handleLogin} 
              disabled={loading}
              style={styles.loginBtn}
            >
              Sign In
            </Button>
            
            <Button 
              variant="ghost" 
              onPress={() => navigation.navigate('Register')} 
              style={styles.registerBtn}
            >
              Don't have an account? <Text style={styles.signUpText}>Sign Up</Text>
            </Button>
          </View>

          <View style={styles.demoSection}>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>QUICK ACCESS</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.demoButtonsRow}>
              <Button 
                variant="outline" 
                onPress={() => handleDemoMode('passenger')} 
                style={styles.demoBtn}
                labelStyle={styles.demoBtnLabel}
              >
                <MaterialCommunityIcons name="account-outline" size={16} /> Passenger
              </Button>
              <Button 
                variant="outline" 
                onPress={() => handleDemoMode('driver')} 
                style={styles.demoBtn}
                labelStyle={styles.demoBtnLabel}
              >
                <MaterialCommunityIcons name="car-hatchback" size={16} /> Driver
              </Button>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  headerContainer: { height: height * 0.35, position: 'relative' },
  headerGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContent: { alignItems: 'center' },
  logoCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '500' },
  headerCurve: {
    position: 'absolute',
    bottom: -1,
    width: '100%',
    height: 40,
    backgroundColor: colors.background,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  formContainer: { flex: 1, paddingHorizontal: spacing.lg, marginTop: -20 },
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: 24, 
    padding: spacing.xl, 
    ...shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)'
  },
  welcomeText: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  loginHintText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, marginTop: 4 },
  inputIcon: { marginTop: 10 },
  loginBtn: { marginTop: spacing.md },
  registerBtn: { marginTop: spacing.sm },
  signUpText: { color: colors.primary, fontWeight: '700' },
  demoSection: { marginTop: spacing.xl },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, color: colors.textLight, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  demoButtonsRow: { flexDirection: 'row', gap: spacing.md },
  demoBtn: { flex: 1, height: 50, borderRadius: 12 },
  demoBtnLabel: { fontSize: 14, fontWeight: '600' }
});
