import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { PopularPlace } from '@/config/constants';
import { PopularPlaceService } from '@/models/services/PopularPlaceService';
import { PlaceCard } from '@/views/components/booking/PlaceCard';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const placeService = new PopularPlaceService();

export const PopularPlacesScreen = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [places, setPlaces] = useState<PopularPlace[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      placeService.listActive().then(setPlaces).catch(() => undefined);
    }, [])
  );

  const categories = useMemo(() => ['All', ...Array.from(new Set(places.map((p) => p.category)))], [places]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q);
      const matchesCategory = category === 'All' || p.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [query, category, places]);

  const book = (place: PopularPlace) => {
    navigation.navigate('BookRide', {
      place: { latitude: place.lat, longitude: place.lng, address: place.name },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Popular Places</Text>
          <Text style={styles.headerSubtitle}>Tap a destination to book a tricycle</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
        <RNTextInput
          placeholder="Search places…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="map-search-outline" size={52} color={colors.textLight} />
            <Text style={styles.emptyText}>
              {places.length === 0 ? 'No popular places yet' : 'No places match your search'}
            </Text>
          </View>
        ) : (
          filtered.map((place) => <PlaceCard key={place.id} place={place} onPress={() => book(place)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { ...typography.h1, fontSize: 28 },
  headerSubtitle: { ...typography.body, color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: { ...typography.body, flex: 1, color: colors.text, fontSize: 14, height: 48, padding: 0 },
  filterBar: { paddingVertical: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen },
  chip: { height: 32, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2, gap: spacing.md },
  emptyText: { ...typography.subtitle, color: colors.textSecondary },
});
