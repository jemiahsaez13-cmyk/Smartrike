import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Loading } from '@/views/components/common/Loading';
import { LinearGradient } from 'expo-linear-gradient';

export const RegisterScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { register, loading } = useAuth();
  const navigation = useNavigation<any>();

  const handleRegister = async () => {
    try {
      await register(email, password, { name, phone, user_type: 'passenger' });
      Alert.alert('Success', 'Account created! Please sign in.');
      navigation.replace('Login');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    }
  };

  if (loading) return <Loading message="Creating your account..." />;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#059669', '#10B981']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Join Us</Text>
          <Text style={styles.subtitle}>Create an account to start booking</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <RNTextInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#9CA3AF"
          />
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
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
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

          <View style={styles.terms}>
            <Text style={styles.termsText}>
              By signing up, you agree to our <Text style={styles.link}>Terms of Service</Text> and{'\n'}
              <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
            <Text style={styles.registerBtnText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.signInLink}>
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '400'
  },
  content: {
    flex: 1,
    marginTop: -16
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    marginHorizontal: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5
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
  terms: {
    marginTop: 8,
    marginBottom: 24
  },
  termsText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18
  },
  link: {
    color: '#10B981',
    fontWeight: '600'
  },
  registerBtn: {
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5
  },
  signInLink: {
    marginTop: 24,
    alignItems: 'center'
  },
  signInText: {
    fontSize: 14,
    color: '#6B7280'
  },
  signInHighlight: {
    color: '#10B981',
    fontWeight: '700'
  }
});
