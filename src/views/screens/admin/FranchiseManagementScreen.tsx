import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, ScrollView, TouchableOpacity, Modal, Image, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchAllApplications, advanceApplication, patchApplication, reviewFranchisePayment, reviewChangeOfUnit } from '@/controllers/slices/franchiseSlice';
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
  mtopExpiryFrom,
  renewalStanding,
} from '@/models/entities/Franchise';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, radius, shadows, gradients } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { confirm, notify } from '@/utils/confirm';
import { MtopBillingModal } from '@/views/components/payment/MtopBillingModal';
import { AdminMtopPaymentMethod } from '@/models/entities/AdminMtopPaymentMethod';
import { supabase, isSupabaseConfigured } from '@/config/supabase';

// Amber text on white needs a darker shade than the theme's fill amber.
const AMBER_TEXT = '#9A6700';

const REVIEW_COLOR: Record<DocumentReviewStatus, string> = {
  pending: AMBER_TEXT,
  approved: colors.success,
  rejected: colors.error,
};

const METHOD_ICON: Record<string, string> = {
  gcash: 'cellphone',
  bank: 'bank-outline',
  face_to_face: 'map-marker-outline',
};
const METHOD_LABEL: Record<string, string> = {
  gcash: 'GCash',
  bank: 'Bank Transfer',
  face_to_face: 'Pay in Person',
};
const METHOD_COLOR: Record<string, string> = {
  gcash: '#0066FF',
  bank: '#2E7D32',
  face_to_face: '#E65100',
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

// Foreground / background pair per status, used by pills and card accents.
const STATUS_TONE: Record<FranchiseStatus, { fg: string; bg: string }> = {
  submitted: { fg: colors.primary, bg: colors.primaryLight },
  document_verification: { fg: AMBER_TEXT, bg: colors.warningLight },
  inspection: { fg: AMBER_TEXT, bg: colors.warningLight },
  payment: { fg: AMBER_TEXT, bg: colors.warningLight },
  approved: { fg: '#1F6F8B', bg: '#E2F3F8' },
  issued: { fg: colors.primary, bg: '#DDF1D6' },
  rejected: { fg: colors.error, bg: colors.errorLight },
};

// Application lifecycle shown as a progress track on each card.
const STEPS = ['Submitted', 'Documents', 'Payment', 'Approved', 'Issued'];
const STEP_INDEX: Record<FranchiseStatus, number> = {
  submitted: 0,
  document_verification: 1,
  inspection: 1,
  payment: 2,
  approved: 3,
  issued: 4,
  rejected: 0,
};

const peso = (value: number | string | null | undefined) =>
  `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const initialOf = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?';

// Segmented filter tab with a count badge.
const FilterChip = ({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    <View style={[styles.chipCount, active && styles.chipCountActive]}>
      <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
    </View>
  </TouchableOpacity>
);

const StatusPill = ({ status }: { status: FranchiseStatus }) => {
  const tone = STATUS_TONE[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.statusPillText, { color: tone.fg }]}>{FRANCHISE_STATUS_LABEL[status]}</Text>
    </View>
  );
};

const ProgressTrack = ({ status }: { status: FranchiseStatus }) => {
  if (status === 'rejected') {
    return (
      <View style={styles.rejectedBanner}>
        <MaterialCommunityIcons name="close-octagon-outline" size={16} color={colors.error} />
        <Text style={styles.rejectedBannerText}>Application rejected and closed</Text>
      </View>
    );
  }
  const current = STEP_INDEX[status];
  const complete = status === 'issued';
  return (
    <View style={styles.track}>
      {STEPS.map((label, i) => {
        const done = i < current || complete;
        const active = i === current && !complete;
        return (
          <View key={label} style={styles.trackStep}>
            <View style={styles.trackLineRow}>
              <View style={[styles.trackLine, i === 0 && styles.trackLineHidden, i <= current && styles.trackLineDone]} />
              <View style={[styles.trackDot, done && styles.trackDotDone, active && styles.trackDotActive]}>
                {done ? <MaterialCommunityIcons name="check" size={11} color="#fff" /> : null}
                {active ? <View style={styles.trackDotCore} /> : null}
              </View>
              <View style={[styles.trackLine, i === STEPS.length - 1 && styles.trackLineHidden, (i < current || complete) && styles.trackLineDone]} />
            </View>
            <Text style={[styles.trackLabel, (done || active) && styles.trackLabelOn]} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
};

// One "current → new" line in a Change of Unit request.
const CompareRow = ({ label, from, to }: { label: string; from?: string | null; to?: string | null }) => (
  <View style={styles.compareRow}>
    <Text style={styles.compareLabel}>{label}</Text>
    <View style={styles.compareValues}>
      <Text style={styles.compareFrom} numberOfLines={1}>{from || '—'}</Text>
      <MaterialCommunityIcons name="arrow-right" size={14} color={colors.textMuted} />
      <Text style={styles.compareTo} numberOfLines={1}>{to || '—'}</Text>
    </View>
  </View>
);

const InfoTile = ({ icon, label, value, emptyText = 'Not provided' }: { icon: string; label: string; value?: string | null; emptyText?: string }) => (
  <View style={styles.infoTile}>
    <View style={styles.infoTileHead}>
      <MaterialCommunityIcons name={icon as any} size={13} color={colors.textMuted} />
      <Text style={styles.infoTileLabel} numberOfLines={1}>{label}</Text>
    </View>
    <Text style={[styles.infoTileValue, !value && styles.infoTileEmpty]} numberOfLines={1}>{value || emptyText}</Text>
  </View>
);

export const FranchiseManagementScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { applications, loading } = useAppSelector((state) => state.franchise);
  const currentUser = useAppSelector((state) => state.auth.user);
  const [filter, setFilter] = useState<'all' | 'pending' | 'renewals' | 'issued'>('all');
  // Derive the document-review modal target from the store so it auto-updates.
  const [reviewAppId, setReviewAppId] = useState<string | null>(null);
  const reviewApp = applications.find((a) => a.id === reviewAppId) ?? null;
  // In-flight guards: exactly one document verdict (or bulk approve) at a
  // time, awaited to completion — rapid taps used to race each other with
  // stale document arrays and silently revert earlier verdicts.
  const [docBusy, setDocBusy] = useState<string | null>(null); // doc name or '*all*'
  const [actionBusy, setActionBusy] = useState<string | null>(null); // app id
  const [paymentPreview, setPaymentPreview] = useState<string | null>(null);
  const [couImagePreview, setCouImagePreview] = useState<string | null>(null);
  // Billing modal
  const [billingApp, setBillingApp] = useState<FranchiseApplication | null>(null);
  // Body numbers typed by the admin before issuing, keyed by application id.
  const [bodyDrafts, setBodyDrafts] = useState<Record<string, string>>({});

  // Change of Unit review state
  const [couActionBusy, setCouActionBusy] = useState<string | null>(null); // app id
  const [couRejectApp, setCouRejectApp]   = useState<FranchiseApplication | null>(null);
  const [couRejectReason, setCouRejectReason] = useState('');

  useEffect(() => {
    dispatch(fetchAllApplications());
  }, [dispatch]);

  // Keep the admin queue current while this screen is open. New renewal
  // submissions appear without requiring the administrator to refresh.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel('admin_franchise_applications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'franchise_applications' },
        () => dispatch(fetchAllApplications())
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dispatch]);

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
    let bodyNumber = '';
    if (next.status === 'issued') {
      bodyNumber = (bodyDrafts[app.id] ?? app.body_number ?? '').trim().toUpperCase();
      if (!bodyNumber) {
        await notify('Body number required', 'Enter the tricycle body number assigned by the office before issuing the MTOP.');
        return;
      }
      // A renewal keeps its own body number, so only a different tricycle in
      // the same TODA counts as a clash.
      const clash = applications.find((a) =>
        a.id !== app.id
        && a.driver_id !== app.driver_id
        && a.toda === app.toda
        && a.status !== 'rejected'
        && (a.body_number || '').trim().toUpperCase() === bodyNumber
      );
      if (clash) {
        await notify('Body number already used', `Body number ${bodyNumber} is already assigned to ${clash.driver_name} in ${app.toda}. Enter a different body number.`);
        return;
      }
      const okay = await confirm(
        'Issue MTOP',
        `Issue the MTOP permit to ${app.driver_name} with tricycle body number ${bodyNumber}? Confirm only when the permit is ready for release.`,
        { confirmText: 'Issue MTOP' }
      );
      if (!okay) return;
    }
    const patch: Partial<FranchiseApplication> = { ...next.patch };
    if (next.status === 'issued') {
      patch.body_number = bodyNumber;
      const year = new Date().getFullYear();
      patch.mtop_number = app.mtop_number || `MTOP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      patch.franchise_status = 'active';
      patch.issued_at = new Date().toISOString().slice(0, 10);
      // The server (migration 073) recomputes both dates; a renewal inside a
      // running term keeps the original issue and expiry dates.
      patch.expiry_date = mtopExpiryFrom(patch.issued_at);
      patch.original_holder_name = app.original_holder_name || app.driver_name;
      patch.current_holder_name = app.driver_name;
    }
    setActionBusy(app.id);
    try {
      await dispatch(advanceApplication({ id: app.id, status: next.status, patch })).unwrap();
      if (next.status === 'issued') {
        setBodyDrafts(({ [app.id]: _done, ...rest }) => rest);
      }
    } catch (error: any) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      notify(
        'Update failed',
        /duplicate key|idx_franchise_body_number/i.test(message)
          ? 'That body number is already assigned to another tricycle in this TODA. Enter a different body number.'
          : message.includes('body number')
          ? message
          : 'Could not advance the application. Please try again.'
      );
    } finally {
      setActionBusy(null);
    }
  };

  const reject = async (app: FranchiseApplication) => {
    if (app.documents_verified_at || allDocumentsApproved(app.documents) || ['payment', 'issued'].includes(app.status)) {
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
      await notify(decision === 'verified' ? 'Payment verified' : 'Payment proof rejected', decision === 'verified' ? 'The application is approved. Use the Issue MTOP button when the permit is ready.' : 'The registrant can submit corrected proof.');
    } catch (error: any) {
      await notify('Review failed', typeof error === 'string' ? error : error?.message || 'Please refresh and try again.');
    } finally { setActionBusy(null); }
  };

  const handleSendBilling = async (
    app: FranchiseApplication,
    methods: AdminMtopPaymentMethod[]
  ) => {
    setBillingApp(null);
    try {
      // Persist the selected payment methods on the application so the driver
      // sees actual method details (not hardcoded text) on their FranchiseScreen.
      await dispatch(
        patchApplication({
          id: app.id,
          patch: { selected_payment_methods: methods } as any,
        })
      ).unwrap();
    } catch {
      // Non-fatal: notify the admin but consider the billing "sent" — the
      // notification still reaches the driver via the status change.
      void notify('Warning', 'Billing sent but payment method details could not be saved. The driver may see default instructions.');
    }
    const names = methods.map((m) => m.display_name).join(', ');
    await notify(
      'Billing Sent',
      `Billing for ₱${Number(app.fees).toFixed(2)} sent to ${app.driver_name}.\n\nPayment method${methods.length !== 1 ? 's' : ''}: ${names}`
    );
  };

  const handleCouReview = async (app: FranchiseApplication, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected') {
      // Open the rejection-reason modal; submission handled by confirmCouReject.
      setCouRejectApp(app);
      setCouRejectReason('');
      return;
    }
    const ok = await confirm(
      'Approve Change of Unit',
      app.cou_unit_type === 'sidecar'
        ? `Approve the sidecar replacement for ${app.driver_name}?\n\nNew body/sidecar: ${app.cou_new_body}`
        : `Approve the unit change for ${app.driver_name}?\n\nNew plate: ${app.cou_new_plate}\nNew body: ${app.cou_new_body}`,
      { confirmText: 'Approve' }
    );
    if (!ok) return;
    setCouActionBusy(app.id);
    try {
      await dispatch(
        reviewChangeOfUnit({
          id: app.id,
          decision: 'approved',
          reviewedBy: currentUser?.id ?? '',
        })
      ).unwrap();
      await notify('Approved', `Change of Unit for ${app.driver_name} approved. Plate and body numbers updated.`);
    } catch (err: any) {
      await notify('Error', err?.message || 'Could not approve the request.');
    } finally {
      setCouActionBusy(null);
    }
  };

  const confirmCouReject = async () => {
    if (!couRejectApp) return;
    if (!couRejectReason.trim()) {
      await notify('Reason required', 'Please enter a rejection reason before confirming.');
      return;
    }
    setCouActionBusy(couRejectApp.id);
    const app = couRejectApp;
    setCouRejectApp(null);
    try {
      await dispatch(
        reviewChangeOfUnit({
          id: app.id,
          decision: 'rejected',
          reviewedBy: currentUser?.id ?? '',
          rejectionReason: couRejectReason.trim(),
        })
      ).unwrap();
      await notify('Rejected', `Change of Unit for ${app.driver_name} rejected.`);
    } catch (err: any) {
      await notify('Error', err?.message || 'Could not reject the request.');
    } finally {
      setCouActionBusy(null);
      setCouRejectReason('');
    }
  };

  // All issued franchises that have a pending COU request.
  const pendingCouApps = applications.filter((a) => a.cou_status === 'pending');

  const filtered = applications.filter((a) => {
    if (filter === 'pending') return a.status !== 'issued' && a.status !== 'rejected';
    if (filter === 'renewals') return a.type === 'renewal';
    if (filter === 'issued') return a.status === 'issued';
    return true;
  });

  if (loading && applications.length === 0) return <Loading message="Loading applications..." />;

  const isOpen = (a: FranchiseApplication) => a.status !== 'issued' && a.status !== 'rejected';
  const counts = {
    all: applications.length,
    pending: applications.filter(isOpen).length,
    renewals: applications.filter((a) => a.type === 'renewal').length,
    issued: applications.filter((a) => a.status === 'issued').length,
  };
  const stats = [
    {
      key: 'review',
      label: 'In review',
      icon: 'file-search-outline',
      value: applications.filter((a) => ['submitted', 'document_verification', 'inspection'].includes(a.status)).length,
      tone: STATUS_TONE.document_verification,
    },
    {
      key: 'payment',
      label: 'Payment',
      icon: 'cash-clock',
      value: applications.filter((a) => a.status === 'payment').length,
      tone: STATUS_TONE.payment,
    },
    {
      key: 'ready',
      label: 'To issue',
      icon: 'stamper',
      value: applications.filter((a) => a.status === 'approved').length,
      tone: STATUS_TONE.approved,
    },
    {
      key: 'issued',
      label: 'Issued',
      icon: 'shield-check-outline',
      value: counts.issued,
      tone: STATUS_TONE.issued,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.admin} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>FRANCHISE</Text>
              <Text style={styles.headerTitle}>MTOP Management</Text>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live · {applications.length} application records</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.registryBtn}
              onPress={() => navigation.navigate('FranchiseRegistry')}
              accessibilityLabel="Open issued franchise registry"
              activeOpacity={0.78}
            >
              <MaterialCommunityIcons name="book-open-variant" size={18} color="#fff" />
              <Text style={styles.registryBtnText}>Registry</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.statsCard}>
          {stats.map((stat, i) => (
            <React.Fragment key={stat.key}>
              {i > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.stat}>
                <View style={[styles.statIcon, { backgroundColor: stat.tone.bg }]}>
                  <MaterialCommunityIcons name={stat.icon as any} size={16} color={stat.tone.fg} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip label="All" count={counts.all} active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Pending" count={counts.pending} active={filter === 'pending'} onPress={() => setFilter('pending')} />
          <FilterChip label="Renewals" count={counts.renewals} active={filter === 'renewals'} onPress={() => setFilter('renewals')} />
          <FilterChip label="Issued" count={counts.issued} active={filter === 'issued'} onPress={() => setFilter('issued')} />
        </ScrollView>

        <View style={styles.body}>
          {/* ── Change of Unit Pending Requests ── */}
          {pendingCouApps.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: colors.warningLight }]}>
                  <MaterialCommunityIcons name="swap-horizontal" size={16} color={AMBER_TEXT} />
                </View>
                <Text style={styles.sectionTitle}>Change of Unit Requests</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{pendingCouApps.length}</Text>
                </View>
              </View>

              {pendingCouApps.map((app) => {
                const busy = couActionBusy === app.id;
                const typeLabel = app.cou_unit_type === 'motor'
                  ? 'Motor replacement'
                  : app.cou_unit_type === 'both'
                  ? 'Motor & sidecar replacement'
                  : 'Sidecar replacement';
                const images = ([
                  { uri: app.cou_or_image, label: 'OR Photo' },
                  { uri: app.cou_cr_image, label: 'CR Photo' },
                  { uri: app.cou_unit_image, label: 'Unit Photo' },
                ] as { uri?: string | null; label: string }[]).filter((i) => !!i.uri);
                return (
                  <View key={app.id} style={[styles.card, styles.couCard]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.avatar, { backgroundColor: colors.warningLight }]}>
                        <Text style={[styles.avatarText, { color: AMBER_TEXT }]}>{initialOf(app.driver_name)}</Text>
                      </View>
                      <View style={styles.cardHeaderCopy}>
                        <Text style={styles.driverName} numberOfLines={1}>{app.driver_name}</Text>
                        <Text style={styles.driverMeta} numberOfLines={1}>{app.mtop_number} · {app.toda}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: colors.warningLight }]}>
                        <View style={[styles.statusDot, { backgroundColor: AMBER_TEXT }]} />
                        <Text style={[styles.statusPillText, { color: AMBER_TEXT }]}>Pending</Text>
                      </View>
                    </View>

                    <View style={styles.couTypeTag}>
                      <MaterialCommunityIcons
                        name={app.cou_unit_type === 'motor' ? 'motorbike' : app.cou_unit_type === 'both' ? 'swap-horizontal-bold' : 'rickshaw'}
                        size={15}
                        color={colors.primary}
                      />
                      <Text style={styles.couTypeText}>{typeLabel}</Text>
                    </View>

                    <View style={styles.compareBox}>
                      {app.cou_unit_type !== 'sidecar' ? (
                        <CompareRow label="Plate" from={app.plate_number} to={app.cou_new_plate} />
                      ) : null}
                      <CompareRow label="Body no." from={app.body_number} to={app.cou_new_body} />
                    </View>

                    {app.cou_unit_type !== 'sidecar' ? (
                      <View style={styles.infoGrid}>
                        <InfoTile icon="factory" label="Make" value={app.cou_vehicle_make} />
                        <View style={styles.infoDivider} />
                        <InfoTile icon="motorbike" label="Model" value={app.cou_vehicle_model} />
                        <View style={styles.infoDivider} />
                        <InfoTile icon="receipt" label="OR no." value={app.cou_or_number} />
                        <View style={styles.infoDivider} />
                        <InfoTile icon="card-text-outline" label="CR no." value={app.cou_cr_number} />
                      </View>
                    ) : null}

                    {images.length > 0 ? (
                      <View style={styles.couImagesRow}>
                        {images.map((item) => (
                          <TouchableOpacity
                            key={item.label}
                            style={styles.couImageThumb}
                            onPress={() => setCouImagePreview(item.uri!)}
                            activeOpacity={0.85}
                          >
                            <Image source={{ uri: item.uri! }} style={styles.couImageThumbImg} resizeMode="cover" />
                            <View style={styles.couImageCaption}>
                              <Text style={styles.couImageThumbLabel}>{item.label}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}

                    {app.cou_requested_at ? (
                      <View style={styles.footNote}>
                        <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.footNoteText}>Requested {formatDate(app.cou_requested_at)}</Text>
                      </View>
                    ) : null}

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.btnDanger, busy && styles.btnDisabled]}
                        onPress={() => handleCouReview(app, 'rejected')}
                        disabled={busy}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="close" size={16} color={colors.error} />
                        <Text style={styles.btnDangerText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnPrimary, busy && styles.btnDisabled]}
                        onPress={() => handleCouReview(app, 'approved')}
                        disabled={busy}
                        activeOpacity={0.85}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check" size={16} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Approve change</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.listHeader}>
            <Text style={styles.listLabel}>APPLICATIONS</Text>
            <Text style={styles.listCount}>{filtered.length} shown</Text>
          </View>

          {filtered.map((app) => {
            const next = NEXT[app.status];
            const canReject = !app.documents_verified_at && !allDocumentsApproved(app.documents)
              && (app.status === 'submitted' || app.status === 'document_verification');
            const busy = actionBusy === app.id;
            // Issue MTOP stays locked until a body number is on the application
            // or typed in by the admin.
            const needsBody = next?.status === 'issued'
              && !(bodyDrafts[app.id] ?? app.body_number ?? '').trim();
            const advanceDisabled = busy || needsBody;
            const tone = STATUS_TONE[app.status];
            const sum = summarizeDocuments(app.documents);
            const docsVerified = allDocumentsApproved(app.documents);
            const docsRejected = anyDocumentRejected(app.documents);
            const docTone = docsVerified
              ? { fg: colors.success, bg: '#DDF1D6' }
              : docsRejected
              ? { fg: colors.error, bg: colors.errorLight }
              : { fg: AMBER_TEXT, bg: colors.warningLight };
            const paid = app.payment_status === 'paid';

            return (
              <View key={app.id} style={styles.card}>
                <View style={[styles.cardAccent, { backgroundColor: tone.fg }]} />

                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.avatarText, { color: tone.fg }]}>{initialOf(app.driver_name)}</Text>
                  </View>
                  <View style={styles.cardHeaderCopy}>
                    <Text style={styles.driverName} numberOfLines={1}>{app.driver_name}</Text>
                    <View style={styles.metaLine}>
                      <View style={styles.typeTag}>
                        <Text style={styles.typeTagText}>{app.type === 'renewal' ? 'Renewal' : 'New'}</Text>
                      </View>
                      <Text style={styles.driverMeta} numberOfLines={1}>{app.toda || 'No TODA'}</Text>
                    </View>
                  </View>
                  <StatusPill status={app.status} />
                </View>

                <ProgressTrack status={app.status} />

                <View style={styles.infoGrid}>
                  <InfoTile icon="card-account-details-outline" label="License" value={app.license_number} />
                  <View style={styles.infoDivider} />
                  <InfoTile icon="card-text-outline" label="Plate" value={app.plate_number} />
                  <View style={styles.infoDivider} />
                  <InfoTile icon="rickshaw" label="Body no." value={app.body_number} emptyText="To assign" />
                </View>

                <TouchableOpacity style={styles.docTile} onPress={() => setReviewAppId(app.id)} activeOpacity={0.8}>
                  <View style={[styles.docTileIcon, { backgroundColor: docTone.bg }]}>
                    <MaterialCommunityIcons
                      name={docsVerified ? 'file-check-outline' : docsRejected ? 'file-alert-outline' : 'file-search-outline'}
                      size={18}
                      color={docTone.fg}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.docTileTop}>
                      <Text style={styles.docTileTitle}>Submitted documents</Text>
                      <Text style={[styles.docTileStatus, { color: docTone.fg }]}>
                        {docsVerified ? 'All approved' : docsRejected ? `${sum.rejected} rejected` : `${sum.approved}/${sum.total} approved`}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${sum.total ? (sum.approved / sum.total) * 100 : 0}%`, backgroundColor: docTone.fg },
                        ]}
                      />
                    </View>
                    <Text style={styles.docTileSub}>{sum.uploaded} of {sum.total} uploaded · Tap to review</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textLight} />
                </TouchableOpacity>

                <View style={styles.feeRow}>
                  <View style={styles.feeLeft}>
                    <MaterialCommunityIcons name="cash-multiple" size={16} color={colors.textSecondary} />
                    <Text style={styles.feeLabel}>MTOP fee</Text>
                  </View>
                  <Text style={styles.feeAmount}>{peso(app.fees)}</Text>
                  <View style={[styles.feeTag, { backgroundColor: paid ? '#DDF1D6' : colors.warningLight }]}>
                    <Text style={[styles.feeTagText, { color: paid ? colors.success : AMBER_TEXT }]}>{paid ? 'Paid' : 'Due'}</Text>
                  </View>
                </View>

                {app.mtop_number ? (() => {
                  const standing = renewalStanding(app);
                  return (
                    <View style={styles.permit}>
                      <View style={styles.permitTop}>
                        <View style={styles.permitIcon}>
                          <MaterialCommunityIcons name="shield-check" size={18} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.permitLabel}>MTOP NUMBER</Text>
                          <Text selectable style={styles.permitNumber}>{app.mtop_number}</Text>
                        </View>
                      </View>
                      {standing.issuedAt ? (
                        <View style={styles.permitDates}>
                          <View style={styles.permitDateCol}>
                            <Text style={styles.permitLabel}>ISSUED</Text>
                            <Text style={styles.permitDateValue}>{formatDate(standing.issuedAt)}</Text>
                          </View>
                          <View style={styles.permitDateCol}>
                            <Text style={styles.permitLabel}>EXPIRES</Text>
                            <Text style={styles.permitDateValue}>{formatDate(standing.expiryDate)}</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })() : null}

                {app.status === 'payment' ? (
                  <View style={styles.paymentCard}>
                    <View style={styles.paymentHead}>
                      <View style={styles.paymentHeadIcon}>
                        <MaterialCommunityIcons name="receipt-text-check-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentTitle}>MTOP Payment</Text>
                        <Text style={styles.paymentSub}>
                          {app.payment_review_status === 'pending_review'
                            ? 'Proof submitted for review'
                            : app.payment_review_status === 'rejected'
                            ? 'Proof rejected — awaiting re-submission'
                            : 'Waiting for registrant payment'}
                        </Text>
                      </View>
                    </View>

                    {/* Chosen payment method snapshot — shown when driver has submitted proof */}
                    {app.payment_review_status === 'pending_review' && app.chosen_payment_method_snapshot ? (() => {
                      const cm = app.chosen_payment_method_snapshot!;
                      const mColor = METHOD_COLOR[cm.method_type] || colors.primary;
                      return (
                        <View style={styles.subPanel}>
                          <Text style={styles.subPanelLabel}>PAID VIA</Text>
                          <View style={styles.chosenMethodRow}>
                            <View style={[styles.chosenMethodIcon, { backgroundColor: mColor + '18' }]}>
                              <MaterialCommunityIcons name={METHOD_ICON[cm.method_type] as any} size={18} color={mColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.chosenMethodName}>{cm.display_name}</Text>
                              {cm.method_type !== 'face_to_face' && cm.account_number ? (
                                <Text style={[styles.chosenMethodDetail, { color: mColor }]}>
                                  {cm.account_name} · {cm.account_number}
                                </Text>
                              ) : cm.address ? (
                                <Text style={styles.chosenMethodDetail}>{cm.address}</Text>
                              ) : null}
                            </View>
                            <View style={[styles.chosenMethodBadge, { backgroundColor: mColor + '15' }]}>
                              <Text style={[styles.chosenMethodBadgeText, { color: mColor }]}>{METHOD_LABEL[cm.method_type]}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })() : null}

                    {/* Rejection reason — shown prominently when proof was rejected */}
                    {app.payment_review_status === 'rejected' && app.payment_rejection_reason ? (
                      <View style={[styles.notice, styles.noticeError]}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.noticeLabel, { color: colors.error }]}>REJECTION REASON</Text>
                          <Text style={[styles.noticeText, { color: colors.error }]}>{app.payment_rejection_reason}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Appointment date — shown when driver scheduled a face-to-face visit */}
                    {(app as any).appointment_date ? (
                      <View style={[styles.notice, styles.noticeInfo]}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.noticeLabel, { color: colors.primary }]}>SCHEDULED VISIT</Text>
                          <Text style={styles.noticeValue}>
                            {new Date((app as any).appointment_date).toLocaleString(undefined, {
                              weekday: 'short', year: 'numeric', month: 'short',
                              day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {app.payment_reference || app.payment_proof_url ? (
                      <View style={styles.subPanel}>
                        {app.payment_reference ? (
                          <>
                            <Text style={styles.subPanelLabel}>REFERENCE</Text>
                            <Text selectable style={styles.referenceText}>{app.payment_reference}</Text>
                          </>
                        ) : null}
                        {app.payment_proof_url ? (
                          <TouchableOpacity
                            style={[styles.proofLink, !!app.payment_reference && styles.proofLinkSpaced]}
                            onPress={() => setPaymentPreview(app.payment_proof_url!)}
                            activeOpacity={0.75}
                          >
                            <MaterialCommunityIcons name="image-search-outline" size={17} color={colors.primary} />
                            <Text style={styles.proofLinkText}>View payment screenshot</Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}

                    {app.payment_review_status === 'pending_review' ? (
                      <View style={styles.actionsTight}>
                        <TouchableOpacity
                          style={[styles.btnDanger, busy && styles.btnDisabled]}
                          onPress={() => reviewPayment(app, 'rejected')}
                          disabled={busy}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnDangerText}>Reject proof</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btnPrimary, busy && styles.btnDisabled]}
                          onPress={() => reviewPayment(app, 'verified')}
                          disabled={busy}
                          activeOpacity={0.85}
                        >
                          {busy ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <>
                              <MaterialCommunityIcons name="check-decagram-outline" size={16} color="#fff" />
                              <Text style={styles.btnPrimaryText}>Verify payment</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {/* Send Billing button — shown when the applicant hasn't submitted proof yet */}
                    {(app.payment_review_status === 'awaiting_submission' || !app.payment_review_status || app.payment_review_status === 'rejected') ? (
                      <>
                        <Text style={styles.billingHint}>
                          Sending billing notifies the applicant which payment method to use. Configure methods under Account → MTOP Billing Methods.
                        </Text>
                        <TouchableOpacity style={styles.btnSoft} onPress={() => setBillingApp(app)} activeOpacity={0.8}>
                          <MaterialCommunityIcons name="send-outline" size={17} color={colors.primary} />
                          <Text style={styles.btnSoftText}>Send billing</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {app.status === 'approved' ? (
                  app.type === 'renewal' && app.body_number ? (
                    <View style={styles.bodyPanel}>
                      <View style={styles.bodyPanelHead}>
                        <MaterialCommunityIcons name="rickshaw" size={16} color={colors.primary} />
                        <Text style={styles.bodyPanelTitle}>Tricycle body number</Text>
                      </View>
                      <View style={styles.bodyLocked}>
                        <Text style={styles.bodyLockedValue}>{app.body_number}</Text>
                        <View style={styles.bodyLockedTag}>
                          <MaterialCommunityIcons name="lock-outline" size={11} color={colors.primary} />
                          <Text style={styles.bodyLockedTagText}>Renewal · unchanged</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.bodyPanel}>
                      <View style={styles.bodyPanelHead}>
                        <MaterialCommunityIcons name="rickshaw" size={16} color={colors.primary} />
                        <Text style={styles.bodyPanelTitle}>Assign tricycle body number</Text>
                      </View>
                      <Text style={styles.bodyPanelHint}>Payment is verified. Enter the body number from the office records — it is printed on the MTOP.</Text>
                      <TextInput
                        style={styles.bodyInput}
                        value={bodyDrafts[app.id] ?? app.body_number ?? ''}
                        onChangeText={(value) => setBodyDrafts((drafts) => ({ ...drafts, [app.id]: value.toUpperCase() }))}
                        placeholder="e.g. B-042"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={30}
                        editable={!busy}
                      />
                      {needsBody ? (
                        <View style={styles.bodyRequired}>
                          <MaterialCommunityIcons name="lock-outline" size={12} color={AMBER_TEXT} />
                          <Text style={styles.bodyRequiredText}>Enter the body number to unlock Issue MTOP.</Text>
                        </View>
                      ) : null}
                    </View>
                  )
                ) : null}

                {next || canReject ? (
                  <View style={styles.actions}>
                    {canReject ? (
                      <TouchableOpacity
                        style={[styles.btnDanger, busy && styles.btnDisabled]}
                        onPress={() => reject(app)}
                        disabled={busy}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="close" size={16} color={colors.error} />
                        <Text style={styles.btnDangerText}>Reject</Text>
                      </TouchableOpacity>
                    ) : null}
                    {next ? (
                      <TouchableOpacity
                        style={[styles.btnPrimary, advanceDisabled && styles.btnDisabled]}
                        onPress={() => advance(app)}
                        disabled={advanceDisabled}
                        accessibilityState={{ disabled: advanceDisabled }}
                        activeOpacity={0.85}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MaterialCommunityIcons
                              name={next.status === 'issued' ? 'stamper' : 'file-search-outline'}
                              size={16}
                              color="#fff"
                            />
                            <Text style={styles.btnPrimaryText}>{next.label}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : app.status === 'payment' ? null : (
                  <View style={styles.footNote}>
                    <MaterialCommunityIcons
                      name={app.status === 'issued' ? 'information-outline' : 'lock-outline'}
                      size={13}
                      color={colors.textMuted}
                    />
                    <Text style={styles.footNoteText}>
                      {app.status === 'issued' ? 'MTOP issued. Manage its operational status in the Registry.' : 'Application closed.'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons name="file-search-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No applications here</Text>
              <Text style={styles.emptyText}>New MTOP applications and renewals will show up in this list.</Text>
            </View>
          )}
        </View>
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

      {/* Payment proof preview */}
      <Modal visible={!!paymentPreview} transparent animationType="fade" onRequestClose={() => setPaymentPreview(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPaymentPreview(null)}>
          {paymentPreview ? <Image source={{ uri: paymentPreview }} style={styles.fullPreviewImage} resizeMode="contain" /> : null}
          <TouchableOpacity style={styles.fullPreviewClose} onPress={() => setPaymentPreview(null)}>
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* COU Image Preview */}
      <Modal visible={!!couImagePreview} transparent animationType="fade" onRequestClose={() => setCouImagePreview(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setCouImagePreview(null)}>
          {couImagePreview ? <Image source={{ uri: couImagePreview }} style={styles.fullPreviewImage} resizeMode="contain" /> : null}
          <TouchableOpacity style={styles.fullPreviewClose} onPress={() => setCouImagePreview(null)}>
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* COU Rejection Reason Modal */}
      <Modal
        visible={!!couRejectApp}
        transparent
        animationType="slide"
        onRequestClose={() => setCouRejectApp(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Reject Change of Unit</Text>
                {couRejectApp ? (
                  <Text style={styles.modalSub}>
                    {couRejectApp.driver_name} · {couRejectApp.plate_number} → {couRejectApp.cou_new_plate}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => setCouRejectApp(null)} style={styles.modalClose} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            {couRejectApp ? (
              <View style={styles.sheetBody}>
                <Text style={styles.inputLabel}>Rejection reason</Text>
                <TextInput
                  style={styles.textArea}
                  value={couRejectReason}
                  onChangeText={setCouRejectReason}
                  placeholder="Tell the driver why this request was rejected…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
                <Text style={styles.charCount}>{couRejectReason.length}/200</Text>
                <View style={styles.actionsTight}>
                  <TouchableOpacity style={styles.btnGhost} onPress={() => setCouRejectApp(null)} activeOpacity={0.8}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnDangerSolid, !couRejectReason.trim() && styles.btnDisabled]}
                    onPress={confirmCouReject}
                    disabled={!couRejectReason.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnPrimaryText}>Confirm rejection</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
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
  const summary = [
    { label: 'Uploaded', value: `${sum.uploaded}/${sum.total}`, fg: colors.text, bg: colors.surfaceAlt },
    { label: 'Approved', value: sum.approved, fg: colors.success, bg: '#DDF1D6' },
    { label: 'Rejected', value: sum.rejected, fg: colors.error, bg: colors.errorLight },
    { label: 'Pending', value: sum.pending, fg: AMBER_TEXT, bg: colors.warningLight },
  ];

  return (
    <Modal
      visible={!!app}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.sheet, styles.sheetTall]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Submitted Documents</Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                {app.driver_name} · {app.plate_number} · {app.toda}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalClose} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <View key={item.label} style={[styles.summaryTile, { backgroundColor: item.bg }]}>
                <Text style={[styles.summaryNum, { color: item.fg }]}>{item.value}</Text>
                <Text style={[styles.summaryLabel, { color: item.fg }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {app.documents.map((doc) => {
              const status = docReviewStatus(doc);
              const color = REVIEW_COLOR[status];
              return (
                <View key={doc.name} style={styles.docRow}>
                  <View style={styles.docRowHeader}>
                    <TouchableOpacity
                      style={styles.docThumb}
                      activeOpacity={doc.uploaded ? 0.8 : 1}
                      onPress={() => doc.uploaded && setPreview(doc)}
                    >
                      {isHttp(doc.file_url) ? (
                        <Image source={{ uri: doc.file_url! }} style={styles.docThumbImg} resizeMode="cover" />
                      ) : (
                        <MaterialCommunityIcons
                          name={doc.uploaded ? 'file-document-outline' : 'file-remove-outline'}
                          size={24}
                          color={doc.uploaded ? colors.primary : colors.textMuted}
                        />
                      )}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName}>{doc.name}</Text>
                      {doc.uploaded ? (
                        <Text style={styles.docMeta}>Uploaded {formatDate(doc.uploaded_at)}</Text>
                      ) : (
                        <Text style={[styles.docMeta, { color: colors.error }]}>Not submitted</Text>
                      )}
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
                      <MaterialCommunityIcons
                        name={status === 'approved' ? 'check-circle' : status === 'rejected' ? 'close-circle' : 'clock-outline'}
                        size={12}
                        color={color}
                      />
                      <Text style={[styles.statusPillText, { color }]}>{DOCUMENT_REVIEW_LABEL[status]}</Text>
                    </View>
                  </View>

                  {status === 'rejected' && doc.review_remarks ? (
                    <Text style={styles.docRemark}>{doc.review_remarks}</Text>
                  ) : null}

                  {doc.uploaded ? (
                    <View style={styles.docActions}>
                      <TouchableOpacity style={styles.docViewBtn} onPress={() => setPreview(doc)} activeOpacity={0.75}>
                        <MaterialCommunityIcons name="eye-outline" size={16} color={colors.primary} />
                        <Text style={styles.docViewText}>View</Text>
                      </TouchableOpacity>

                      {!locked ? (
                        busyDoc === doc.name ? (
                          <View style={styles.docBusyRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.docBusyText}>Saving…</Text>
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={[
                                styles.docVerdictBtn,
                                styles.docRejectBtn,
                                status === 'rejected' && styles.docRejectBtnActive,
                                !!busyDoc && styles.btnDisabled,
                              ]}
                              onPress={() => onSetReview(app, doc.name, 'rejected')}
                              disabled={!!busyDoc}
                              activeOpacity={0.8}
                            >
                              <MaterialCommunityIcons name="close" size={15} color={status === 'rejected' ? '#fff' : colors.error} />
                              <Text style={[styles.docRejectText, status === 'rejected' && { color: '#fff' }]}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.docVerdictBtn,
                                styles.docApproveBtn,
                                status === 'approved' && styles.docApproveBtnActive,
                                !!busyDoc && styles.btnDisabled,
                              ]}
                              onPress={() => onSetReview(app, doc.name, 'approved')}
                              disabled={!!busyDoc}
                              activeOpacity={0.8}
                            >
                              <MaterialCommunityIcons name="check" size={15} color={status === 'approved' ? '#fff' : colors.success} />
                              <Text style={[styles.docApproveText, status === 'approved' && { color: '#fff' }]}>Approve</Text>
                            </TouchableOpacity>
                          </>
                        )
                      ) : null}
                    </View>
                  ) : null}
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
                style={[styles.approveAllBtn, !!busyDoc && styles.btnDisabled]}
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
              <TouchableOpacity onPress={() => setPreview(null)} style={styles.modalClose} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            {isHttp(preview?.file_url) ? (
              <Image source={{ uri: preview!.file_url! }} style={styles.previewImg} resizeMode="contain" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="file-document-outline" size={34} color={colors.primary} />
                </View>
                <Text style={styles.previewPlaceholderTitle}>{preview?.name}</Text>
                <Text style={styles.previewPlaceholderMeta}>Submitted {formatDate(preview?.uploaded_at)}</Text>
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
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 110 },

  // ── Header ──
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: 40,
    paddingBottom: 56,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerEyebrow: {
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    letterSpacing: 2,
  },
  headerTitle: { ...typography.h1, color: '#FFFFFF', fontSize: 26, lineHeight: 34 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B6E4A8', marginRight: 7 },
  liveText: { ...typography.labelSmall, color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  registryBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  registryBtnText: { ...typography.label, color: '#fff', fontSize: 13 },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -36,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  stat: { flex: 1, alignItems: 'center' },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { ...typography.number, fontSize: 20, lineHeight: 26 },
  statLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textSecondary },
  statDivider: { width: 1, height: 44, backgroundColor: colors.borderLight },

  // ── Filters ──
  filters: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xs, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  chipCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chipCountText: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },
  chipCountTextActive: { color: '#fff' },

  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // ── Sections ──
  section: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.label, fontSize: 15, flex: 1 },
  sectionBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: { ...typography.labelSmall, color: '#3D2B00', fontSize: 11 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  listLabel: { ...typography.labelSmall, fontSize: 10, letterSpacing: 1.5, color: colors.textMuted },
  listCount: { ...typography.labelSmall, fontSize: 11, color: colors.textSecondary },

  // ── Cards ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  couCard: { borderLeftWidth: 4, borderLeftColor: colors.warning, paddingLeft: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderCopy: { flex: 1, minWidth: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h3, fontSize: 17, lineHeight: 22 },
  driverName: { ...typography.label, fontSize: 15 },
  driverMeta: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  typeTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  typeTagText: { ...typography.labelSmall, fontSize: 10, color: colors.primary },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { ...typography.labelSmall, fontSize: 10, fontWeight: '700' },

  // ── Progress track ──
  track: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.xs },
  trackStep: { flex: 1, alignItems: 'center' },
  trackLineRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  trackLine: { flex: 1, height: 2, backgroundColor: colors.border },
  trackLineHidden: { opacity: 0 },
  trackLineDone: { backgroundColor: colors.primary },
  trackDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  trackDotActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  trackDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  trackLabel: { ...typography.labelSmall, fontSize: 9, color: colors.textMuted, marginTop: 5 },
  trackLabelOn: { color: colors.primary },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
  },
  rejectedBannerText: { ...typography.labelSmall, color: colors.error },

  // ── Info grid ──
  infoGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  infoTile: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  infoTileHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  infoTileLabel: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted, flexShrink: 1 },
  infoTileValue: { ...typography.label, fontSize: 13 },
  infoTileEmpty: { color: colors.textMuted, fontStyle: 'italic' },
  infoDivider: { width: 1, backgroundColor: colors.border },

  // ── Document tile ──
  docTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  docTileIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  docTileTitle: { ...typography.label, fontSize: 13 },
  docTileStatus: { ...typography.labelSmall, fontSize: 11 },
  docTileSub: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceAlt, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // ── Fee row ──
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, paddingHorizontal: 2 },
  feeLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  feeLabel: { ...typography.bodySmall, color: colors.textSecondary },
  feeAmount: { ...typography.currency, fontSize: 15 },
  feeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  feeTagText: { ...typography.labelSmall, fontSize: 10 },

  // ── Issued permit ──
  permit: {
    marginTop: spacing.sm,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: '#EEF7EA',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary + '55',
  },
  permitIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  permitLabel: { ...typography.labelSmall, fontSize: 9, letterSpacing: 1.2, color: colors.textSecondary },
  permitNumber: { ...typography.number, fontSize: 15, letterSpacing: 0.5, color: colors.primary },
  permitTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permitDates: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.primary + '22',
  },
  permitDateCol: { flex: 1 },
  permitDateValue: { ...typography.label, fontSize: 13 },

  // ── Payment ──
  paymentCard: {
    marginTop: spacing.md,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentHeadIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: { ...typography.label, fontSize: 14 },
  paymentSub: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  subPanel: { marginTop: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  subPanelLabel: { ...typography.labelSmall, fontSize: 9, letterSpacing: 1.2, color: colors.textMuted, marginBottom: 6 },
  chosenMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chosenMethodIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chosenMethodName: { ...typography.label, fontSize: 14 },
  chosenMethodDetail: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  chosenMethodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  chosenMethodBadgeText: { ...typography.labelSmall, fontSize: 10, fontWeight: '700' },
  referenceText: { ...typography.label, fontSize: 15, letterSpacing: 0.5 },
  proofLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  proofLinkSpaced: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  proofLinkText: { ...typography.label, fontSize: 13, color: colors.primary, flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, padding: 12, borderRadius: radius.md },
  noticeError: { backgroundColor: colors.errorLight },
  noticeInfo: { backgroundColor: colors.surface },
  noticeLabel: { ...typography.labelSmall, fontSize: 9, letterSpacing: 1.2, marginBottom: 2 },
  noticeText: { ...typography.bodySmall, lineHeight: 18 },
  noticeValue: { ...typography.label, fontSize: 13 },
  billingHint: { ...typography.bodySmall, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 10 },

  // ── Body number (before issuance) ──
  bodyPanel: {
    marginTop: spacing.md,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: '#E2F3F8',
  },
  bodyPanelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bodyPanelTitle: { ...typography.label, fontSize: 13 },
  bodyPanelHint: { ...typography.bodySmall, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 4 },
  bodyInput: {
    ...typography.label,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.text,
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bodyRequired: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  bodyRequiredText: { ...typography.labelSmall, fontSize: 11, color: AMBER_TEXT },
  bodyLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  bodyLockedValue: { ...typography.number, fontSize: 18, letterSpacing: 1, color: colors.primary },
  bodyLockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  bodyLockedTagText: { ...typography.labelSmall, fontSize: 10, color: colors.primary },

  // ── Buttons ──
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionsTight: { flexDirection: 'row', gap: spacing.sm, marginTop: 12 },
  btnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  btnPrimaryText: { ...typography.label, fontSize: 13, color: '#fff', textAlign: 'center', flexShrink: 1 },
  btnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.error + '55',
    backgroundColor: colors.surface,
  },
  btnDangerText: { ...typography.label, fontSize: 13, color: colors.error, textAlign: 'center', flexShrink: 1 },
  btnDangerSolid: {
    flex: 2,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSoft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  btnSoftText: { ...typography.label, fontSize: 13, color: colors.primary },
  btnGhost: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { ...typography.label, fontSize: 13, color: colors.textSecondary },
  btnDisabled: { opacity: 0.5 },

  footNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  footNoteText: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted, flex: 1 },

  // ── Change of Unit ──
  couTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  couTypeText: { ...typography.labelSmall, fontSize: 11, color: colors.primary },
  compareBox: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  compareLabel: { ...typography.labelSmall, fontSize: 11, color: colors.textMuted, width: 64 },
  compareValues: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  compareFrom: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  compareTo: { ...typography.label, fontSize: 14, color: colors.primary, flexShrink: 1 },
  couImagesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  couImageThumb: { flex: 1, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  couImageThumbImg: { width: '100%', height: '100%' },
  couImageCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 3,
    backgroundColor: 'rgba(24,38,30,0.55)',
  },
  couImageThumbLabel: { ...typography.labelSmall, fontSize: 10, color: '#fff', textAlign: 'center' },

  // ── Empty ──
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.label, fontSize: 16, marginTop: spacing.md },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },

  // ── Sheets / modals ──
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.lg,
  },
  sheetTall: { maxHeight: '92%' },
  sheetBody: { paddingHorizontal: spacing.screen },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.md,
  },
  modalTitle: { ...typography.h3, fontSize: 19 },
  modalSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: { ...typography.label, fontSize: 13, marginBottom: 6 },
  textArea: {
    ...typography.body,
    color: colors.text,
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  charCount: { ...typography.labelSmall, fontSize: 11, textAlign: 'right', marginTop: 4 },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen, marginBottom: spacing.sm },
  summaryTile: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.lg },
  summaryNum: { ...typography.number, fontSize: 18, lineHeight: 24 },
  summaryLabel: { ...typography.labelSmall, fontSize: 10 },

  modalScroll: { flexGrow: 0 },
  modalScrollContent: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: spacing.md },
  docRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: spacing.sm,
  },
  docRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  docThumbImg: { width: '100%', height: '100%' },
  docName: { ...typography.label, fontSize: 14 },
  docMeta: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },
  docRemark: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.error,
    marginTop: 10,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
  },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 12 },
  docViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  docViewText: { ...typography.label, fontSize: 12, color: colors.primary },
  docVerdictBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  docRejectBtn: { borderColor: colors.error + '55', backgroundColor: colors.surface },
  docRejectBtnActive: { backgroundColor: colors.error, borderColor: colors.error },
  docRejectText: { ...typography.label, fontSize: 12, color: colors.error },
  docApproveBtn: { borderColor: colors.success + '66', backgroundColor: colors.surface },
  docApproveBtnActive: { backgroundColor: colors.success, borderColor: colors.success },
  docApproveText: { ...typography.label, fontSize: 12, color: colors.success },
  docBusyRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 38 },
  docBusyText: { ...typography.label, fontSize: 12, color: colors.textSecondary },

  modalFooter: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  approveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  approveAllText: { ...typography.button, fontSize: 15, color: '#fff', textAlign: 'center', flexShrink: 1 },
  verifiedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: radius.lg,
    backgroundColor: '#DDF1D6',
    padding: spacing.sm,
  },
  verifiedText: { ...typography.label, fontSize: 13, color: colors.success, textAlign: 'center', flexShrink: 1 },

  // ── Full-screen previews ──
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  fullPreviewImage: { width: '100%', height: '82%' },
  fullPreviewClose: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 20,
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
  previewTitle: { ...typography.label, flex: 1, marginRight: spacing.md },
  previewImg: { width: '100%', height: 380, backgroundColor: '#000' },
  previewPlaceholder: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  previewPlaceholderTitle: { ...typography.h3, fontSize: 16, marginTop: spacing.md, textAlign: 'center' },
  previewPlaceholderMeta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  previewPlaceholderHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
