import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';
import { useAppDispatch } from '@/controllers/store';
import { setDemoUserReducer } from '@/controllers/slices/authSlice';

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
    <View style={styles.container}>
      <Text variant="headlineLarge" style={styles.title}>Smart Trike</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>Login to continue</Text>

      <View style={styles.demoContainer}>
        <Text style={styles.demoTitle}>🎮 Demo Mode (No Account Needed)</Text>
        <View style={styles.demoButtons}>
          <Button mode="contained" onPress={() => handleDemoMode('passenger')} style={styles.demoButton}>
            Passenger
          </Button>
          <Button mode="contained" onPress={() => handleDemoMode('driver')} style={styles.demoButton}>
            Driver
          </Button>
          <Button mode="contained" onPress={() => handleDemoMode('admin')} style={styles.demoButton}>
            Admin
          </Button>
        </View>
      </View>

      <Text style={styles.orText}>OR</Text>

      <TextInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <Button mode="contained" onPress={handleLogin} disabled={loading} style={styles.button}>Login</Button>
      <Button mode="text" onPress={() => navigation.navigate('Register')} style={styles.linkButton}>
        Don't have an account? Register
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { textAlign: 'center', marginBottom: 10, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 20, color: '#666' },
  demoContainer: { marginBottom: 20, padding: 15, backgroundColor: '#E3F2FD', borderRadius: 8 },
  demoTitle: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#1976D2' },
  demoButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  demoButton: { flex: 1 },
  orText: { textAlign: 'center', color: '#999', marginVertical: 15, fontSize: 14 },
  input: { marginBottom: 15 },
  button: { marginTop: 10, paddingVertical: 5 },
  linkButton: { marginTop: 10 }
});
