import React, { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PopularPlace } from '@/config/constants';
import { placeEstimate, formatDistance, formatETA } from '@/utils/locationUtils';
import { colors, radius, shadows, spacing, typography } from '@/views/styles/theme';

interface Props {
  place: PopularPlace;
  onPress: () => void;
  /** `wide` (default) is a full-width banner card; `compact` is a slim row. */
  variant?: 'wide' | 'compact';
}

export const PlaceCard = ({ place, onPress, variant = 'wide' }: Props) => {
  const { distanceKm, etaMin, fare } = placeEstimate(place);
  const [failed, setFailed] = useState(!place.image);

  // A branded icon tile stands in if the photo can't load, so a card never
  // shows a broken image.
  const Fallback = ({ style }: { style: any }) => (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={[style, styles.fallback]}>
      <MaterialCommunityIcons name={place.icon as any} size={variant === 'compact' ? 26 : 40} color="rgba(255,255,255,0.92)" />
    </LinearGradient>
  );

  const meta = (
    <View style={styles.metaRow}>
      <View style={styles.meta}>
        <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.metaText}>{formatETA(etaMin)}</Text>
      </View>
      <View style={styles.meta}>
        <MaterialCommunityIcons name="map-marker-distance" size={13} color={colors.textSecondary} />
        <Text style={styles.metaText}>{formatDistance(distanceKm)}</Text>
      </View>
      <View style={styles.fareTag}>
        <Text style={[styles.fareText, typography.currency]}>₱{fare.toFixed(0)}</Text>
      </View>
    </View>
  );

  if (variant === 'compact') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.compactCard}>
        {failed ? (
          <Fallback style={styles.compactImage} />
        ) : (
          <Image source={{ uri: place.image }} style={styles.compactImage} onError={() => setFailed(true)} />
        )}
        <View style={styles.compactBody}>
          <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
          <Text style={styles.address} numberOfLines={1}>{place.address}</Text>
          {meta}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textLight} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      {failed ? (
        <Fallback style={styles.image} />
      ) : (
        <Image source={{ uri: place.image }} style={styles.image} onError={() => setFailed(true)} />
      )}
      <View style={styles.categoryChip}>
        <MaterialCommunityIcons name={place.icon as any} size={12} color="#fff" />
        <Text style={styles.categoryText}>{place.category}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
        <Text style={styles.address} numberOfLines={1}>{place.address}</Text>
        {meta}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  image: { width: '100%', height: 130, backgroundColor: colors.surfaceAlt },
  fallback: { justifyContent: 'center', alignItems: 'center' },
  categoryChip: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  categoryText: { ...typography.labelSmall, color: '#fff', fontSize: 10, letterSpacing: 0.3 },
  body: { padding: spacing.md },
  name: { ...typography.subtitle, color: colors.text, fontSize: 16 },
  address: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...typography.bodySmall, color: colors.textSecondary, fontSize: 12 },
  fareTag: {
    marginLeft: 'auto',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  fareText: { ...typography.label, color: colors.primary, fontSize: 13 },
  // compact
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  compactImage: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginRight: spacing.md },
  compactBody: { flex: 1 },
});
