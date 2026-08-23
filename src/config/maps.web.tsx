import React from 'react';
import { View } from 'react-native';

export const MapView: any = (props: any) => <View {...props} />;
export const Marker: any = (props: any) => <View {...props} />;
export const AnimatedMarker: any = Marker;
export const Polyline: any = (props: any) => <View {...props} />;
export const PROVIDER_GOOGLE = 'google';

// Lightweight web fallback so screens can share the native animated-marker
// code without pulling react-native-maps into the web bundle.
export class AnimatedRegion {
  private value: any;

  constructor(value: any) {
    this.value = value;
  }

  setValue(value: any) {
    this.value = value;
  }

  timing(value: any) {
    this.value = value;
    return { start: (callback?: () => void) => callback?.() };
  }
}

export default MapView;
