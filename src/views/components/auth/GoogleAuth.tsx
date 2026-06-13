import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/views/styles/theme';

interface GoogleAuthProps {
  onPress: () => void;
  loading?: boolean;
  variant?: 'button' | 'icon';
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ 
  onPress, 
  loading = false,
  variant = 'button'
}) => {
  if (variant === 'icon') {
    return (
      <TouchableOpacity 
        style={styles.iconButton}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons 
          name="google" 
          size={24} 
          color={colors.primary}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      <LinearGradient 
        colors={[colors.surface, '#F9FAFB']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name="google" 
            size={20} 
            color={colors.primary}
          />
        </View>
        <Text style={styles.text}>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  iconContainer: {
    marginRight: 12,
    padding: 8
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  }
});
