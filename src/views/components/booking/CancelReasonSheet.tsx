import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CANCELLATION_REASONS } from '@/config/constants';
import { colors, spacing, typography } from '@/views/styles/theme';

interface Props {
  visible: boolean;
  busy: boolean;
  /** Shown under the title, e.g. whether a driver will be notified. */
  subtitle: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/**
 * Passenger cancel dialog. A reason is required: cancellations without a
 * valid reason are counted for the TODA admin's review (migration 077).
 */
export const CancelReasonSheet = ({ visible, busy, subtitle, onConfirm, onClose }: Props) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!visible) {
      setReason('');
      setDetails('');
    }
  }, [visible]);

  const isOther = reason === 'Other';
  const finalReason = isOther ? (details.trim() ? `Other: ${details.trim()}` : '') : reason;
  const picked = CANCELLATION_REASONS.find((r) => r.label === reason);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <View style={styles.overlay}>
        <Surface style={styles.card} elevation={5}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="close-circle-outline" size={36} color={colors.error} />
          </View>
          <Text style={styles.title}>Cancel Ride</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <Text style={styles.label}>WHY ARE YOU CANCELLING?</Text>
          <View style={styles.reasonWrap}>
            {CANCELLATION_REASONS.map((r) => {
              const active = reason === r.label;
              return (
                <TouchableOpacity
                  key={r.label}
                  onPress={() => setReason(r.label)}
                  disabled={busy}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                >
                  <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isOther && (
            <TextInput
              placeholder="Tell us the reason"
              value={details}
              onChangeText={setDetails}
              style={styles.input}
              placeholderTextColor={colors.textLight}
              multiline
              maxLength={200}
              editable={!busy}
            />
          )}

          {picked && !picked.valid && (
            <Text style={styles.warning}>
              Cancellations without a valid reason are recorded. Repeated ones are reviewed by the TODA admin.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, (!finalReason || busy) && { opacity: 0.6 }]}
            onPress={() => finalReason && onConfirm(finalReason)}
            disabled={!finalReason || busy}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[colors.error, '#B91C1C']} style={styles.confirmGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.confirmText}>{busy ? 'Cancelling…' : 'Cancel Ride'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} disabled={busy} style={styles.keepBtn} activeOpacity={0.7}>
            <Text style={styles.keepText}>Keep Ride</Text>
          </TouchableOpacity>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl, alignItems: 'center' },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 22, color: colors.text },
  subtitle: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg, textAlign: 'center' },
  label: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md, justifyContent: 'center' },
  reasonChip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonChipActive: { backgroundColor: colors.errorLight, borderColor: colors.error },
  reasonChipText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
  reasonChipTextActive: { color: colors.error },
  input: {
    width: '100%',
    minHeight: 64,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    ...typography.body,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  warning: { ...typography.bodySmall, fontSize: 12, color: colors.error, textAlign: 'center', marginBottom: spacing.md, lineHeight: 18 },
  confirmBtn: { width: '100%', height: 52, borderRadius: 14, overflow: 'hidden' },
  confirmGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  confirmText: { ...typography.label, color: '#fff', fontSize: 16, letterSpacing: 0 },
  keepBtn: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  keepText: { ...typography.body, fontSize: 14, color: colors.textSecondary },
});
