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
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  elevated: {
    backgroundColor: colors.surface,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: 'transparent',
  }
});


