import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';
import { colors, spacing, shadows } from '@/views/styles/theme';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuth();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

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

  if (loading) return <Loading message="Signing in..." />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.gradient}>
        <View style={styles.header}>
          <Text style={styles.logo}>🚲</Text>
          <Text style={styles.title}>Smart Trike</Text>
          <Text style={styles.subtitle}>Your ride, your way</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>🎮 Quick Demo</Text>
            <View style={styles.demoButtons}>
              <Button mode="contained" onPress={() => handleDemoMode('passenger')} style={styles.demoBtn}>👤 Passenger</Button>
              <Button mode="contained" onPress={() => handleDemoMode('driver')} style={styles.demoBtn}>🚗 Driver</Button>
            </View>
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or login</Text>
            <View style={styles.line} />
          </View>

          <TextInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" mode="outlined" style={styles.input} />
          <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry mode="outlined" style={styles.input} />
          
          <Button mode="contained" onPress={handleLogin} disabled={loading} style={styles.loginBtn}>Login</Button>
          
          <Button mode="text" onPress={() => navigation.navigate('Register')} style={styles.registerBtn}>
            Don't have an account? Sign up
          </Button>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  gradient: { paddingTop: 60, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  header: { alignItems: 'center' },
  logo: { fontSize: 64, marginBottom: spacing.sm },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: spacing.xs },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.9)' },
  content: { flex: 1, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.lg, ...shadows.lg },
  demoSection: { marginBottom: spacing.lg },
  demoTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  demoButtons: { flexDirection: 'row', gap: spacing.sm },
  demoBtn: { flex: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, color: colors.textLight, fontSize: 14 },
  input: { marginBottom: spacing.md },
  loginBtn: { marginTop: spacing.sm, paddingVertical: spacing.xs },
  registerBtn: { marginTop: spacing.md }
});
