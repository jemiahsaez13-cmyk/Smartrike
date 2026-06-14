import React, { useRef } from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { StyleSheet, Animated, Pressable, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadows, typography } from '@/views/styles/theme';

interface CustomButtonProps extends Omit<ButtonProps, 'style'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Button: React.FC<CustomButtonProps> = ({ 
  variant = 'primary', 
  style, 
  containerStyle,
  children,
  onPress,
  disabled,
  loading,
  ...props 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      speed: 28,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 28,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const getMode = () => {
    if (variant === 'outline') return 'outlined';
    if (variant === 'ghost') return 'text';
    if (variant === 'secondary') return 'contained-tonal';
    return 'contained';
  };

  const isGradient = variant === 'gradient' || variant === 'primary';

  const content = (
    <PaperButton
      mode={getMode()}
      style={[
        styles.button, 
        isGradient && styles.gradientButton,
        variant === 'outline' && styles.outlineButton,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'ghost' && styles.ghostButton,
        (disabled || loading) && styles.disabledButton,
        style
      ]}
      labelStyle={[
        styles.label,
        variant === 'outline' && styles.outlineLabel,
        variant === 'ghost' && styles.ghostLabel,
        (disabled || loading) && styles.disabledLabel,
      ]}
      contentStyle={styles.content}
      onPress={onPress}
      disabled={disabled || loading}
      loading={loading}
      {...props}
    >
      {children}
    </PaperButton>
  );

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, containerStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
      >
        {isGradient && !disabled && !loading ? (
          <LinearGradient
            colors={gradients.action}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradientContainer, style]}
          >
            {content}
          </LinearGradient>
        ) : (
          content
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 0,
  },
  gradientButton: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  gradientContainer: {
    borderRadius: radius.md,
    ...shadows.md,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryLight,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.58,
  },
  outlineButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.label,
    fontSize: 16,
    letterSpacing: 0,
    paddingVertical: 4,
  },
  outlineLabel: {
    color: colors.primary,
  },
  ghostLabel: {
    color: colors.textSecondary,
  },
  disabledLabel: {
    color: colors.textLight,
  },
  content: {
    minHeight: 52,
  }
});
