import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const pickImageDataUri = async (): Promise<string | null> => {
  // On web launch the picker directly within the click gesture. Awaiting a
  // permission request first can make browsers block the file dialog.
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Photo access is required to choose an image.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.72,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error('The selected image could not be read.');
  // Validate the returned bytes, not the original file size or MIME metadata:
  // native image picking can re-encode the selected image as JPEG.
  const bytes = asset.base64;
  if (Math.floor(bytes.length * 3 / 4) > 2_500_000) throw new Error('Choose an image under 2.5 MB.');
  const mime = bytes.startsWith('/9j/') ? 'image/jpeg'
    : bytes.startsWith('iVBORw0KGgo') ? 'image/png'
    : bytes.startsWith('UklGR') && bytes.slice(11, 16) === 'XRUJQ' ? 'image/webp' : null;
  if (!mime) throw new Error('Choose a JPEG, PNG, or WebP image.');
  return `data:${mime};base64,${asset.base64}`;
};
