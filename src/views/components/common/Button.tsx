import React, { useRef } from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { StyleSheet, Animated, Pressable, ViewStyle, StyleProp, View } from 'react-native';
import { colors, radius, typography, spacing } from '@/views/styles/theme';

interface CustomButtonProps extends Omit<ButtonProps, 'style'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const isOutlineOrGhost = variant === 'outline' || variant === 'ghost';
  
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, containerStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.pressable,
          disabled && styles.disabled,
          style
        ]}
      >
        <View style={[
          styles.buttonContainer,
          variant === 'primary' && styles.primaryBtn,
          variant === 'secondary' && styles.secondaryBtn,
          variant === 'outline' && styles.outlineBtn,
          variant === 'ghost' && styles.ghostBtn,
          variant === 'danger' && styles.dangerBtn,
        ]}>
          {loading ? (
            <PaperButton loading={true} children="" labelStyle={styles.hiddenLabel} />
          ) : (
            <PaperButton
              mode="text"
              style={styles.innerPaperButton}
              labelStyle={[
                styles.label,
                (variant === 'primary' || variant === 'danger') && styles.textWhite,
                variant === 'secondary' && styles.textPrimary,
                variant === 'outline' && styles.textPrimary,
                variant === 'ghost' && styles.textSecondary,
              ]}
              {...props}
            >
              {children}
            </PaperButton>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create<any>({
  pressable: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  buttonContainer: {
    minHeight: 54,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceHover,
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostBtn: {
    backgroundColor: 'transparent',
  },
  dangerBtn: {
    backgroundColor: colors.error,
  },
  innerPaperButton: {
    margin: 0,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  label: {
    ...typography.button,
    marginVertical: 0,
    marginHorizontal: 0,
    letterSpacing: 0,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textPrimary: {
    color: colors.primary,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  hiddenLabel: {
    fontSize: 0,
  },
  disabled: {
    opacity: 0.5,
  }
});


