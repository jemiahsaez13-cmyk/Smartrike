import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Image } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchAllApplications, advanceApplication, patchApplication } from '@/controllers/slices/franchiseSlice';
import {
  FranchiseApplication,
  FranchiseDocument,
  FranchiseStatus,
  DocumentReviewStatus,
  FRANCHISE_STATUS_LABEL,
  DOCUMENT_REVIEW_LABEL,
  docReviewStatus,
  allDocumentsApproved,
  anyDocumentRejected,
  summarizeDocuments,
} from '@/models/entities/Franchise';
import { colors, spacing, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Card } from '@/views/components/common/Card';
import { confirm } from '@/utils/confirm';

const REVIEW_COLOR: Record<DocumentReviewStatus, string> = {
  pending: colors.warning,
  approved: colors.success,
  rejected: colors.error,
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const isHttp = (url?: string | null) => !!url && /^https?:\/\//i.test(url);

// Maps the current status to the next admin action.
const NEXT: Record<string, { label: string; status: FranchiseStatus; patch?: Partial<FranchiseApplication> }> = {
  submitted: { label: 'Start Verification', status: 'document_verification' },
  document_verification: { label: 'Approve Documents', status: 'inspection' },
  inspection: { label: 'Record Inspection: Pass', status: 'payment', patch: { inspection_result: 'passed' } },
  payment: { label: 'Confirm Payment', status: 'approved', patch: { payment_status: 'paid' } },
  approved: { label: 'Issue MTOP', status: 'issued' },
};

const STATUS_COLOR: Record<FranchiseStatus, string> = {
  submitted: colors.info,
  document_verification: colors.warning,
  inspection: colors.warning,
  payment: colors.warning,
  approved: colors.primary,
  issued: colors.success,
  rejected: colors.error,
};

export const FranchiseManagementScreen = () => {
  const dispatch = useAppDispatch();
  const { applications, loading } = useAppSelector((state) => state.franchise);
  const currentUser = useAppSelector((state) => state.auth.user);
  const [filter, setFilter] = useState<'all' | 'pending' | 'issued'>('all');
  // Derive the document-review modal target from the store so it auto-updates.
  const [reviewAppId, setReviewAppId] = useState<string | null>(null);
  const reviewApp = applications.find((a) => a.id === reviewAppId) ?? null;

  useEffect(() => {
    dispatch(fetchAllApplications());
  }, []);

  // Records an admin verdict for a single document and persists the documents
  // array. When every document is approved we stamp documents_verified_at.
  const setDocReview = (
    app: FranchiseApplication,
    docName: string,
    status: DocumentReviewStatus
  ) => {
    const documents: FranchiseDocument[] = app.documents.map((d) =>
      d.name === docName
        ? {
            ...d,
            review_status: status,
            review_remarks:
              status === 'rejected'
                ? 'Rejected by administrator — please re-upload a clear, valid copy.'
                : null,
          }
        : d
    );
    const patch: Partial<FranchiseApplication> = { documents };
    if (allDocumentsApproved(documents)) {
      patch.documents_verified_at = new Date().toISOString();
      patch.reviewed_by = currentUser?.id ?? null;
    } else {
      patch.documents_verified_at = null;
    }
    dispatch(patchApplication({ id: app.id, patch }));
  };

  // Bulk-approve every uploaded document at once.
  const approveAllDocs = (app: FranchiseApplication) => {
    const documents: FranchiseDocument[] = app.documents.map((d) =>
      d.uploaded ? { ...d, review_status: 'approved' as const, review_remarks: null } : d
    );
    dispatch(
      patchApplication({
        id: app.id,
        patch: {
          documents,
          documents_verified_at: allDocumentsApproved(documents)
            ? new Date().toISOString()
            : null,
          reviewed_by: currentUser?.id ?? null,
        },
      })
    );
  };

  const advance = async (app: FranchiseApplication) => {
    const next = NEXT[app.status];
    if (!next) return;
    // Gate: the "Approve Documents" step requires every document approved first.
    if (app.status === 'document_verification' && !allDocumentsApproved(app.documents)) {
      const open = await confirm(
        'Documents Not Verified',
        'You must review and approve all submitted documents before approving this stage. Open the document review now?',
        { confirmText: 'Review Documents' }
      );
      if (open) setReviewAppId(app.id);
      return;
    }
    if (next.status === 'issued') {
      const ok = await confirm('Issue MTOP', `Issue franchise certificate to ${app.driver_name}?`, {
        confirmText: 'Issue',
      });
      if (!ok) return;
    }
    const patch = { ...next.patch };
    if (next.status === 'issued') {
      patch.mtop_number = `MTOP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    dispatch(advanceApplication({ id: app.id, status: next.status, patch }));
  };

  const reject = async (app: FranchiseApplication) => {
    const ok = await confirm('Reject Application', `Reject ${app.driver_name}'s application?`, {
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;
    dispatch(
      advanceApplication({
        id: app.id,
        status: 'rejected',
        patch: { remarks: 'Rejected by administrator.' },
      })
    );
  };

  const filtered = applications.filter((a) => {
    if (filter === 'pending') return a.status !== 'issued' && a.status !== 'rejected';
    if (filter === 'issued') return a.status === 'issued';
    return true;
  });

  if (loading && applications.length === 0) return <Loading message="Loading applications..." />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Franchise / MTOP</Text>
        <Text style={styles.headerSub}>{applications.length} active requests</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filters}>
            <Chip selected={filter === 'all'} onPress={() => setFilter('all')} style={styles.chip} textStyle={styles.chipText} compact>All</Chip>
            <Chip selected={filter === 'pending'} onPress={() => setFilter('pending')} style={styles.chip} textStyle={styles.chipText} compact>Pending</Chip>
            <Chip selected={filter === 'issued'} onPress={() => setFilter('issued')} style={styles.chip} textStyle={styles.chipText} compact>Issued</Chip>
          </View>
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.resultCount}>SHOWING {filtered.length} APPLICATIONS</Text>
        {filtered.map((app) => {
          const next = NEXT[app.status];
          return (
            <Card key={app.id} variant="elevated" padding="md" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.driverInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{app.driver_name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.driverName}>{app.driver_name}</Text>
                    <Text style={styles.driverMeta}>
                      {app.plate_number} • {app.type === 'renewal' ? 'Renewal' : 'New'} • {app.toda}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[app.status] + '15' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[app.status] }]}>
                    {FRANCHISE_STATUS_LABEL[app.status]}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="file-document-outline" size={16} color={colors.textLight} />
                  <Text style={styles.metaText}>
                    {app.documents.filter((d) => d.uploaded).length}/{app.documents.length} docs
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={colors.textLight} />
                  <Text style={styles.metaText}>{app.inspection_result || 'pending'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="cash" size={16} color={colors.textLight} />
                  <Text style={[styles.metaText, typography.currency, { fontSize: 11 }]}>
                    {app.payment_status === 'paid' ? `₱${app.fees.toFixed(2)} paid` : `₱${app.fees.toFixed(2)} due`}
                  </Text>
                </View>
              </View>

              {(() => {
                const sum = summarizeDocuments(app.documents);
                const verified = allDocumentsApproved(app.documents);
                const rejected = anyDocumentRejected(app.documents);
                return (
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() => setReviewAppId(app.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={verified ? 'file-check' : rejected ? 'file-alert' : 'file-search'}
                      size={18}
                      color={verified ? colors.success : rejected ? colors.error : colors.primary}
                    />
                    <Text style={styles.reviewBtnText}>View Submitted Documents</Text>
                    <View
                      style={[
                        styles.reviewPill,
                        {
                          backgroundColor: verified
                            ? colors.successLight
                            : rejected
                            ? colors.errorLight
                            : colors.warningLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reviewPillText,
                          {
                            color: verified
                              ? colors.success
                              : rejected
                              ? colors.error
                              : colors.warning,
                          },
                        ]}
                      >
                        {verified
                          ? 'All approved'
                          : rejected
                          ? `${sum.rejected} rejected`
                          : `${sum.approved}/${sum.total} approved`}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                );
              })()}

              {app.mtop_number ? (
                <View style={styles.mtopRow}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />
                  <Text style={styles.mtopText}>{app.mtop_number}</Text>
                </View>
              ) : null}

              {next ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(app)} activeOpacity={0.8}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(app)} activeOpacity={0.8}>
                    <Text style={styles.advanceText}>{next.label}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.terminalContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.terminalNote}>
                    {app.status === 'issued' ? 'Franchise issued and active.' : 'Application closed.'}
                  </Text>
                </View>
              )}
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-search-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyText}>No applications in this view</Text>
          </View>
        )}
      </ScrollView>

      <DocumentReviewModal
        app={reviewApp}
        onClose={() => setReviewAppId(null)}
        onSetReview={setDocReview}
        onApproveAll={approveAllDocs}
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Document Review Modal — lets the admin inspect every submitted document and
// approve / reject each one before advancing the application.
// ─────────────────────────────────────────────────────────────────────────────
interface DocumentReviewModalProps {
  app: FranchiseApplication | null;
  onClose: () => void;
  onSetReview: (app: FranchiseApplication, docName: string, status: DocumentReviewStatus) => void;
  onApproveAll: (app: FranchiseApplication) => void;
}

const DocumentReviewModal = ({ app, onClose, onSetReview, onApproveAll }: DocumentReviewModalProps) => {
  const [preview, setPreview] = useState<FranchiseDocument | null>(null);

  if (!app) return null;
  const sum = summarizeDocuments(app.documents);
  const verified = allDocumentsApproved(app.documents);

  return (
    <Modal
      visible={!!app}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Submitted Documents</Text>
              <Text style={styles.modalSub}>
                {app.driver_name} • {app.plate_number} • {app.toda}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{sum.uploaded}/{sum.total}</Text>
              <Text style={styles.summaryLabel}>Uploaded</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: colors.success }]}>{sum.approved}</Text>
              <Text style={styles.summaryLabel}>Approved</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: colors.error }]}>{sum.rejected}</Text>
              <Text style={styles.summaryLabel}>Rejected</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: colors.warning }]}>{sum.pending}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {app.documents.map((doc) => {
              const status = docReviewStatus(doc);
              return (
                <View key={doc.name} style={styles.docReviewRow}>
                  <View style={styles.docReviewHeader}>
                    <TouchableOpacity
                      style={styles.docThumb}
                      activeOpacity={doc.uploaded ? 0.8 : 1}
                      onPress={() => doc.uploaded && setPreview(doc)}
                    >
                      {isHttp(doc.file_url) ? (
                        <Image source={{ uri: doc.file_url! }} style={styles.docThumbImg} resizeMode="cover" />
                      ) : (
                        <MaterialCommunityIcons
                          name={doc.uploaded ? 'file-document' : 'file-remove-outline'}
                          size={26}
                          color={doc.uploaded ? colors.primary : colors.textMuted}
                        />
                      )}
                    </TouchableOpacity>

                    <View style={styles.docReviewInfo}>
                      <Text style={styles.docReviewName}>{doc.name}</Text>
                      {doc.uploaded ? (
                        <Text style={styles.docReviewMeta}>
                          Uploaded {formatDate(doc.uploaded_at)}
                        </Text>
                      ) : (
                        <Text style={[styles.docReviewMeta, { color: colors.error }]}>Not submitted</Text>
                      )}
                      <View style={[styles.docStatusChip, { backgroundColor: REVIEW_COLOR[status] + '15' }]}>
                        <MaterialCommunityIcons
                          name={status === 'approved' ? 'check-circle' : status === 'rejected' ? 'close-circle' : 'clock-outline'}
                          size={12}
                          color={REVIEW_COLOR[status]}
                        />
                        <Text style={[styles.docStatusText, { color: REVIEW_COLOR[status] }]}>
                          {DOCUMENT_REVIEW_LABEL[status]}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {doc.uploaded && (
                    <TouchableOpacity style={styles.viewLink} onPress={() => setPreview(doc)} activeOpacity={0.7}>
                      <MaterialCommunityIcons name="eye-outline" size={15} color={colors.accent} />
                      <Text style={styles.viewLinkText}>View document</Text>
                    </TouchableOpacity>
                  )}

                  {status === 'rejected' && doc.review_remarks ? (
                    <Text style={styles.docRemark}>{doc.review_remarks}</Text>
                  ) : null}

                  {doc.uploaded && (
                    <View style={styles.docActions}>
                      <TouchableOpacity
                        style={[
                          styles.docActionBtn,
                          styles.docRejectBtn,
                          status === 'rejected' && styles.docRejectBtnActive,
                        ]}
                        onPress={() => onSetReview(app, doc.name, 'rejected')}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={status === 'rejected' ? '#fff' : colors.error}
                        />
                        <Text style={[styles.docRejectText, status === 'rejected' && { color: '#fff' }]}>
                          Reject
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.docActionBtn,
                          styles.docApproveBtn,
                          status === 'approved' && styles.docApproveBtnActive,
                        ]}
                        onPress={() => onSetReview(app, doc.name, 'approved')}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name="check"
                          size={16}
                          color={status === 'approved' ? '#fff' : colors.success}
                        />
                        <Text style={[styles.docApproveText, status === 'approved' && { color: '#fff' }]}>
                          Approve
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            {verified ? (
              <View style={styles.verifiedNote}>
                <MaterialCommunityIcons name="shield-check" size={18} color={colors.success} />
                <Text style={styles.verifiedText}>All documents verified.</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.approveAllBtn} onPress={() => onApproveAll(app)} activeOpacity={0.85}>
                <MaterialCommunityIcons name="check-all" size={18} color="#fff" />
                <Text style={styles.approveAllText}>Approve All Documents</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Full document preview */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreview(null)}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle} numberOfLines={1}>{preview?.name}</Text>
              <TouchableOpacity onPress={() => setPreview(null)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {isHttp(preview?.file_url) ? (
              <Image source={{ uri: preview!.file_url! }} style={styles.previewImg} resizeMode="contain" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialCommunityIcons name="file-document-outline" size={64} color={colors.primary} />
                <Text style={styles.previewPlaceholderTitle}>{preview?.name}</Text>
                <Text style={styles.previewPlaceholderMeta}>
                  Submitted {formatDate(preview?.uploaded_at)}
                </Text>
                <Text style={styles.previewPlaceholderHint}>
                  Scanned copy on file. Confirm the document is clear, valid, and matches the applicant before approving.
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  headerTitle: { 
    ...typography.h1,
    fontSize: 28,
  },
  headerSub: { 
    ...typography.body,
    fontSize: 14, 
    color: colors.textSecondary, 
    marginTop: 2,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  filterScroll: { 
    maxHeight: 52, 
    marginVertical: spacing.sm 
  },
  filters: { 
    flexDirection: 'row', 
    paddingHorizontal: spacing.screen, 
    gap: spacing.sm, 
    alignItems: 'center' 
  },
  chip: { 
    height: 32, 
    backgroundColor: colors.surfaceAlt, 
    borderRadius: radius.md,
    borderWidth: 0,
  },
  chipText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: 0,
    marginHorizontal: 4,
  },
  scroll: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 100 
  },
  resultCount: {
    ...typography.labelSmall,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    fontSize: 10,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: spacing.md 
  },
  driverInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h3,
    color: '#fff',
    fontSize: 16,
  },
  driverName: { 
    ...typography.label,
    fontSize: 15,
    color: colors.text 
  },
  driverMeta: { 
    ...typography.bodySmall,
    fontSize: 11, 
    color: colors.textSecondary, 
    marginTop: 2 
  },
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: radius.sm 
  },
  statusText: { 
    ...typography.labelSmall,
    fontSize: 9, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  metaRow: { 
    flexDirection: 'row', 
    gap: spacing.lg, 
    marginBottom: spacing.sm, 
    flexWrap: 'wrap' 
  },
  metaItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  metaText: { 
    ...typography.bodySmall,
    fontSize: 12, 
    color: colors.textSecondary, 
    textTransform: 'capitalize' 
  },
  mtopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginBottom: spacing.sm,
    backgroundColor: colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  mtopText: { 
    ...typography.labelSmall,
    fontSize: 11, 
    fontWeight: '800', 
    color: colors.success, 
    letterSpacing: 1 
  },
  actions: { 
    flexDirection: 'row', 
    gap: spacing.sm, 
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rejectBtn: {
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.error,
    justifyContent: 'center',
  },
  rejectText: { 
    ...typography.labelSmall,
    color: colors.error, 
    fontWeight: '800', 
    fontSize: 12 
  },
  advanceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  advanceText: { 
    ...typography.labelSmall,
    color: '#fff', 
    fontWeight: '800', 
    fontSize: 12 
  },
  terminalContainer: {
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  terminalNote: { 
    ...typography.bodySmall,
    fontSize: 12, 
    color: colors.textMuted, 
    fontStyle: 'italic', 
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2
  },
  emptyText: {
    ...typography.subtitle,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // ── Review Documents button (on each card) ──
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  reviewBtnText: {
    flex: 1,
    ...typography.label,
    fontSize: 13,
    color: colors.text,
  },
  reviewPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  reviewPillText: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    paddingBottom: spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 20,
  },
  modalSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.screen,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNum: {
    ...typography.h3,
    fontSize: 18,
    color: colors.text,
  },
  summaryLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  docReviewRow: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  docReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  docThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  docThumbImg: {
    width: '100%',
    height: '100%',
  },
  docReviewInfo: {
    flex: 1,
  },
  docReviewName: {
    ...typography.label,
    fontSize: 14,
    color: colors.text,
  },
  docReviewMeta: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  docStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: 6,
  },
  docStatusText: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  viewLinkText: {
    ...typography.labelSmall,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
  },
  docRemark: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  docActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  docActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  docRejectBtn: {
    borderColor: colors.error,
    backgroundColor: 'transparent',
  },
  docRejectBtnActive: {
    backgroundColor: colors.error,
  },
  docRejectText: {
    ...typography.labelSmall,
    fontWeight: '800',
    fontSize: 12,
    color: colors.error,
  },
  docApproveBtn: {
    borderColor: colors.success,
    backgroundColor: 'transparent',
  },
  docApproveBtnActive: {
    backgroundColor: colors.success,
  },
  docApproveText: {
    ...typography.labelSmall,
    fontWeight: '800',
    fontSize: 12,
    color: colors.success,
  },
  modalFooter: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  approveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  approveAllText: {
    ...typography.button,
    fontSize: 15,
    color: '#fff',
  },
  verifiedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
  },
  verifiedText: {
    ...typography.label,
    color: colors.success,
    fontWeight: '700',
  },

  // ── Full-screen document preview ──
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  previewCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  previewTitle: {
    ...typography.label,
    flex: 1,
    marginRight: spacing.md,
  },
  previewImg: {
    width: '100%',
    height: 360,
    backgroundColor: '#000',
  },
  previewPlaceholder: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  previewPlaceholderTitle: {
    ...typography.h3,
    fontSize: 16,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  previewPlaceholderMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },
  previewPlaceholderHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
