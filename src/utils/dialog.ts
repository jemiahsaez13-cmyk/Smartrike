import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm dialog.
 *
 * react-native-web ships `Alert.alert` as a no-op (`static alert() {}`), so the
 * native two-button confirm never appears and its onPress callbacks never run
 * on web. This bridges to `window.confirm` there and uses `Alert.alert` on
 * native, resolving to true when the user confirms.
 */
export const confirmDialog = (
  title: string,
  message?: string,
  options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): Promise<boolean> => {
  const confirmText = options?.confirmText ?? 'OK';
  const cancelText = options?.cancelText ?? 'Cancel';

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(text)
      : true;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: options?.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
};
