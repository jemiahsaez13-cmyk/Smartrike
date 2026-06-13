import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
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
  const { login, loading } = useAuth();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const handleLogin = async () => {
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
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={['#059669', '#10B981']} style={styles.header}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="bike" size={40} color="#fff" />
            </View>
          </View>
          <Text style={styles.appName}>Smart Trike</Text>
          <Text style={styles.tagline}>Modern TODA Booking System</Text>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.formCard}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>Sign in to continue your ride</Text>

            <RNTextInput
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />

            <RNTextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity style={styles.signInBtn} onPress={handleLogin}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.signUpLink}>
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpHighlight}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickAccessSection}>
            <Text style={styles.quickAccessLabel}>QUICK ACCESS</Text>
            <View style={styles.quickAccessButtons}>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => handleDemoMode('passenger')}
              >
                <MaterialCommunityIcons name="account" size={24} color="#10B981" />
                <Text style={styles.quickAccessBtnText}>Passenger</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => handleDemoMode('driver')}
              >
                <MaterialCommunityIcons name="car" size={24} color="#10B981" />
                <Text style={styles.quickAccessBtnText}>Driver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingTop: 80,
    paddingBottom: 60,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40
  },
  iconContainer: {
    marginBottom: 20
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    fontWeight: '500'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: -24
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28
  },
  input: {
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 16
  },
  signInBtn: {
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  signInBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5
  },
  signUpLink: {
    marginTop: 24,
    alignItems: 'center'
  },
  signUpText: {
    fontSize: 14,
    color: '#6B7280'
  },
  signUpHighlight: {
    color: '#10B981',
    fontWeight: '700'
  },
  quickAccessSection: {
    marginTop: 32,
    paddingBottom: 40
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 16
  },
  quickAccessButtons: {
    flexDirection: 'row',
    gap: 16
  },
  quickAccessBtn: {
    flex: 1,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  quickAccessBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 8
  }
});
