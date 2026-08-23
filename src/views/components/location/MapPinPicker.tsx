import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from '@/config/maps';
import { colors, radius, spacing, typography } from '@/views/styles/theme';
import { MapPinPickerProps } from './MapPinPicker.types';
export type { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';
const BOAC = { latitude: 13.4452, longitude: 121.8401 };

export const MapPinPicker = ({ value, onChange, initialCenter = BOAC, height = 280 }: MapPinPickerProps) => {
  const mapRef = useRef<any>(null);
  useEffect(() => {
    const center = value ?? initialCenter;
    mapRef.current?.animateToRegion?.({ ...center, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 250);
  }, [value?.latitude, value?.longitude, initialCenter.latitude, initialCenter.longitude]);
  return <View>
    <MapView ref={mapRef} style={[styles.map, { height }]} initialRegion={{ ...(value ?? initialCenter), latitudeDelta: 0.018, longitudeDelta: 0.018 }} onPress={(event: any) => onChange(event.nativeEvent.coordinate)}>
      {value ? <Marker coordinate={value} draggable onDragEnd={(event: any) => onChange(event.nativeEvent.coordinate)} title="Confirmed pin" /> : null}
    </MapView>
    <View style={styles.hint}><MaterialCommunityIcons name="gesture-tap" size={17} color={colors.primary} /><Text style={styles.hintText}>Tap the map or drag the marker to set the exact location.</Text></View>
    {value ? <View style={styles.selected}><MaterialCommunityIcons name="map-marker-check" size={17} color={colors.success} /><Text style={styles.selectedText}>Selected pin: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text></View> : null}
  </View>;
};
const styles = StyleSheet.create({ map: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' }, hint: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm }, hintText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 }, selected: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.sm, marginTop: spacing.sm }, selectedText: { ...typography.labelSmall, color: colors.success, flex: 1 } });
