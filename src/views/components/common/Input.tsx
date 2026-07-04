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
  secureTextEntry,
  right,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  // Password fields get a single show/hide eye managed HERE, superseding any
  // caller-provided right icon — guarantees exactly one eye per field on
  // every screen (driver register, passenger register, logins, …).
  const isPassword = !!secureTextEntry;
  const rightNode = isPassword ? (
    <TextInput.Icon
      icon={hidden ? 'eye-outline' : 'eye-off-outline'}
      color={colors.textMuted}
      forceTextInputFocus={false}
      onPress={() => setHidden((h) => !h)}
    />
  ) : (
    right
  );

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
        secureTextEntry={isPassword ? hidden : false}
        right={rightNode}
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
    backgroundColor: colors.surfaceAlt,
  },
  outline: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceAlt,
  },
  outlineFocused: {
    borderWidth: 1.5,
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


