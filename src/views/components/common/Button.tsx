import React from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/views/styles/theme';

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button: React.FC<CustomButtonProps> = ({ variant = 'primary', style, ...props }) => {
  const getMode = () => {
    if (variant === 'outline') return 'outlined';
    if (variant === 'secondary') return 'contained-tonal';
    return 'contained';
  };
  
  return (
    <PaperButton
      mode={getMode()}
      style={[styles.button, style]}
      labelStyle={styles.label}
      contentStyle={styles.content}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12
  },
  label: {
    fontSize: 16,
    fontWeight: '600'
  },
  content: {
    paddingVertical: spacing.xs
  }
});
