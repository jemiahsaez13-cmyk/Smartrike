import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Input } from '@/views/components/common/Input';
import { Loading } from '@/views/components/common/Loading';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export const RegisterScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { register, loading } = useAuth();
  const navigation = useNavigation<any>();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

  const handleRegister = async () => {
    try {
      await register(email, password, { name, phone, user_type: 'passenger' });
      Alert.alert('Success', 'Account created! Please sign in.');
      navigation.replace('Login');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    }
  };

  if (loading) return <Loading message="Preparing your account..." />;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient 
          colors={[colors.primaryDark, colors.primary]} 
          style={styles.header}
        >
          <IconButton 
            icon="arrow-left" 
            iconColor="#fff" 
            style={styles.backBtn} 
            onPress={() => navigation.goBack()} 
          />
          <Animated.View style={[styles.headerText, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.title}>Join Us</Text>
            <Text style={styles.subtitle}>Create an account to start booking</Text>
          </Animated.View>
        </LinearGradient>

        <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.card}>
            <Input 
              label="Full Name" 
              value={name} 
              onChangeText={setName} 
              placeholder="Enter your name"
              left={<Text style={styles.inputIcon}><MaterialCommunityIcons name="account-outline" size={18} color={colors.textSecondary} /></Text>}
            />
            <Input 
              label="Email Address" 
              value={email} 
              onChangeText={setEmail} 
              keyboardType="email-address" 
              autoCapitalize="none"
              placeholder="example@mail.com"
              left={<Text style={styles.inputIcon}><MaterialCommunityIcons name="email-outline" size={18} color={colors.textSecondary} /></Text>}
            />
            <Input 
              label="Phone Number" 
              value={phone} 
              onChangeText={setPhone} 
              keyboardType="phone-pad"
              placeholder="0912 345 6789"
              left={<Text style={styles.inputIcon}><MaterialCommunityIcons name="phone-outline" size={18} color={colors.textSecondary} /></Text>}
            />
            <Input 
              label="Password" 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
              placeholder="Create a strong password"
              left={<Text style={styles.inputIcon}><MaterialCommunityIcons name="lock-outline" size={18} color={colors.textSecondary} /></Text>}
            />

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By signing up, you agree to our <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text>.
              </Text>
            </View>

            <Button 
              variant="primary" 
              onPress={handleRegister} 
              disabled={loading}
              style={styles.registerBtn}
            >
              Create Account
            </Button>

            <TouchableOpacity 
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { 
    height: 220, 
    paddingTop: 50, 
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backBtn: { marginLeft: -10 },
  headerText: { marginTop: 10 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '500' },
  formContainer: { paddingHorizontal: spacing.lg, marginTop: -40 },
  card: { 
    backgroundColor: colors.surface, 
    borderRadius: 24, 
    padding: spacing.xl, 
    ...shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)'
  },
  inputIcon: { marginTop: 10 },
  termsContainer: { marginVertical: spacing.md },
  termsText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  link: { color: colors.primary, fontWeight: '600' },
  registerBtn: { marginTop: spacing.md },
  loginLink: { marginTop: spacing.xl, alignItems: 'center' },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginHighlight: { color: colors.primary, fontWeight: '700' }
});
