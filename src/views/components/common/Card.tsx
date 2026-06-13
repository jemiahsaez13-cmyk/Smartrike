import React from 'react';
import { Card as PaperCard } from 'react-native-paper';
import { StyleSheet, ViewStyle } from 'react-native';
import { shadows } from '@/views/styles/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
}

export const Card: React.FC<CardProps> = ({ children, style, elevation = 2 }) => {
  return (
    <PaperCard style={[styles.card, shadows.md, style]} elevation={elevation}>
      {children}
    </PaperCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16
  }
});
