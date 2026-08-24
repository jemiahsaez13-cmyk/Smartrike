/**
 * MapPinPicker — web / Expo Go (OpenStreetMap tile-based, no react-native-maps)
 *
 * Layout identical to the native version:
 *   1. Coordinate inputs (ALWAYS visible at top, auto-filled on map tap)
 *   2. Interactive OSM tile map (tap to place, drag marker to fine-tune)
 *
 * Both stay in sync: tap map → fills inputs; type in inputs → map pans.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';
export type { MapPinPickerProps, PinCoordinate } from './MapPinPicker.types';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

// ── Mercator helpers ─────────────────────────────────────────
const TILE = 256;
const BOAC: PinCoordinate = { latitude: 13.4452, longitude: 121.8401 };

const project = (pt: PinCoordinate, zoom: number) => {
  const scale = 2 ** zoom;
  const sin = Math.sin((pt.latitude * Math.PI) / 180);
  return {
    x: ((pt.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
};

const unproject = (x: number, y: number, zoom: number): PinCoordinate => {
  const scale = 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    latitude: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    longitude: (x / scale) * 360 - 180,
  };
};

const isValidLat = (v: number) => !isNaN(v) && v >= -90 && v <= 90;
const isValidLng = (v: number) => !isNaN(v) && v >= -180 && v <= 180;
const fmt = (n: number) => n.toFixed(6);

// ── Component ────────────────────────────────────────────────
export const MapPinPicker = ({
  value,
  onChange,
  initialCenter = BOAC,
  height = 260,
}: MapPinPickerProps) => {
  const [zoom, setZoom] = useState(16);
  const [mapSize, setMapSize] = useState({ width: 360, height });

  // Dragging state
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ px: number; py: number; lat: number; lng: number } | null>(null);

  // The map always centres on value (or initialCenter when no pin yet).
  // We track the "display centre" separately so panning works smoothly.
  const [displayCenter, setDisplayCenter] = useState<PinCoordinate>(value ?? initialCenter);

  // Coordinate text inputs
  const [latText, setLatText] = useState(value ? fmt(value.latitude) : '');
  const [lngText, setLngText] = useState(value ? fmt(value.longitude) : '');

  // Sync inputs when value changes from outside (form reset etc.)
  const prevRef = useRef<PinCoordinate | null>(value ?? null);
  useEffect(() => {
    const prev = prevRef.current;
    if (value?.latitude !== prev?.latitude || value?.longitude !== prev?.longitude) {
      setLatText(value ? fmt(value.latitude) : '');
      setLngText(value ? fmt(value.longitude) : '');
      if (value) setDisplayCenter(value);
      prevRef.current = value ?? null;
    }
  }, [value?.latitude, value?.longitude]);

  const centerWorld = project(displayCenter, zoom);
  const leftWorld = centerWorld.x - mapSize.width / TILE / 2;
  const topWorld = centerWorld.y - mapSize.height / TILE / 2;

  const tiles = useMemo(() => {
    const cx = Math.floor(centerWorld.x);
    const cy = Math.floor(centerWorld.y);
    return [-2, -1, 0, 1, 2].flatMap((dy) =>
      [-2, -1, 0, 1, 2].map((dx) => ({ x: cx + dx, y: cy + dy }))
    );
  }, [Math.floor(centerWorld.x), Math.floor(centerWorld.y), zoom]);

  // Pixel position of pin on map
  const pinPixel = value
    ? {
        x: (project(value, zoom).x - leftWorld) * TILE,
        y: (project(value, zoom).y - topWorld) * TILE,
      }
    : null;

  const onLayout = (e: LayoutChangeEvent) =>
    setMapSize({ width: e.nativeEvent.layout.width, height });

  // Commit a new coordinate from map interaction
  const commitCoord = (coord: PinCoordinate) => {
    setLatText(fmt(coord.latitude));
    setLngText(fmt(coord.longitude));
    setDisplayCenter(coord);
    onChange(coord);
  };

  // Tap on map to place pin
  const handleMapPress = (e: any) => {
    if (dragging) return;
    const x = leftWorld + e.nativeEvent.locationX / TILE;
    const y = topWorld + e.nativeEvent.locationY / TILE;
    commitCoord(unproject(x, y, zoom));
  };

  // Drag marker
  const handleMarkerPressIn = (e: any) => {
    if (!value) return;
    setDragging(true);
    dragStartRef.current = {
      px: e.nativeEvent.pageX,
      py: e.nativeEvent.pageY,
      lat: value.latitude,
      lng: value.longitude,
    };
  };

  const handleMarkerMove = (e: any) => {
    if (!dragging || !dragStartRef.current || !value) return;
    const dx = (e.nativeEvent.pageX - dragStartRef.current.px) / TILE;
    const dy = (e.nativeEvent.pageY - dragStartRef.current.py) / TILE;
    const baseWorld = project(
      { latitude: dragStartRef.current.lat, longitude: dragStartRef.current.lng },
      zoom
    );
    const newCoord = unproject(baseWorld.x + dx, baseWorld.y + dy, zoom);
    setLatText(fmt(newCoord.latitude));
    setLngText(fmt(newCoord.longitude));
    setDisplayCenter(newCoord);
    onChange(newCoord);
  };

  const handleMarkerPressOut = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  // Lat input blur
  const onLatBlur = () => {
    const n = parseFloat(latText);
    if (isValidLat(n)) {
      const coord: PinCoordinate = {
        latitude: n,
        longitude: value?.longitude ?? initialCenter.longitude,
      };
      setLatText(fmt(n));
      setLngText(fmt(coord.longitude));
      setDisplayCenter(coord);
      onChange(coord);
    } else {
      setLatText(value ? fmt(value.latitude) : '');
    }
  };

  // Lng input blur
  const onLngBlur = () => {
    const n = parseFloat(lngText);
    if (isValidLng(n)) {
      const coord: PinCoordinate = {
        latitude: value?.latitude ?? initialCenter.latitude,
        longitude: n,
      };
      setLatText(fmt(coord.latitude));
      setLngText(fmt(n));
      setDisplayCenter(coord);
      onChange(coord);
    } else {
      setLngText(value ? fmt(value.longitude) : '');
    }
  };

  const latError = latText !== '' && isNaN(parseFloat(latText));
  const lngError = lngText !== '' && isNaN(parseFloat(lngText));

  return (
    <View style={styles.root}>

      {/* ══════════════════════════════════════════════════════
          COORDINATE INPUTS — always visible, auto-filled by map
      ══════════════════════════════════════════════════════ */}
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
            >
              <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.textMuted} />
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
            {latError ? <Text style={styles.inputErrText}>–90 to 90</Text> : null}
          </View>

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
            {lngError ? <Text style={styles.inputErrText}>–180 to 180</Text> : null}
          </View>
        </View>

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
              No pin set — tap the map below or type coordinates above
            </Text>
          </View>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════
          OSM TILE MAP — tap to place pin, drag marker to adjust
      ══════════════════════════════════════════════════════ */}
      <View style={[styles.map, { height }]} onLayout={onLayout}>
        {/* Tiles */}
        {tiles.map((tile) => (
          <Image
            key={`${zoom}-${tile.x}-${tile.y}`}
            source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }}
            style={{
              position: 'absolute',
              width: TILE,
              height: TILE,
              left: (tile.x - leftWorld) * TILE,
              top: (tile.y - topWorld) * TILE,
            }}
          />
        ))}

        {/* Tap overlay to place pin */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleMapPress}
          activeOpacity={1}
          accessibilityLabel="Tap to place pin"
        />

        {/* Pin marker — draggable */}
        {pinPixel ? (
          <View
            style={[styles.markerWrap, { left: pinPixel.x - 18, top: pinPixel.y - 38 }]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleMarkerPressIn}
            onResponderMove={handleMarkerMove}
            onResponderRelease={handleMarkerPressOut}
            onResponderTerminate={handleMarkerPressOut}
          >
            <MaterialCommunityIcons name="map-marker" size={38} color={colors.error} />
          </View>
        ) : null}

        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.min(18, z + 1))}
            accessibilityLabel="Zoom in"
          >
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.max(10, z - 1))}
            accessibilityLabel="Zoom out"
          >
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>

        {/* Attribution */}
        <View style={styles.credit}>
          <Text style={styles.creditText}>© OpenStreetMap</Text>
        </View>
      </View>

      {/* Hint */}
      <View style={styles.hint}>
        <MaterialCommunityIcons name="gesture-tap" size={15} color={colors.primary} />
        <Text style={styles.hintText}>
          Tap the map to place the pin · Drag the marker to fine-tune
        </Text>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  // ── Coord card ──
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
    paddingTop: 20,
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
  // ── Map ──
  map: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    position: 'relative',
  },
  markerWrap: {
    position: 'absolute',
    width: 38,
    height: 38,
    zIndex: 10,
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    gap: 4,
    zIndex: 5,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomText: {
    ...typography.h2,
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
  },
  credit: {
    position: 'absolute',
    right: 4,
    bottom: 3,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
  },
  creditText: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  // ── Hint ──
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});
