import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { Card } from '@/views/components/common/Card';
import { AuthService } from '@/models/services/AuthService';

export const DriverRegisterScreen = () => {
  const navigation = useNavigation<any>();
  const authService = new AuthService();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    license_number: '',
    plate_number: '',
    vehicle_make: '',
    vehicle_model: '',
    toda_membership: '',
  });

  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const newErrors: any = {};
    if (!formData.name) newErrors.name = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.license_number) newErrors.license_number = 'License is required';
    if (!formData.plate_number) newErrors.plate_number = 'Plate number is required';
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
        user_type: 'driver',
        license_number: formData.license_number,
        toda_membership: formData.toda_membership,
        vehicle_details: {
          plate_number: formData.plate_number,
          make: formData.vehicle_make,
          model: formData.vehicle_model,
        }
      });
      Alert.alert('Registration Successful', 'Your driver account has been created. Our team will verify your documents shortly.', [
        { text: 'Great!', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const SectionHeader = ({ title, icon }: any) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Driver Signup</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Join our community and start earning.</Text>
        
        <Card variant="elevated" padding="md" style={styles.formCard}>
          <SectionHeader title="Personal Information" icon="account-details" />
          <Input
            label="Full Name"
            placeholder="Juan Dela Cruz"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            errorText={errors.name}
            left={<TextInput.Icon icon="account" />}
          />
          <Input
            label="Email"
            placeholder="juan@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            errorText={errors.email}
            left={<TextInput.Icon icon="email" />}
          />
          <Input
            label="Phone"
            placeholder="09xx xxx xxxx"
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            left={<TextInput.Icon icon="phone" />}
          />

          <Divider style={styles.divider} />
          
          <SectionHeader title="License & Membership" icon="card-account-details-outline" />
          <Input
            label="License Number"
            placeholder="D01-XX-XXXXXX"
            autoCapitalize="characters"
            value={formData.license_number}
            onChangeText={(text) => setFormData({ ...formData, license_number: text })}
            errorText={errors.license_number}
            left={<TextInput.Icon icon="card-account-details" />}
          />
          <Input
            label="TODA Membership ID"
            placeholder="TODA-12345"
            value={formData.toda_membership}
            onChangeText={(text) => setFormData({ ...formData, toda_membership: text })}
            left={<TextInput.Icon icon="badge-account-horizontal" />}
          />

          <Divider style={styles.divider} />

          <SectionHeader title="Vehicle Details" icon="tricycle" />
          <Input
            label="Plate Number"
            placeholder="123 ABC"
            autoCapitalize="characters"
            value={formData.plate_number}
            onChangeText={(text) => setFormData({ ...formData, plate_number: text })}
            errorText={errors.plate_number}
            left={<TextInput.Icon icon="numeric" />}
          />
          <View style={styles.row}>
            <Input
              label="Make"
              placeholder="Kawasaki"
              containerStyle={{ flex: 1, marginRight: 8 }}
              value={formData.vehicle_make}
              onChangeText={(text) => setFormData({ ...formData, vehicle_make: text })}
            />
            <Input
              label="Model"
              placeholder="Barako"
              containerStyle={{ flex: 1 }}
              value={formData.vehicle_model}
              onChangeText={(text) => setFormData({ ...formData, vehicle_model: text })}
            />
          </View>

          <Divider style={styles.divider} />

          <SectionHeader title="Security" icon="shield-lock-outline" />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            left={<TextInput.Icon icon="lock" />}
          />
          <Input
            label="Confirm Password"
            placeholder="••••••••"
            secureTextEntry
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
            errorText={errors.confirmPassword}
            left={<TextInput.Icon icon="lock-check" />}
          />
        </Card>

        <Button 
          variant="primary" 
          onPress={handleRegister} 
          loading={loading}
          style={styles.submitBtn}
        >
          Submit Application
        </Button>

        <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerText}>Already have an account? <Text style={styles.loginLink}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  scrollContent: {
    padding: spacing.screen,
    paddingBottom: 60,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  formCard: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    ...typography.label,
    fontSize: 16,
    color: colors.primary,
  },
  divider: {
    marginVertical: 24,
    backgroundColor: colors.borderLight,
  },
  row: {
    flexDirection: 'row',
  },
  submitBtn: {
    marginTop: 8,
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
