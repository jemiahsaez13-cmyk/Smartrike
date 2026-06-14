import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/views/styles/theme';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';

export const PhoneLoginScreen = () => {
  const [phone, setPhone] = useState('');
  const navigation = useNavigation<any>();

  const handleRequestOTP = () => {
    Keyboard.dismiss();

    if (!phone.trim()) {
      Alert.alert('Validation', 'Please enter your phone number.');
      return;
    }

    // OTP logic would go here
    navigation.navigate('OTPVerification', { phone });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sign in with phone</Text>
          </View>

          {/* Intro */}
          <View style={styles.intro}>
            <Text style={styles.title}>Mobile login</Text>
            <Text style={styles.subtitle}>Enter your phone number to receive a secure one-time password.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Phone number"
              placeholder="+63 9xx xxx xxxx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone-outline" color={colors.textMuted} />}
            />

            <Button 
              variant="primary" 
              onPress={handleRequestOTP}
              style={styles.submitBtn}
            >
              Send code
            </Button>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Prefer email login?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('EmailLogin')}>
              <Text style={styles.footerLink}>Go to email sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 16,
  },
  intro: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  submitBtn: {
    height: 52,
    marginTop: spacing.md,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
  },
  footerLink: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
});
