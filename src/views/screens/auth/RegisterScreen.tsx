import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';

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
      Alert.alert('Success', 'Account created!');
      navigation.replace('Login');
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    }
  };

  if (loading) return <Loading message="Creating account..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineMedium" style={styles.title}>Create Account</Text>
      <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <Button mode="contained" onPress={handleRegister} disabled={loading} style={styles.button}>Register</Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { textAlign: 'center', marginBottom: 30, fontWeight: 'bold' },
  input: { marginBottom: 15 },
  button: { marginTop: 20, paddingVertical: 5 }
});
