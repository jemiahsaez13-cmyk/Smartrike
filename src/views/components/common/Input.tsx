import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, TextInputProps, Text } from 'react-native-paper';
import { colors, spacing, theme } from '@/views/styles/theme';

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
        outlineStyle={styles.outline}
        contentStyle={styles.content}
        placeholderTextColor={colors.textLight}
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
    borderRadius: 16,
    borderWidth: 1.5,
  },
  content: {
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
});
