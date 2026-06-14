import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { AuthService } from '@/models/services/AuthService';

export const PassengerRegisterScreen = () => {
  const navigation = useNavigation<any>();
  const authService = new AuthService();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const newErrors: any = {};
    if (!formData.name) newErrors.name = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await authService.signUp(formData.email, formData.password, {
        name: formData.name,
        phone: formData.phone,
        user_type: 'passenger'
      });
      Alert.alert('Success', 'Account created successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Passenger Signup</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Let's get you set up to start booking rides.</Text>
        
        <Input
          label="Full Name"
          placeholder="John Doe"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          errorText={errors.name}
          left={<TextInput.Icon icon="account-outline" />}
        />

        <Input
          label="Email Address"
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          errorText={errors.email}
          left={<TextInput.Icon icon="email-outline" />}
        />

        <Input
          label="Phone Number"
          placeholder="0912 345 6789"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          errorText={errors.phone}
          left={<TextInput.Icon icon="phone-outline" />}
        />

        <Input
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          errorText={errors.password}
          left={<TextInput.Icon icon="lock-outline" />}
        />

        <Input
          label="Confirm Password"
          placeholder="••••••••"
          secureTextEntry
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          errorText={errors.confirmPassword}
          left={<TextInput.Icon icon="lock-check-outline" />}
        />

        <Button 
          variant="primary" 
          onPress={handleRegister} 
          loading={loading}
          style={styles.button}
        >
          Create Passenger Account
        </Button>

        <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerText}>Already have an account? <Text style={styles.loginLink}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// We need to import TextInput for Icons from react-native-paper
import { TextInput } from 'react-native-paper';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 40,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  button: {
    marginTop: 16,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  loginLink: {
    ...typography.label,
    color: colors.primary,
  }
});
