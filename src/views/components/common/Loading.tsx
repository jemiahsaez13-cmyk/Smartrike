import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';
import { colors, radius, shadows, spacing, typography } from '@/views/styles/theme';

interface LoadingProps {
  message?: string;
  showImage?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading your journey...', showImage = false }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const translateX = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  return (
    <View style={styles.container}>
      <View style={styles.loaderBox}>
        <ActivityIndicator size={62} color={colors.primary} />
        <Animated.View style={[styles.iconOverlay, { transform: [{ translateX }] }]}>
          <TricycleIcon size={38} color={colors.primaryDark} />
        </Animated.View>
      </View>
      {message && <Text style={styles.text}>{message}</Text>}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              transform: [
                {
                  scaleX: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.36, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
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
    width: 92,
    height: 92,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...shadows.md,
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
    ...typography.subtitle,
    letterSpacing: 0
  },
  progressTrack: {
    width: 128,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressBar: {
    width: '100%',
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
