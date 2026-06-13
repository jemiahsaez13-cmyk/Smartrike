import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput as RNTextInput, Animated, KeyboardAvoidingView, Platform, Keyboard, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { colors } from '@/views/styles/theme';

const COUNTRY_CODES = [
  { code: '+63', country: 'PH', name: 'Philippines' },
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
];

export const PhoneLoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCode, setSelectedCode] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const navigation = useNavigation<any>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSendOTP = () => {
    Keyboard.dismiss();
    animateButton();
    
    if (!phoneNumber.trim()) {
      Alert.alert('Validation', 'Please enter your phone number');
      return;
    }

    if (phoneNumber.length < 10) {
      Alert.alert('Validation', 'Please enter a valid phone number');
      return;
    }

    navigation.navigate('OTPVerification', {
      phoneNumber: `${selectedCode.code} ${phoneNumber}`,
      fullNumber: selectedCode.code + phoneNumber
    });
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
          <Text style={styles.title}>Enter Phone Number</Text>
          <Text style={styles.subtitle}>We'll send you an OTP to verify</Text>
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
            <Text style={styles.label}>Phone Number</Text>

            <View style={styles.phoneInputWrapper}>
              <TouchableOpacity 
                style={styles.countrySelector}
                onPress={() => setShowCountryPicker(!showCountryPicker)}
                activeOpacity={0.7}
              >
                <Text style={styles.countryCode}>{selectedCode.code}</Text>
                <MaterialCommunityIcons 
                  name="chevron-down" 
                  size={20} 
                  color={colors.primary}
                />
              </TouchableOpacity>

              <Animated.View style={[
                styles.inputContainer,
                phoneFocused && styles.inputFocused
              ]}>
                <MaterialCommunityIcons 
                  name="phone" 
                  size={20} 
                  color={phoneFocused ? colors.primary : colors.textLight}
                  style={styles.inputIcon}
                />
                <RNTextInput
                  placeholder="9123456789"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  keyboardType="phone-pad"
                  style={styles.input}
                  placeholderTextColor={colors.textLight}
                />
              </Animated.View>
            </View>

            {showCountryPicker && (
              <View style={styles.countryPickerList}>
                {COUNTRY_CODES.map((item) => (
                  <TouchableOpacity
                    key={item.code}
                    style={[
                      styles.countryOption,
                      selectedCode.code === item.code && styles.countryOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedCode(item);
                      setShowCountryPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.countryOptionText}>
                      {item.code} {item.name}
                    </Text>
                    {selectedCode.code === item.code && (
                      <MaterialCommunityIcons 
                        name="check" 
                        size={20} 
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.hint}>
              We'll send a one-time password to this number
            </Text>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity 
                style={styles.sendBtn}
                onPress={handleSendOTP}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#1E90FF', '#0DA5C0']} 
                  style={styles.sendBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.sendBtnText}>Send OTP</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <TouchableOpacity 
            style={styles.changeMethodBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.changeMethodText}>
              Prefer Google? <Text style={styles.changeMethodLink}>Use Google Sign-In</Text>
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    alignItems: 'center'
  },
  countrySelector: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 90
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  inputFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  inputIcon: {
    marginRight: 12
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500'
  },
  countryPickerList: {
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  countryOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  countryOptionSelected: {
    backgroundColor: colors.primaryLight
  },
  countryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  hint: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
    marginBottom: 28,
    fontStyle: 'italic'
  },
  sendBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  sendBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  sendBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3
  },
  changeMethodBtn: {
    alignItems: 'center'
  },
  changeMethodText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  changeMethodLink: {
    color: colors.primary,
    fontWeight: '700'
  }
});
