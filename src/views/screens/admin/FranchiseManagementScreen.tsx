import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchAllApplications, advanceApplication, patchApplication, reviewFranchisePayment } from '@/controllers/slices/franchiseSlice';
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
import { confirm, notify } from '@/utils/confirm';
import { MtopBillingModal } from '@/views/components/payment/MtopBillingModal';
import { AdminMtopPaymentMethod } from '@/models/entities/AdminMtopPaymentMethod';

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

// Previewable in an <Image>: hosted URLs and on-device picked images
// (data URIs). PDFs fall back to the "submitted" placeholder card.
const isHttp = (url?: string | null) => !!url && (/^https?:\/\//i.test(url) || /^data:image\//i.test(url));

// Maps the current status to the next admin action.
const NEXT: Record<string, { label: string; status: FranchiseStatus; patch?: Partial<FranchiseApplication> }> = {
  submitted: { label: 'Start Verification', status: 'document_verification' },
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

// Shared choice-chip design (matches TripHistory / Earnings filters).
const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const FranchiseManagementScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { applications, loading } = useAppSelector((state) => state.franchise);
  const currentUser = useAppSelector((state) => state.auth.user);
  const [filter, setFilter] = useState<'all' | 'pending' | 'issued'>('all');
  // Derive the document-review modal target from the store so it auto-updates.
  const [reviewAppId, setReviewAppId] = useState<string | null>(null);
  const reviewApp = applications.find((a) => a.id === reviewAppId) ?? null;
  // In-flight guards: exactly one document verdict (or bulk approve) at a
  // time, awaited to completion — rapid taps used to race each other with
  // stale document arrays and silently revert earlier verdicts.
  const [docBusy, setDocBusy] = useState<string | null>(null); // doc name or '*all*'
  const [actionBusy, setActionBusy] = useState<string | null>(null); // app id
  const [paymentPreview, setPaymentPreview] = useState<string | null>(null);
  // Billing modal
  const [billingApp, setBillingApp] = useState<FranchiseApplication | null>(null);

  useEffect(() => {
    dispatch(fetchAllApplications());
  }, []);

  // Records an admin verdict for a single document and persists the documents
  // array. Awaited + serialized so verdicts can't clobber one another; the
  // busy row shows a spinner until the write lands in the store.
  const setDocReview = async (
    app: FranchiseApplication,
    docName: string,
    status: DocumentReviewStatus
  ) => {
    if (docBusy || app.documents_verified_at) return;
    setDocBusy(docName);
    try {
      if (app.status === 'submitted') {
        await dispatch(advanceApplication({ id: app.id, status: 'document_verification' })).unwrap();
      }
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
        patch.status = 'payment';
      } else {
        patch.documents_verified_at = null;
      }
      await dispatch(patchApplication({ id: app.id, patch })).unwrap();
    } catch {
      notify('Update failed', 'Could not save the document verdict. Please try again.');
    } finally {
      setDocBusy(null);
    }
  };

  // Bulk-approve every uploaded document at once.
  const approveAllDocs = async (app: FranchiseApplication) => {
    if (docBusy || app.documents_verified_at) return;
    setDocBusy('*all*');
    try {
      if (app.status === 'submitted') {
        await dispatch(advanceApplication({ id: app.id, status: 'document_verification' })).unwrap();
      }
      const documents: FranchiseDocument[] = app.documents.map((d) =>
        d.uploaded ? { ...d, review_status: 'approved' as const, review_remarks: null } : d
      );
      await dispatch(
        patchApplication({
          id: app.id,
          patch: {
            documents,
            documents_verified_at: allDocumentsApproved(documents)
              ? new Date().toISOString()
              : null,
            reviewed_by: currentUser?.id ?? null,
            status: allDocumentsApproved(documents) ? 'payment' : app.status,
          },
        })
      ).unwrap();
    } catch {
      notify('Update failed', 'Could not approve the documents. Please try again.');
    } finally {
      setDocBusy(null);
    }
  };

  const advance = async (app: FranchiseApplication) => {
    const next = NEXT[app.status];
    if (!next) return;
    if (next.status === 'issued') {
      const ok = await confirm('Issue MTOP', `Issue franchise certificate to ${app.driver_name}?`, {
        confirmText: 'Issue',
      });
      if (!ok) return;
    }
    const patch = { ...next.patch };
    if (next.status === 'issued') {
      patch.mtop_number = `MTOP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      patch.franchise_status = 'active';
      patch.original_holder_name = app.driver_name;
      patch.current_holder_name = app.driver_name;
      patch.issued_at = new Date().toISOString().slice(0, 10);
    }
    setActionBusy(app.id);
    try {
      await dispatch(advanceApplication({ id: app.id, status: next.status, patch })).unwrap();
    } catch {
      notify('Update failed', 'Could not advance the application. Please try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const reject = async (app: FranchiseApplication) => {
    if (app.documents_verified_at || allDocumentsApproved(app.documents) || ['payment', 'approved', 'issued'].includes(app.status)) {
      await notify('Decline unavailable', 'Required files were already confirmed. This application is locked against decline.');
      return;
    }
    const ok = await confirm('Reject Application', `Reject ${app.driver_name}'s application?`, {
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;
    setActionBusy(app.id);
    try {
      await dispatch(
        advanceApplication({
          id: app.id,
          status: 'rejected',
          patch: { remarks: 'Rejected by administrator.' },
        })
      ).unwrap();
    } catch {
      notify('Update failed', 'Could not reject the application. Please try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const reviewPayment = async (app: FranchiseApplication, decision: 'verified' | 'rejected') => {
    const okay = await confirm(
      decision === 'verified' ? 'Verify MTOP payment?' : 'Reject payment proof?',
      decision === 'verified'
        ? `Confirm ₱${Number(app.fees).toFixed(2)} with reference ${app.payment_reference}.`
        : 'The registrant will be able to upload corrected proof.',
      { confirmText: decision === 'verified' ? 'Verify Payment' : 'Reject Proof', destructive: decision === 'rejected' }
    );
    if (!okay) return;
    setActionBusy(app.id);
    try {
      await dispatch(reviewFranchisePayment({
        id: app.id,
        decision,
        reason: decision === 'rejected' ? 'Payment screenshot or reference could not be validated.' : undefined,
      })).unwrap();
      await notify(decision === 'verified' ? 'Payment verified' : 'Payment proof rejected', decision === 'verified' ? 'The application is now approved and ready for MTOP issuance.' : 'The registrant can submit corrected proof.');
    } catch (error: any) {
      await notify('Review failed', typeof error === 'string' ? error : error?.message || 'Please refresh and try again.');
    } finally { setActionBusy(null); }
  };

  const handleSendBilling = async (
    app: FranchiseApplication,
    method: AdminMtopPaymentMethod
  ) => {
    setBillingApp(null);
    const methodLabel =
      method.method_type === 'face_to_face'
        ? `Face-to-Face at ${method.address || method.display_name}`
        : `${method.display_name} (${method.account_number})`;
    await notify(
      'Billing Sent',
      `Billing for ₱${Number(app.fees).toFixed(2)} sent to ${app.driver_name} via ${methodLabel}.`
    );
  };

  const filtered = applications.filter((a) => {
    if (filter === 'pending') return a.status !== 'issued' && a.status !== 'rejected';
    if (filter === 'issued') return a.status === 'issued';
    return true;
  });

  if (loading && applications.length === 0) return <Loading message="Loading applications..." />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Franchise / MTOP</Text>
          <Text style={styles.headerSub}>{applications.length} application records</Text>
        </View>
        <TouchableOpacity
          style={styles.registryBtn}
          onPress={() => navigation.navigate('FranchiseRegistry')}
          accessibilityLabel="Open issued franchise registry"
          activeOpacity={0.78}
        >
          <MaterialCommunityIcons name="book-open-variant" size={20} color="#fff" />
          <Text style={styles.registryBtnText}>Registry</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filters}>
            <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label="Pending" active={filter === 'pending'} onPress={() => setFilter('pending')} />
            <FilterChip label="Issued" active={filter === 'issued'} onPress={() => setFilter('issued')} />
          </View>
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.resultCount}>SHOWING {filtered.length} APPLICATIONS</Text>
        {filtered.map((app) => {
          const next = NEXT[app.status];
          const canReject = !app.documents_verified_at && !allDocumentsApproved(app.documents)
            && (app.status === 'submitted' || app.status === 'document_verification');
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
                  <Text style={styles.metaText}>
                    {app.status === 'issued' || app.status === 'approved'
                      ? 'docs verified'
                      : app.status === 'payment'
                      ? 'docs verified'
                      : app.inspection_result && app.inspection_result !== 'pending'
                      ? app.inspection_result
                      : 'pending'}
                  </Text>
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

              {app.status === 'payment' ? (
                <View style={styles.paymentReviewCard}>
                  <View style={styles.paymentReviewHead}><MaterialCommunityIcons name="receipt-text-check-outline" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={styles.paymentReviewTitle}>MTOP Payment</Text><Text style={styles.paymentReviewSub}>{app.payment_review_status === 'pending_review' ? 'Proof submitted for review' : app.payment_review_status === 'rejected' ? 'Waiting for corrected proof' : 'Waiting for registrant payment'}</Text></View></View>
                  {app.payment_reference ? <View style={styles.paymentReferenceRow}><Text style={styles.paymentReferenceLabel}>REFERENCE</Text><Text selectable style={styles.paymentReference}>{app.payment_reference}</Text></View> : null}
                  {app.payment_proof_url ? <TouchableOpacity style={styles.viewPaymentProof} onPress={() => setPaymentPreview(app.payment_proof_url!)}><MaterialCommunityIcons name="image-search-outline" size={18} color={colors.primary} /><Text style={styles.viewPaymentProofText}>View payment screenshot</Text></TouchableOpacity> : null}
                  {app.payment_review_status === 'pending_review' ? <View style={styles.paymentActions}><TouchableOpacity style={styles.paymentReject} onPress={() => reviewPayment(app, 'rejected')} disabled={actionBusy === app.id}><Text style={styles.paymentRejectText}>Reject Proof</Text></TouchableOpacity><TouchableOpacity style={styles.paymentVerify} onPress={() => reviewPayment(app, 'verified')} disabled={actionBusy === app.id}>{actionBusy === app.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.paymentVerifyText}>Verify Payment</Text>}</TouchableOpacity></View> : null}
                  {/* Send Billing button — shown when the applicant hasn't submitted proof yet */}
                  {(app.payment_review_status === 'awaiting_submission' || !app.payment_review_status || app.payment_review_status === 'rejected') ? (
                    <View>
                      <View style={styles.billingIssueNote}>
                        <MaterialCommunityIcons name="information-outline" size={15} color={colors.primary} />
                        <Text style={styles.billingIssueText}>
                          Sending billing will notify the applicant which payment method to use. Make sure at least one billing method is configured under Account → MTOP Billing Methods.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.sendBillingBtn}
                        onPress={() => setBillingApp(app)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="send-outline" size={18} color={colors.primary} />
                        <Text style={styles.sendBillingText}>Send Billing</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {next || canReject ? (
                <View style={styles.actions}>
                  {canReject ? <TouchableOpacity
                    style={[styles.rejectBtn, actionBusy === app.id && { opacity: 0.5 }]}
                    onPress={() => reject(app)}
                    disabled={actionBusy === app.id}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity> : null}
                  {next ? <TouchableOpacity
                    style={[styles.advanceBtn, actionBusy === app.id && { opacity: 0.7 }]}
                    onPress={() => advance(app)}
                    disabled={actionBusy === app.id}
                    activeOpacity={0.8}
                  >
                    {actionBusy === app.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.advanceText}>{next.label}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity> : null}
                </View>
              ) : app.status === 'payment' ? null : (
                <View style={styles.terminalContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.terminalNote}>
                    {app.status === 'issued' ? 'MTOP issued. Manage its operational status in the Registry.' : 'Application closed.'}
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
        busyDoc={docBusy}
        onClose={() => setReviewAppId(null)}
        onSetReview={setDocReview}
        onApproveAll={approveAllDocs}
      />
      <MtopBillingModal
        visible={!!billingApp}
        application={billingApp}
        onConfirm={handleSendBilling}
        onClose={() => setBillingApp(null)}
      />
      <Modal visible={!!paymentPreview} transparent animationType="fade" onRequestClose={() => setPaymentPreview(null)}><TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPaymentPreview(null)}>{paymentPreview ? <Image source={{ uri: paymentPreview }} style={styles.paymentPreviewImage} resizeMode="contain" /> : null}<TouchableOpacity style={styles.paymentPreviewClose} onPress={() => setPaymentPreview(null)}><MaterialCommunityIcons name="close" size={26} color="#fff" /></TouchableOpacity></TouchableOpacity></Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Document Review Modal — lets the admin inspect every submitted document and
// approve / reject each one before advancing the application.
// ─────────────────────────────────────────────────────────────────────────────
interface DocumentReviewModalProps {
  app: FranchiseApplication | null;
  /** Name of the document with a verdict in flight ('*all*' for bulk). */
  busyDoc: string | null;
  onClose: () => void;
  onSetReview: (app: FranchiseApplication, docName: string, status: DocumentReviewStatus) => void;
  onApproveAll: (app: FranchiseApplication) => void;
}

const DocumentReviewModal = ({ app, busyDoc, onClose, onSetReview, onApproveAll }: DocumentReviewModalProps) => {
  const [preview, setPreview] = useState<FranchiseDocument | null>(null);

  if (!app) return null;
  const sum = summarizeDocuments(app.documents);
  const verified = allDocumentsApproved(app.documents);
  const locked = !!app.documents_verified_at || ['payment', 'approved', 'issued'].includes(app.status);

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

                  {doc.uploaded && !locked && (
                    <View style={styles.docActions}>
                      {busyDoc === doc.name ? (
                        <View style={styles.docBusyRow}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.docBusyText}>Saving verdict…</Text>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.docActionBtn,
                              styles.docRejectBtn,
                              status === 'rejected' && styles.docRejectBtnActive,
                              !!busyDoc && { opacity: 0.4 },
                            ]}
                            onPress={() => onSetReview(app, doc.name, 'rejected')}
                            disabled={!!busyDoc}
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
                              !!busyDoc && { opacity: 0.4 },
                            ]}
                            onPress={() => onSetReview(app, doc.name, 'approved')}
                            disabled={!!busyDoc}
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
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            {verified || locked ? (
              <View style={styles.verifiedNote}>
                <MaterialCommunityIcons name="shield-check" size={18} color={colors.success} />
                <Text style={styles.verifiedText}>Files confirmed and locked. Decline is no longer available.</Text>
              </View>
            ) : busyDoc === '*all*' ? (
              <View style={styles.approveAllBtn}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.approveAllText}>Approving all…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.approveAllBtn, !!busyDoc && { opacity: 0.5 }]}
                onPress={() => onApproveAll(app)}
                disabled={!!busyDoc}
                activeOpacity={0.85}
              >
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  registryBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  registryBtnText: { ...typography.label, color: '#fff', fontSize: 13 },
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
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
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
  paymentReviewCard: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderLight },
  paymentReviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paymentReviewTitle: { ...typography.label, color: colors.text },
  paymentReviewSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  paymentReferenceRow: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  paymentReferenceLabel: { ...typography.labelSmall, color: colors.textMuted },
  paymentReference: { ...typography.label, color: colors.text, marginTop: 2 },
  viewPaymentProof: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  viewPaymentProofText: { ...typography.label, color: colors.primary },
  paymentActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  paymentReject: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.error, borderRadius: radius.md },
  paymentRejectText: { ...typography.label, color: colors.error },
  paymentVerify: { flex: 2, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md },
  paymentVerifyText: { ...typography.label, color: '#fff' },
  sendBillingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sendBillingText: { ...typography.label, color: colors.primary },
  billingIssueNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
  },
  billingIssueText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  paymentPreviewImage: { width: '100%', height: '82%' },
  paymentPreviewClose: { position: 'absolute', top: spacing.xl, right: spacing.lg, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
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
  docBusyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 38,
  },
  docBusyText: { ...typography.label, fontSize: 12, color: colors.textSecondary },
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
