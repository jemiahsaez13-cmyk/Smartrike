import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '@/views/styles/theme';

interface LoadingProps {
  message?: string;
  showImage?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading your journey...', showImage = false }) => {
  return (
    <View style={styles.container}>
      <View style={styles.loaderBox}>
        <ActivityIndicator size={56} color={colors.primary} />
        <View style={styles.iconOverlay}>
          <MaterialCommunityIcons name="bike" size={24} color={colors.primary} />
        </View>
      </View>
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: spacing.xl, 
    backgroundColor: colors.background 
  },
  loaderBox: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  iconOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: { 
    marginTop: spacing.lg, 
    textAlign: 'center', 
    color: colors.textSecondary, 
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5
  }
});
