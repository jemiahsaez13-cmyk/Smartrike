import * as ImagePicker from 'expo-image-picker';

export const pickImageDataUri = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo access is required to choose an image.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.72,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if ((asset.fileSize ?? 0) > 2_500_000) throw new Error('Choose an image under 2.5 MB.');
  if (!asset.base64) throw new Error('The selected image could not be read.');
  const mime = asset.mimeType && /image\/(jpeg|jpg|png|webp)/i.test(asset.mimeType)
    ? asset.mimeType.toLowerCase()
    : 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
};
