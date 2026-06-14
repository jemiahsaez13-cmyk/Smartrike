import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/views/styles/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined';
  padding?: keyof typeof spacing | 'none';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  style, 
  variant = 'elevated',
  padding = 'md'
}) => {
  return (
    <View style={[
      styles.card, 
      styles[variant],
      padding !== 'none' && { padding: spacing[padding] },
      variant === 'elevated' && shadows.md,
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create<any>({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  }
});


