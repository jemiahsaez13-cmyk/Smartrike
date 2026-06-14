import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { colors } from '@/views/styles/theme';

interface TricycleIconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
}

// Philippine tricycle (motorcycle + sidecar) artwork rendered as a recolorable
// template image. The asset is a white silhouette on transparency, so any
// `color` can be applied via tintColor (e.g. white on gradients). `size` is the
// width; height keeps the artwork's aspect ratio so it fills the frame instead
// of shrinking inside a square.
const ASPECT = 1.26; // width / height of the cropped asset

export const TricycleIcon: React.FC<TricycleIconProps> = ({
  size = 32,
  color = colors.primary,
  style,
}) => (
  <Image
    source={require('../../../../assets/tricycle.png')}
    resizeMode="contain"
    style={[{ width: size, height: Math.round(size / ASPECT), tintColor: color }, style]}
  />
);
