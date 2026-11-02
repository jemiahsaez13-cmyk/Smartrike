import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DriverDocumentService } from '@/models/services/DriverDocumentService';
import { ActivityLogService } from '@/models/services/ActivityLogService';
import {
  DRIVER_DOCUMENT_LABEL,
  DRIVER_DOCUMENT_TYPES,
  DriverDocument,
  DriverDocumentType,
  DriverDocumentsStatus,
} from '@/models/entities/DriverDocument';
import { User } from '@/models/types';
import { formatDate } from '@/utils/dateUtils';
import { notify } from '@/utils/confirm';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const documentService = new DriverDocumentService();

/** Same rule as public.driver_documents_summary (migration 078). */
export const summarizeDriverDocuments = (docs: DriverDocument[]): DriverDocumentsStatus => {
  if (docs.some((d) => d.review_status === 'rejected')) return 'rejected';
  if (DRIVER_DOCUMENT_TYPES.some(({ type }) => !docs.find((d) => d.doc_type === type))) return 'missing';
  if (docs.every((d) => d.review_status === 'approved')) return 'approved';
  return 'pending';
};

const REVIEW_COLOR = { pending: colors.warning, approved: colors.success, rejected: colors.error } as const;
const REVIEW_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } as const;

interface Props {
  driver: User | null;
  onClose: () => void;
  /** Called after each verdict with the recomputed summary. */
  onChanged: (driverId: string, status: DriverDocumentsStatus) => void;
}

/** Admin review of a driver's registration documents (B1). */
export const DriverDocumentReviewModal = ({ driver, onClose, onChanged }: Props) => {
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [preview, setPreview] = useState<DriverDocument | null>(null);

  useEffect(() => {
    if (!driver) return;
    let alive = true;
    setDocs([]);
    setRejecting(null);
    setRemarks('');
    setLoading(true);
    documentService
      .listForDriver(driver.id)
      .then((rows) => alive && setDocs(rows))
      .catch((e: any) => notify('Could not load documents', e?.message || 'Please try again.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [driver?.id]);

  const review = async (doc: DriverDocument, status: 'approved' | 'rejected') => {
    if (!driver) return;
    if (status === 'rejected' && !remarks.trim()) {
      notify('Reason required', 'Tell the driver why this photo was rejected, e.g. "Blurry, plate number not readable".');
      return;
    }
    setBusyId(doc.id);
    try {
      const updated = await documentService.review(doc.id, status, status === 'rejected' ? remarks : undefined);
      const next = docs.map((d) => (d.id === doc.id ? updated : d));
      setDocs(next);
      setRejecting(null);
      setRemarks('');
      onChanged(driver.id, summarizeDriverDocuments(next));
      void ActivityLogService.logActivity({
        action_type: 'driver_status_changed',
        entity_type: 'driver',
        entity_id: driver.id,
        description:
          status === 'approved'
            ? `Admin approved ${DRIVER_DOCUMENT_LABEL[doc.doc_type]} of driver ${driver.name}.`
            : `Admin rejected ${DRIVER_DOCUMENT_LABEL[doc.doc_type]} of driver ${driver.name}: ${remarks.trim()}`,
        severity: status === 'approved' ? 'success' : 'warning',
      });
    } catch (e: any) {
      notify('Review failed', e?.message || 'Could not save the review.');
    } finally {
      setBusyId(null);
    }
  };

  const address = (driver as any)?.home_address as string | null | undefined;

  return (
    <Modal visible={!!driver} transparent animationType="slide" onRequestClose={() => !busyId && onClose()}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !busyId && onClose()}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="file-document-check-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Driver Documents</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{driver?.name}</Text>
            </View>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>RESIDENTIAL ADDRESS</Text>
            <Text style={styles.address}>{address?.trim() || 'Not provided'}</Text>

            <Text style={styles.label}>DOCUMENTS</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : (
              DRIVER_DOCUMENT_TYPES.map(({ type, label }) => {
                const doc = docs.find((d) => d.doc_type === (type as DriverDocumentType));
                if (!doc) {
                  return (
                    <View key={type} style={styles.docRow}>
                      <View style={styles.docHeader}>
                        <View style={styles.thumb}>
                          <MaterialCommunityIcons name="file-remove-outline" size={24} color={colors.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docName}>{label}</Text>
                          <Text style={[styles.docMeta, { color: colors.error }]}>Not submitted</Text>
                        </View>
                      </View>
                    </View>
                  );
                }
                const color = REVIEW_COLOR[doc.review_status];
                const busy = busyId === doc.id;
                return (
                  <View key={type} style={styles.docRow}>
                    <View style={styles.docHeader}>
                      <TouchableOpacity style={styles.thumb} onPress={() => setPreview(doc)} activeOpacity={0.8}>
                        <Image source={{ uri: doc.file_url }} style={styles.thumbImg} resizeMode="cover" />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docName}>{label}</Text>
                        <Text style={styles.docMeta}>Uploaded {formatDate(doc.uploaded_at)}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: color + '18' }]}>
                        <MaterialCommunityIcons
                          name={doc.review_status === 'approved' ? 'check-circle' : doc.review_status === 'rejected' ? 'close-circle' : 'clock-outline'}
                          size={12}
                          color={color}
                        />
                        <Text style={[styles.pillText, { color }]}>{REVIEW_LABEL[doc.review_status]}</Text>
                      </View>
                    </View>

                    {doc.review_status === 'rejected' && !!doc.review_remarks && (
                      <Text style={styles.remark}>{doc.review_remarks}</Text>
                    )}

                    {rejecting === doc.id && (
                      <RNTextInput
                        style={styles.remarksInput}
                        placeholder="Reason the driver will see, e.g. blurry photo"
                        placeholderTextColor={colors.textMuted}
                        value={remarks}
                        onChangeText={setRemarks}
                        multiline
                        maxLength={300}
                        editable={!busy}
                        autoFocus
                      />
                    )}

                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.viewBtn} onPress={() => setPreview(doc)} activeOpacity={0.75}>
                        <MaterialCommunityIcons name="eye-outline" size={16} color={colors.primary} />
                        <Text style={styles.viewText}>View</Text>
                      </TouchableOpacity>
                      {busy ? (
                        <View style={styles.busyRow}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.busyText}>Saving…</Text>
                        </View>
                      ) : rejecting === doc.id ? (
                        <>
                          <TouchableOpacity
                            style={[styles.verdictBtn, styles.cancelBtn]}
                            onPress={() => { setRejecting(null); setRemarks(''); }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.cancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.verdictBtn, styles.rejectBtn, styles.rejectBtnActive]}
                            onPress={() => review(doc, 'rejected')}
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="close" size={15} color="#fff" />
                            <Text style={[styles.rejectText, { color: '#fff' }]}>Confirm Reject</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          {doc.review_status !== 'rejected' && (
                            <TouchableOpacity
                              style={[styles.verdictBtn, styles.rejectBtn, !!busyId && styles.disabled]}
                              onPress={() => { setRejecting(doc.id); setRemarks(''); }}
                              disabled={!!busyId}
                              activeOpacity={0.8}
                            >
                              <MaterialCommunityIcons name="close" size={15} color={colors.error} />
                              <Text style={styles.rejectText}>Reject</Text>
                            </TouchableOpacity>
                          )}
                          {doc.review_status !== 'approved' && (
                            <TouchableOpacity
                              style={[styles.verdictBtn, styles.approveBtn, !!busyId && styles.disabled]}
                              onPress={() => review(doc, 'approved')}
                              disabled={!!busyId}
                              activeOpacity={0.8}
                            >
                              <MaterialCommunityIcons name="check" size={15} color={colors.success} />
                              <Text style={styles.approveText}>Approve</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            <Text style={styles.hint}>
              The driver is notified of each rejection with your reason and can upload a new photo. Verify the driver from the user actions once all four are approved.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} disabled={!!busyId} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Full document preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreview(null)}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {preview ? DRIVER_DOCUMENT_LABEL[preview.doc_type] : ''}
            </Text>
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </View>
          {preview && <Image source={{ uri: preview.file_url }} style={styles.previewImg} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h3, fontSize: 18 },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  scroll: { flexGrow: 0 },
  label: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, letterSpacing: 1, marginBottom: 6, marginTop: spacing.sm },
  address: { ...typography.body, fontSize: 14, color: colors.text, marginBottom: spacing.sm },
  docRow: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  docName: { ...typography.label, fontSize: 14, color: colors.text },
  docMeta: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  pillText: { ...typography.labelSmall, fontSize: 10 },
  remark: { ...typography.bodySmall, fontSize: 12, color: colors.error, marginTop: spacing.sm },
  remarksInput: {
    ...typography.body,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, marginRight: 'auto' },
  viewText: { ...typography.label, fontSize: 13, color: colors.primary },
  verdictBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rejectBtn: { borderColor: colors.error, backgroundColor: colors.surface },
  rejectBtnActive: { backgroundColor: colors.error },
  rejectText: { ...typography.label, fontSize: 13, color: colors.error },
  approveBtn: { borderColor: colors.success, backgroundColor: colors.surface },
  approveText: { ...typography.label, fontSize: 13, color: colors.success },
  cancelBtn: { borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  disabled: { opacity: 0.5 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  busyText: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  hint: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
  closeBtn: { height: 50, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  closeText: { ...typography.button, fontSize: 15, color: colors.text },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: spacing.md },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  previewTitle: { ...typography.label, fontSize: 16, color: '#fff', flex: 1 },
  previewImg: { width: '100%', height: '80%' },
});
