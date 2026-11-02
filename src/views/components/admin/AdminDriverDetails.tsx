import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DriverDocumentService } from '@/models/services/DriverDocumentService';
import { FranchiseService } from '@/models/services/FranchiseService';
import {
  DRIVER_DOCUMENT_TYPES,
  DriverDocument,
} from '@/models/entities/DriverDocument';
import {
  FRANCHISE_STATUS_LABEL,
  FRANCHISE_RECORD_STATUS_LABEL,
  FranchiseApplication,
} from '@/models/entities/Franchise';
import { formatDate } from '@/utils/dateUtils';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

const documentService = new DriverDocumentService();
const franchiseService = new FranchiseService();

const REVIEW_TONE = {
  pending: { fg: '#8A5A00', bg: colors.warningLight, label: 'To review' },
  approved: { fg: colors.success, bg: colors.successLight, label: 'Approved' },
  rejected: { fg: colors.error, bg: colors.errorLight, label: 'Rejected' },
} as const;

const isImage = (url?: string | null) =>
  !!url && (/^data:image\//i.test(url) || /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url));

const show = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text ? text : '—';
};

const titleCase = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';

interface Photo {
  key: string;
  label: string;
  url: string | null;
  status?: keyof typeof REVIEW_TONE;
  note?: string | null;
}

interface Props {
  driverId: string;
  /** users row of the driver (admins can read every column). */
  driver: Record<string, any> | null;
}

/**
 * Admin-only block on the driver profile: every account detail (never the
 * password, which the app does not store) and every photo the driver uploaded,
 * whether or not the account is verified yet.
 */
export const AdminDriverDetails = ({ driverId, driver }: Props) => {
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [mtop, setMtop] = useState<FranchiseApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Photo | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      documentService.listForDriver(driverId).catch(() => [] as DriverDocument[]),
      franchiseService.getByDriver(driverId).catch(() => null),
    ])
      .then(([rows, application]) => {
        if (!alive) return;
        setDocs(rows);
        setMtop(application);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [driverId]);

  const d = driver ?? {};
  const vehicle = (d.vehicle_details ?? {}) as Record<string, any>;
  const verified = d.verification_status === 'verified';

  const accountRows: [string, string][] = [
    ['Full name', show(d.name)],
    ['Email', show(d.email)],
    ['Phone', show(d.phone)],
    ['Home address', show(d.home_address)],
    ["Driver's license no.", show(d.license_number)],
    ['License expiry', d.license_expiry ? formatDate(d.license_expiry) : '—'],
    ['TODA', show(d.toda_membership) === '—' ? 'Not assigned yet' : show(d.toda_membership)],
    ['Account status', titleCase(d.status)],
    ['Verification', titleCase(d.verification_status)],
    ['Registered', d.created_at ? formatDate(d.created_at) : '—'],
  ];
  const vehicleText = [vehicle.color, vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
  if (vehicleText) accountRows.push(['Vehicle', vehicleText]);
  if (vehicle.plate_number) accountRows.push(['Plate (sign-up)', String(vehicle.plate_number)]);
  if (d.status === 'deactivated') {
    accountRows.push(['Deactivated', d.deactivated_at ? formatDate(d.deactivated_at) : 'Yes']);
    if (d.deactivation_reason) accountRows.push(['Reason', String(d.deactivation_reason)]);
  }

  const registrationPhotos: Photo[] = DRIVER_DOCUMENT_TYPES.map(({ type, label }) => {
    const doc = docs.find((x) => x.doc_type === type);
    return {
      key: type,
      label,
      url: doc?.file_url ?? null,
      status: doc?.review_status,
      note: doc?.review_status === 'rejected' ? doc.review_remarks : null,
    };
  });

  const mtopPhotos: Photo[] = [
    ...((mtop?.documents ?? []).filter((doc) => doc.file_url).map((doc, i) => ({
      key: `mtop-${i}`,
      label: doc.name,
      url: doc.file_url ?? null,
      status: doc.review_status,
      note: doc.review_status === 'rejected' ? doc.review_remarks ?? null : null,
    }))),
    ...([
      ['cou_or_image', 'New unit OR (Change of Unit)'],
      ['cou_cr_image', 'New unit CR (Change of Unit)'],
      ['cou_unit_image', 'New unit photo (Change of Unit)'],
      ['payment_proof_url', 'MTOP payment proof'],
    ] as const)
      .filter(([field]) => !!(mtop as any)?.[field])
      .map(([field, label]) => ({ key: field, label, url: (mtop as any)[field] as string })),
  ];

  const PhotoGrid = ({ photos }: { photos: Photo[] }) => (
    <View style={styles.grid}>
      {photos.map((photo) => {
        const tone = photo.status ? REVIEW_TONE[photo.status] : null;
        const canOpen = !!photo.url;
        return (
          <TouchableOpacity
            key={photo.key}
            style={styles.tile}
            onPress={() => canOpen && setPreview(photo)}
            activeOpacity={canOpen ? 0.8 : 1}
            accessibilityLabel={`${photo.label}${canOpen ? ', tap to enlarge' : ', not uploaded'}`}
          >
            <View style={styles.thumb}>
              {photo.url && isImage(photo.url) ? (
                <Image source={{ uri: photo.url }} style={styles.thumbImg} resizeMode="cover" />
              ) : photo.url ? (
                <MaterialCommunityIcons name="file-document-outline" size={30} color={colors.textSecondary} />
              ) : (
                <View style={styles.missing}>
                  <MaterialCommunityIcons name="image-off-outline" size={26} color={colors.textMuted} />
                  <Text style={styles.missingText}>Not uploaded</Text>
                </View>
              )}
            </View>
            <Text style={styles.tileLabel} numberOfLines={2}>{photo.label}</Text>
            {tone ? (
              <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text>
              </View>
            ) : null}
            {photo.note ? <Text style={styles.note} numberOfLines={2}>{photo.note}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <>
      <Surface style={styles.card} elevation={1}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>Account details</Text>
          <View style={[styles.pill, { backgroundColor: verified ? colors.successLight : colors.warningLight }]}>
            <Text style={[styles.pillText, { color: verified ? colors.success : '#8A5A00' }]}>
              {verified ? 'Verified' : 'Pending verification'}
            </Text>
          </View>
        </View>
        <Text style={styles.adminOnly}>Visible to administrators only. Passwords are never shown or stored in the app.</Text>
        {accountRows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} selectable>{value}</Text>
          </View>
        ))}
      </Surface>

      {/* Photos from the old sign-up upload (before the MTOP took over). */}
      {!loading && docs.length > 0 ? (
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.cardTitle}>Sign-up photos</Text>
          <PhotoGrid photos={registrationPhotos.filter((photo) => !!photo.url)} />
        </Surface>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.md }} /> : null}

      {!loading && !mtop ? (
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.cardTitle}>MTOP application</Text>
          <Text style={styles.adminOnly}>No MTOP application yet. The driver's documents and photos will appear here once they apply.</Text>
        </Surface>
      ) : null}

      {!loading && mtop ? (
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.cardTitle}>MTOP application</Text>
          {([
            ['Type', mtop.type === 'renewal' ? 'Renewal' : 'New'],
            ['Status', FRANCHISE_STATUS_LABEL[mtop.status] ?? titleCase(mtop.status)],
            ['Record', mtop.franchise_status ? FRANCHISE_RECORD_STATUS_LABEL[mtop.franchise_status] : '—'],
            ['MTOP no.', show(mtop.mtop_number)],
            ['Body no.', show(mtop.body_number)],
            ['Plate', show(mtop.plate_number)],
            ['TODA', show(mtop.toda)],
            ['Expires', mtop.expiry_date ? formatDate(mtop.expiry_date) : '—'],
            ['Filed', mtop.created_at ? formatDate(mtop.created_at) : '—'],
          ] as [string, string][]).map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue} selectable>{value}</Text>
            </View>
          ))}
          {mtopPhotos.length > 0 ? (
            <>
              <Text style={[styles.cardTitle, { marginTop: spacing.md }]}>MTOP documents</Text>
              <PhotoGrid photos={mtopPhotos} />
            </>
          ) : null}
        </Surface>
      ) : null}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.zoomBackdrop}>
          <View style={styles.zoomHeader}>
            <Text style={styles.zoomTitle} numberOfLines={1}>{preview?.label}</Text>
            <TouchableOpacity onPress={() => setPreview(null)} accessibilityLabel="Close" hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          {preview?.url && isImage(preview.url) ? (
            <Image source={{ uri: preview.url }} style={styles.zoomImg} resizeMode="contain" />
          ) : (
            <Text style={styles.zoomText}>This file is not an image and cannot be previewed here.</Text>
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { ...typography.label, fontSize: 11, color: colors.textMuted, letterSpacing: 1.2, marginBottom: spacing.sm, textTransform: 'uppercase' },
  adminOnly: { ...typography.bodySmall, fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowLabel: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary, flexShrink: 0, maxWidth: '45%' },
  rowValue: { ...typography.label, fontSize: 13, color: colors.text, flex: 1, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  tile: { width: '48%' },
  thumb: {
    height: 110,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  missing: { alignItems: 'center', gap: 4 },
  missingText: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted },
  tileLabel: { ...typography.label, fontSize: 12, color: colors.text, marginTop: 6 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
  pillText: { ...typography.labelSmall, fontSize: 10 },
  note: { ...typography.bodySmall, fontSize: 11, color: colors.error, marginTop: 2 },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: spacing.md },
  zoomHeader: { position: 'absolute', top: 48, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  zoomTitle: { ...typography.label, color: '#fff', flex: 1, marginRight: spacing.md },
  zoomImg: { width: '100%', height: '80%' },
  zoomText: { ...typography.body, color: '#fff', textAlign: 'center' },
});
