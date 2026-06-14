import React, { useState } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { TextInput, TextInputProps, Text } from 'react-native-paper';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

interface CustomInputProps extends TextInputProps {
  errorText?: string;
  containerStyle?: any;
}

export const Input: React.FC<CustomInputProps> = ({ 
  errorText, 
  containerStyle, 
  mode = 'outlined',
  onFocus,
  onBlur,
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (args: any) => {
    setIsFocused(true);
    onFocus?.(args);
  };

  const handleBlur = (args: any) => {
    setIsFocused(false);
    onBlur?.(args);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        mode={mode}
        outlineColor={colors.border}
        activeOutlineColor={colors.primary}
        cursorColor={colors.primary}
        selectionColor={colors.primary + '30'}
        textColor={colors.text}
        placeholderTextColor={colors.textMuted}
        style={styles.inputContainer}
        outlineStyle={[
          styles.outline,
          isFocused && styles.outlineFocused,
          !!errorText && styles.outlineError
        ]}
        contentStyle={styles.content}
        onFocus={handleFocus}
        onBlur={handleBlur}
        error={!!errorText}
        {...props}
      />
      {errorText ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  inputContainer: {
    backgroundColor: colors.surface,
  },
  outline: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  outlineFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  outlineError: {
    borderColor: colors.error,
  },
  content: {
    ...typography.body,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    minHeight: 48,
  },
  error: {
    ...typography.labelSmall,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: 2,
  },
});


