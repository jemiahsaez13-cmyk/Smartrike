/**
 * MapPinPicker — iOS / Android
 *
 * The coordinate inputs are ALWAYS shown and are the primary way to set a pin.
 * The map is supplementary: tapping/dragging auto-fills the inputs; typing in
 * the inputs animates the map. This means it works in Expo Go (where the map
 * renders blank) because the user can still type coordinates directly.
 *
 * Layout (top → bottom):
 *   ┌─────────────────────────────────┐
 *   │  LATITUDE        LONGITUDE      │  ← always visible, auto-filled by map
 *   │  [  13.445200  ] [ 121.840100 ] │
 *   └─────────────────────────────────┘
 *   ┌─────────────────────────────────┐
 *   │  [  MAP PREVIEW / ACTIVE MAP  ] │  ← tap preview → activates map
 *   │         Tap to place pin        │
 *   └─────────────────────────────────┘
 *        [ ✓ Done Pinning ]  (active only)
 *   ✓ Pin set: 13.445200, 121.840100  (when set)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from '@/config/maps';
import { colors, radius, spacing, typography } from '@/views/styles/theme';
import { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';
export type { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';

const BOAC: PinCoordinate = { latitude: 13.4452, longitude: 121.8401 };

const isValidLat = (v: number) => !isNaN(v) && v >= -90 && v <= 90;
const isValidLng = (v: number) => !isNaN(v) && v >= -180 && v <= 180;
const fmt = (n: number) => n.toFixed(6);

export const MapPinPicker = ({
  value,
  onChange,
  initialCenter = BOAC,
  height = 260,
}: MapPinPickerProps) => {
  const mapRef = useRef<any>(null);
  const [focused, setFocused] = useState(false);

  // Independent text state so the user can type freely without each keystroke
  // trying to parse an incomplete number.
  const [latText, setLatText] = useState(value ? fmt(value.latitude) : '');
  const [lngText, setLngText] = useState(value ? fmt(value.longitude) : '');

  // Sync inputs when value changes from outside (e.g. form reset).
  const prevRef = useRef<PinCoordinate | null>(value ?? null);
  useEffect(() => {
    const prev = prevRef.current;
    if (value?.latitude !== prev?.latitude || value?.longitude !== prev?.longitude) {
      setLatText(value ? fmt(value.latitude) : '');
      setLngText(value ? fmt(value.longitude) : '');
      prevRef.current = value ?? null;
    }
  }, [value?.latitude, value?.longitude]);

  // Animate map whenever value changes.
  useEffect(() => {
    const c = value ?? initialCenter;
    mapRef.current?.animateToRegion?.(
      { ...c, latitudeDelta: 0.018, longitudeDelta: 0.018 },
      250,
    );
  }, [value?.latitude, value?.longitude]);

  // Map tap / drag → update inputs + call onChange.
  const commitFromMap = (coord: PinCoordinate) => {
    setLatText(fmt(coord.latitude));
    setLngText(fmt(coord.longitude));
    onChange(coord);
  };

  // Lat input blur → validate → commit.
  const onLatBlur = () => {
    const n = parseFloat(latText);
    if (isValidLat(n)) {
      const coord: PinCoordinate = {
        latitude: n,
        longitude: value?.longitude ?? initialCenter.longitude,
      };
      setLatText(fmt(n));
      setLngText(fmt(coord.longitude));
      onChange(coord);
    } else {
      setLatText(value ? fmt(value.latitude) : '');
    }
  };

  // Lng input blur → validate → commit.
  const onLngBlur = () => {
    const n = parseFloat(lngText);
    if (isValidLng(n)) {
      const coord: PinCoordinate = {
        latitude: value?.latitude ?? initialCenter.latitude,
        longitude: n,
      };
      setLatText(fmt(coord.latitude));
      setLngText(fmt(n));
      onChange(coord);
    } else {
      setLngText(value ? fmt(value.longitude) : '');
    }
  };

  const mapRegion = {
    ...(value ?? initialCenter),
    latitudeDelta: 0.018,
    longitudeDelta: 0.018,
  };

  const latError = latText !== '' && isNaN(parseFloat(latText));
  const lngError = lngText !== '' && isNaN(parseFloat(lngText));

  return (
    <View style={styles.root}>

      {/* ═══════════════════════════════════════════════════════
          COORDINATE INPUTS — always at the top, always visible
          Auto-filled when user taps map; manually editable anytime
      ════════════════════════════════════════════════════════ */}
      <View style={styles.coordCard}>
        <View style={styles.coordCardHeader}>
          <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
          <Text style={styles.coordCardTitle}>COORDINATES</Text>
          {value ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setLatText('');
                setLngText('');
                onChange(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear pin"
            >
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.coordRow}>
          {/* Latitude */}
          <View style={styles.coordField}>
            <Text style={styles.coordLabel}>Latitude</Text>
            <View style={[styles.coordInputWrap, latError && styles.coordInputWrapError]}>
              <TextInput
                style={styles.coordInput}
                value={latText}
                onChangeText={setLatText}
                onBlur={onLatBlur}
                placeholder="13.445200"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
                selectTextOnFocus
                accessibilityLabel="Latitude"
              />
            </View>
            {latError ? (
              <Text style={styles.inputErrText}>–90 to 90</Text>
            ) : null}
          </View>

          {/* Divider dot */}
          <View style={styles.coordDivider}>
            <Text style={styles.coordDividerText}>·</Text>
          </View>

          {/* Longitude */}
          <View style={styles.coordField}>
            <Text style={styles.coordLabel}>Longitude</Text>
            <View style={[styles.coordInputWrap, lngError && styles.coordInputWrapError]}>
              <TextInput
                style={styles.coordInput}
                value={lngText}
                onChangeText={setLngText}
                onBlur={onLngBlur}
                placeholder="121.840100"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                selectTextOnFocus
                accessibilityLabel="Longitude"
              />
            </View>
            {lngError ? (
              <Text style={styles.inputErrText}>–180 to 180</Text>
            ) : null}
          </View>
        </View>

        {/* Confirmed pin row */}
        {value ? (
          <View style={styles.confirmedRow}>
            <MaterialCommunityIcons name="map-marker-check" size={15} color={colors.success} />
            <Text style={styles.confirmedText}>
              Pin set · {fmt(value.latitude)}, {fmt(value.longitude)}
            </Text>
          </View>
        ) : (
          <View style={styles.noPinRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textMuted} />
            <Text style={styles.noPinText}>
              No pin set — type coordinates above or tap the map below
            </Text>
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════
          MAP — supplementary; activates on tap
          When map is unavailable (Expo Go blank map), the
          coordinate inputs above still work perfectly.
      ════════════════════════════════════════════════════════ */}
      {focused ? (
        /* ── Active map ── */
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={[styles.map, { height }]}
            initialRegion={mapRegion}
            onPress={(e: any) => commitFromMap(e.nativeEvent.coordinate)}
          >
            {value ? (
              <Marker
                coordinate={value}
                draggable
                onDragEnd={(e: any) => commitFromMap(e.nativeEvent.coordinate)}
                title="Selected location"
              />
            ) : null}
          </MapView>
          <View style={styles.mapActiveHint}>
            <MaterialCommunityIcons name="gesture-tap" size={14} color={colors.primary} />
            <Text style={styles.mapActiveHintText}>
              Tap map to place pin · Drag marker to adjust
            </Text>
          </View>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => setFocused(false)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Done Pinning</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Inactive map preview ── */
        <TouchableOpacity
          style={[styles.previewWrap, { height: Math.round(height * 0.65) }]}
          activeOpacity={0.88}
          onPress={() => setFocused(true)}
          accessibilityLabel="Tap to activate map"
        >
          <MapView
            style={[StyleSheet.absoluteFill, styles.previewMap]}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
          >
            {value ? (
              <Marker coordinate={value} title="Selected location" />
            ) : null}
          </MapView>
          {/* scrim */}
          <View style={styles.previewScrim} />
          {/* badge */}
          <View style={styles.previewBadge}>
            <MaterialCommunityIcons
              name={value ? 'map-marker-check' : 'map-marker-plus-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.previewBadgeText}>
              {value ? 'Tap map to adjust pin' : 'Tap map to place pin'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },

  // ── Coord card ──────────────────────────────────────────
  coordCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  coordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  coordCardTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    flex: 1,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  clearText: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 11,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  coordField: {
    flex: 1,
    minWidth: 0,
  },
  coordLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  coordInputWrap: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    height: 46,
    justifyContent: 'center',
  },
  coordInputWrapError: {
    borderColor: colors.error,
  },
  coordInput: {
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: '100%',
  },
  inputErrText: {
    ...typography.labelSmall,
    color: colors.error,
    fontSize: 10,
    marginTop: 2,
  },
  coordDivider: {
    paddingTop: 22,
    paddingHorizontal: 2,
  },
  coordDividerText: {
    ...typography.h2,
    color: colors.textMuted,
    lineHeight: 46,
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  confirmedText: {
    ...typography.labelSmall,
    color: colors.success,
    flex: 1,
  },
  noPinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  noPinText: {
    ...typography.labelSmall,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },

  // ── Active map ──────────────────────────────────────────
  mapWrap: {
    gap: spacing.sm,
  },
  map: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  mapActiveHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapActiveHintText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  doneBtnText: {
    ...typography.button,
    color: '#fff',
    fontSize: 15,
  },

  // ── Preview map (inactive) ──────────────────────────────
  previewWrap: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  previewMap: {
    borderRadius: radius.lg,
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radius.lg,
    zIndex: 2,
  },
  previewBadgeText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 13,
  },
});
