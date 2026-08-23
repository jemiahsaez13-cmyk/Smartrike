import React, { useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';
export type { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const TILE = 256;
const BOAC = { latitude: 13.4452, longitude: 121.8401 };
const project = (point: PinCoordinate, zoom: number) => {
  const scale = 2 ** zoom;
  const sin = Math.sin(point.latitude * Math.PI / 180);
  return { x: (point.longitude + 180) / 360 * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
};
const unproject = (x: number, y: number, zoom: number): PinCoordinate => {
  const scale = 2 ** zoom;
  const n = Math.PI - 2 * Math.PI * y / scale;
  return { latitude: 180 / Math.PI * Math.atan(Math.sinh(n)), longitude: x / scale * 360 - 180 };
};

export const MapPinPicker = ({ value, onChange, initialCenter = BOAC, height = 280 }: MapPinPickerProps) => {
  const [size, setSize] = useState({ width: 700, height });
  const [zoom, setZoom] = useState(16);
  const center = value ?? initialCenter;
  const centerWorld = project(center, zoom);
  const tiles = useMemo(() => {
    const cx = Math.floor(centerWorld.x); const cy = Math.floor(centerWorld.y);
    return [-2, -1, 0, 1, 2].flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => ({ x: cx + dx, y: cy + dy })));
  }, [Math.floor(centerWorld.x), Math.floor(centerWorld.y), zoom]);
  const leftWorld = centerWorld.x - size.width / TILE / 2;
  const topWorld = centerWorld.y - size.height / TILE / 2;
  const onLayout = (event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height });
  const place = (event: any) => {
    const x = leftWorld + event.nativeEvent.locationX / TILE;
    const y = topWorld + event.nativeEvent.locationY / TILE;
    onChange(unproject(x, y, zoom));
  };
  return <View>
    <View style={[styles.map, { height }]} onLayout={onLayout}>
      {tiles.map((tile) => <Image key={`${zoom}-${tile.x}-${tile.y}`} source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }} style={{ position: 'absolute', width: TILE, height: TILE, left: (tile.x - leftWorld) * TILE, top: (tile.y - topWorld) * TILE }} />)}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={place} activeOpacity={1} accessibilityLabel="Place map pin" />
      {value ? <View pointerEvents="none" style={[styles.marker, { left: size.width / 2 - 18, top: size.height / 2 - 36 }]}><MaterialCommunityIcons name="map-marker" size={38} color={colors.error} /></View> : null}
      <View style={styles.zoom}><TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom((z) => Math.min(18, z + 1))}><Text style={styles.zoomText}>+</Text></TouchableOpacity><TouchableOpacity style={styles.zoomBtn} onPress={() => setZoom((z) => Math.max(13, z - 1))}><Text style={styles.zoomText}>−</Text></TouchableOpacity></View>
      <View style={styles.credit}><Text style={styles.creditText}>© OpenStreetMap</Text></View>
    </View>
    <View style={styles.hint}><MaterialCommunityIcons name="gesture-tap" size={17} color={colors.primary} /><Text style={styles.hintText}>Click the map to place or move the exact location pin.</Text></View>
    {value ? <View style={styles.selected}><MaterialCommunityIcons name="map-marker-check" size={17} color={colors.success} /><Text style={styles.selectedText}>Selected pin: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text></View> : null}
  </View>;
};
const styles = StyleSheet.create({ map: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt, position: 'relative' }, marker: { position: 'absolute', width: 38, height: 38 }, zoom: { position: 'absolute', right: spacing.sm, top: spacing.sm, gap: 4 }, zoomBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border }, zoomText: { ...typography.h2, color: colors.text }, credit: { position: 'absolute', right: 4, bottom: 3, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.8)' }, creditText: { fontSize: 9, color: colors.textSecondary }, hint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm }, hintText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 }, selected: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.sm, marginTop: spacing.sm }, selectedText: { ...typography.labelSmall, color: colors.success, flex: 1 } });
