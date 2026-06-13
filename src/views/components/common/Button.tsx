import React, { useRef } from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { StyleSheet, Animated, Pressable, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, shadows } from '@/views/styles/theme';

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
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
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
        style
      ]}
      labelStyle={[
        styles.label,
        variant === 'outline' && { color: colors.primary }
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
      >
        {isGradient && !disabled ? (
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
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
    borderRadius: 16,
    borderWidth: 0,
  },
  gradientButton: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  gradientContainer: {
    borderRadius: 16,
    ...shadows.md,
  },
  outlineButton: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: 4,
  },
  content: {
    height: 54,
  }
});
