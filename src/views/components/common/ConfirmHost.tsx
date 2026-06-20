import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { DialogRequest, _setDialogListener } from '@/utils/confirm';
import { colors, radius, shadows, spacing, typography } from '@/views/styles/theme';

/**
 * Single global dialog host. Mount once at the app root. Renders a themed,
 * mobile-friendly confirm/alert that replaces the browser's native popups.
 */
export const ConfirmHost = () => {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  useEffect(() => {
    _setDialogListener(setRequest);
    return () => _setDialogListener(null);
  }, []);

  const close = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  const isAlert = request?.mode === 'alert';

  return (
    <Modal
      visible={!!request}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => close(false)} />
        <View style={styles.card}>
          {request?.title ? <Text style={styles.title}>{request.title}</Text> : null}
          {request?.message ? <Text style={styles.message}>{request.message}</Text> : null}

          <View style={[styles.actions, isAlert && styles.actionsSingle]}>
            {!isAlert && (
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} activeOpacity={0.8} onPress={() => close(false)}>
                <Text style={styles.cancelText}>{request?.cancelText || 'Cancel'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.btn,
                styles.confirmBtn,
                request?.destructive && styles.confirmBtnDestructive,
                isAlert && styles.confirmBtnFull,
              ]}
              activeOpacity={0.85}
              onPress={() => close(true)}
            >
              <Text style={styles.confirmText}>{request?.confirmText || 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.xl,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionsSingle: {
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.surfaceAlt,
  },
  cancelText: {
    ...typography.button,
    fontSize: 15,
    color: colors.text,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmBtnDestructive: {
    backgroundColor: colors.error,
  },
  confirmBtnFull: {
    flex: 0,
    paddingHorizontal: spacing.xl * 1.5,
    minWidth: 140,
  },
  confirmText: {
    ...typography.button,
    fontSize: 15,
    color: '#fff',
  },
});
