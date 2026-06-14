import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  ...props 
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        mode={mode}
        outlineColor={colors.border}
        activeOutlineColor={colors.primary}
        textColor={colors.text}
        placeholderTextColor={colors.textLight}
        outlineStyle={styles.outline}
        contentStyle={styles.content}
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
  outline: {
    borderRadius: radius.md,
    borderWidth: 1,
  },
  content: {
    ...typography.body,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    minHeight: 52,
  },
  error: {
    ...typography.label,
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
