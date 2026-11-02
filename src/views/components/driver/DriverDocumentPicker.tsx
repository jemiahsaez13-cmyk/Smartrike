import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  DRIVER_DOCUMENT_TYPES,
  DriverDocument,
  DriverDocumentType,
} from '@/models/entities/DriverDocument';
import { pickImageDataUri } from '@/utils/pickImageDataUri';
import { notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

interface Props {
  /** Newly picked photos (data: URIs) keyed by document type. */
  values: Partial<Record<DriverDocumentType, string>>;
  onChange: (type: DriverDocumentType, uri: string) => void;
  /** Documents already on file; approved ones are locked. */
  existing?: DriverDocument[];
  disabled?: boolean;
  /** Document types to outline in red (missing on submit). */
  invalid?: DriverDocumentType[];
}

const REVIEW_META = {
  pending:  { label: 'Under review', color: '#8A5A00',      bg: colors.warningLight },
  approved: { label: 'Approved',     color: colors.success, bg: colors.successLight },
  rejected: { label: 'Rejected',     color: colors.error,   bg: colors.errorLight },
} as const;

/** One row per required document: label, review status and photo picker. */
export const DriverDocumentPicker = ({ values, onChange, existing = [], disabled, invalid = [] }: Props) => {
  const pick = async (type: DriverDocumentType) => {
    try {
      const uri = await pickImageDataUri();
      if (uri) onChange(type, uri);
    } catch (error: any) {
      void notify('Could not use photo', error?.message || 'Please choose another image.');
    }
  };

  return (
    <View style={styles.list}>
      {DRIVER_DOCUMENT_TYPES.map(({ type, label, hint }) => {
        const onFile = existing.find((d) => d.doc_type === type);
        const picked = values[type];
        const locked = onFile?.review_status === 'approved';
        const preview = picked || onFile?.file_url;
        const meta = onFile && !picked ? REVIEW_META[onFile.review_status] : null;
        return (
          <View key={type} style={[styles.row, invalid.includes(type) && styles.rowInvalid]}>
            <TouchableOpacity
              style={styles.thumb}
              onPress={() => pick(type)}
              disabled={disabled || locked}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${preview ? 'Replace' : 'Upload'} ${label}`}
            >
              {preview ? (
                <Image source={{ uri: preview }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.textMuted} />
              )}
            </TouchableOpacity>
            <View style={styles.copy}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.hint} numberOfLines={2}>{hint}</Text>
              {meta && (
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                </View>
              )}
              {onFile?.review_status === 'rejected' && !picked && !!onFile.review_remarks && (
                <Text style={styles.remarks}>{onFile.review_remarks}</Text>
              )}
            </View>
            {!locked && (
              <TouchableOpacity onPress={() => pick(type)} disabled={disabled} hitSlop={8}>
                <Text style={styles.action}>{preview ? 'Change' : 'Upload'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowInvalid: { borderColor: colors.error },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  copy: { flex: 1, minWidth: 0 },
  label: { ...typography.label, fontSize: 14, color: colors.text },
  hint: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { ...typography.labelSmall, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  remarks: { ...typography.bodySmall, fontSize: 12, color: colors.error, marginTop: 2 },
  action: { ...typography.label, fontSize: 13, color: colors.primary },
});
