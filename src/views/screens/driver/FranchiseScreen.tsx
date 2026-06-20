import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchMyApplication, submitApplication } from '@/controllers/slices/franchiseSlice';
import {
  REQUIRED_DOCUMENTS,
  FRANCHISE_FLOW,
  FRANCHISE_STATUS_LABEL,
  DOCUMENT_REVIEW_LABEL,
  FranchiseType,
  FranchiseDocument,
  docReviewStatus,
  anyDocumentRejected,
} from '@/models/entities/Franchise';
import { colors, spacing, shadows, typography, radius } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';
import { Button } from '@/views/components/common/Button';
import { Card } from '@/views/components/common/Card';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';

export const FranchiseScreen = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { myApplication, loading } = useAppSelector((state) => state.franchise);
  const driver = user as any;

  const [docs, setDocs] = useState<FranchiseDocument[]>(
    REQUIRED_DOCUMENTS.map((name) => ({
      name,
      uploaded: false,
      file_url: null,
      uploaded_at: null,
      review_status: 'pending' as const,
      review_remarks: null,
    }))
  );
  const [plate, setPlate] = useState<string>(driver?.vehicle_details?.plate_number || 'ABC-1234');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) dispatch(fetchMyApplication(user.id));
  }, [user?.id]);

  const toggleDoc = (idx: number) =>
    setDocs((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        const uploaded = !d.uploaded;
        return {
          ...d,
          uploaded,
          // Record submission metadata so the admin can review each document.
          uploaded_at: uploaded ? new Date().toISOString() : null,
          file_url: uploaded ? `document://${encodeURIComponent(d.name)}` : null,
          review_status: 'pending' as const,
          review_remarks: null,
        };
      })
    );

  const allUploaded = docs.every((d) => d.uploaded);

  const handleSubmit = async (type: FranchiseType) => {
    if (!allUploaded) {
      Alert.alert('Incomplete', 'Please upload all required documents first.');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(
        submitApplication({
          driver_id: user!.id,
          driver_name: user!.name,
          toda: driver?.toda_membership || 'FEDTODAB',
          plate_number: plate,
          type,
          documents: docs,
          fees: type === 'renewal' ? 1000 : 1500,
          remarks: null,
        })
      ).unwrap();
      Alert.alert('Submitted', 'Your franchise application has been submitted for review.');
    } catch {
      Alert.alert('Error', 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = () => {
    Alert.alert('Renew Franchise', 'Submit a renewal application for your MTOP?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Renew', onPress: () => handleSubmit('renewal') },
    ]);
  };

  if (loading && !myApplication) return <Loading message="Loading franchise records..." />;

  const isActive = myApplication?.status === 'issued';
  const inProgress =
    myApplication &&
    myApplication.status !== 'issued' &&
    myApplication.status !== 'rejected';

  const Header = ({ subtitle }: { subtitle: string }) => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Franchise (MTOP)</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </View>
  );

  // --- Active MTOP ---
  if (isActive) {
    return (
      <SafeAreaView style={styles.container}>
        <Header subtitle="Your franchise is active" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Surface style={styles.mtopCard} elevation={0}>
            <View style={styles.mtopHeader}>
              <View style={styles.mtopBrand}>
                <View style={styles.mtopLogo}>
                  <TricycleIcon size={24} color="#fff" />
                </View>
                <Text style={styles.mtopBrandText}>FEDTODAB MTOP</Text>
              </View>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            </View>

            <View style={styles.mtopBody}>
              <Text style={styles.mtopLabel}>MTOP NUMBER</Text>
              <Text style={styles.mtopNumber}>{myApplication?.mtop_number}</Text>

              <View style={styles.mtopGrid}>
                <View style={styles.mtopItem}>
                  <Text style={styles.mtopLabel}>OPERATOR</Text>
                  <Text style={styles.mtopValue}>{myApplication?.driver_name}</Text>
                </View>
                <View style={styles.mtopItem}>
                  <Text style={styles.mtopLabel}>PLATE</Text>
                  <Text style={styles.mtopValue}>{myApplication?.plate_number}</Text>
                </View>
              </View>

              <View style={styles.mtopDivider} />

              <View style={styles.mtopFooter}>
                <View>
                  <Text style={styles.mtopLabel}>TODA</Text>
                  <Text style={styles.mtopValue}>{myApplication?.toda}</Text>
                </View>
                <MaterialCommunityIcons name="shield-check" size={24} color={colors.secondary} />
              </View>
            </View>
          </Surface>

          <Button 
            variant="outline" 
            onPress={handleRenew}
            style={styles.renewBtn}
          >
            <MaterialCommunityIcons name="autorenew" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            Renew Franchise
          </Button>

          <Text style={styles.note}>
            Keep your OR/CR and TODA membership updated. Renew before expiry to avoid penalties.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- In-progress application: stepper ---
  if (inProgress) {
    const currentIdx = FRANCHISE_FLOW.indexOf(myApplication!.status);
    return (
      <SafeAreaView style={styles.container}>
        <Header subtitle={`Application ${myApplication!.type === 'renewal' ? '(Renewal)' : '(New)'} in review`} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card variant="elevated" padding="lg" style={styles.statusCard}>
            <Text style={styles.statusBig}>{FRANCHISE_STATUS_LABEL[myApplication!.status]}</Text>
            <Text style={styles.statusSub}>Plate {myApplication!.plate_number} • ₱{myApplication!.fees} fees</Text>
          </Card>

          <View style={styles.stepper}>
            {FRANCHISE_FLOW.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <View key={step} style={styles.step}>
                  <View style={styles.stepIndicatorCol}>
                    <View
                      style={[
                        styles.stepDot,
                        done && styles.stepDotDone,
                        active && styles.stepDotActive,
                      ]}
                    >
                      {done ? (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      ) : (
                        <Text style={[styles.stepNum, active && { color: '#fff' }]}>{idx + 1}</Text>
                      )}
                    </View>
                    {idx < FRANCHISE_FLOW.length - 1 && (
                      <View style={[styles.stepLine, done && styles.stepLineDone]} />
                    )}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepLabel, (done || active) && { color: colors.text }]}>
                      {FRANCHISE_STATUS_LABEL[step]}
                    </Text>
                    {active && <Text style={styles.stepHint}>In progress with FEDTODAB / LGU</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Document Review</Text>
          <Card variant="outlined" padding="none" style={styles.docReviewCard}>
            {myApplication!.documents.map((doc, idx) => {
              const status = docReviewStatus(doc);
              const color =
                status === 'approved' ? colors.success : status === 'rejected' ? colors.error : colors.warning;
              return (
                <View
                  key={doc.name}
                  style={[styles.docReviewRow, idx === myApplication!.documents.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <MaterialCommunityIcons
                    name={status === 'approved' ? 'check-circle' : status === 'rejected' ? 'close-circle' : 'clock-outline'}
                    size={18}
                    color={color}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docReviewName}>{doc.name}</Text>
                    {status === 'rejected' && doc.review_remarks ? (
                      <Text style={styles.docReviewRemark}>{doc.review_remarks}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.docReviewStatus, { color }]}>{DOCUMENT_REVIEW_LABEL[status]}</Text>
                </View>
              );
            })}
          </Card>

          {anyDocumentRejected(myApplication!.documents) ? (
            <Card variant="outlined" padding="md" style={[styles.remarkCard, { borderColor: colors.error }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.remarkText}>
                Some documents were rejected. Please re-upload clear, valid copies to continue.
              </Text>
            </Card>
          ) : null}

          {myApplication!.remarks ? (
            <Card variant="outlined" padding="md" style={styles.remarkCard}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
              <Text style={styles.remarkText}>{myApplication!.remarks}</Text>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Apply form (no application or rejected) ---
  return (
    <SafeAreaView style={styles.container}>
      <Header subtitle="Apply for a tricycle franchise" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {myApplication?.status === 'rejected' && (
          <Card variant="outlined" padding="md" style={[styles.remarkCard, { borderColor: colors.error }]}>
            <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} />
            <Text style={styles.remarkText}>
              Previous application was rejected{myApplication.remarks ? `: ${myApplication.remarks}` : '.'} You may re-apply.
            </Text>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Unit Details</Text>
        <Card variant="elevated" padding="md" style={styles.infoCard}>
          <MaterialCommunityIcons name="rickshaw" size={24} color={colors.primary} />
          <View>
            <Text style={styles.infoLabel}>PLATE NUMBER</Text>
            <Text style={styles.infoValue}>{plate}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Required Documents</Text>
        <Card variant="outlined" padding="none" style={styles.docCard}>
          {docs.map((doc, idx) => (
            <TouchableOpacity key={doc.name} style={[styles.docRow, idx === docs.length - 1 && { borderBottomWidth: 0 }]} onPress={() => toggleDoc(idx)} activeOpacity={0.7}>
              <View style={[styles.docIcon, doc.uploaded && { backgroundColor: colors.successLight }]}>
                <MaterialCommunityIcons
                  name={doc.uploaded ? 'check' : 'plus'}
                  size={18}
                  color={doc.uploaded ? colors.success : colors.textMuted}
                />
              </View>
              <Text style={[styles.docName, doc.uploaded && { color: colors.text }]}>{doc.name}</Text>
              <Text style={[styles.docAction, doc.uploaded && { color: colors.success }]}>
                {doc.uploaded ? 'Uploaded' : 'Add'}
              </Text>
            </TouchableOpacity>
          ))}
        </Card>

        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Filing & Franchise Fees</Text>
          <Text style={[styles.feeValue, typography.currency]}>₱1,500.00</Text>
        </View>

        <Button
          variant="primary"
          onPress={() => handleSubmit('new')}
          disabled={!allUploaded || submitting}
          loading={submitting}
        >
          Submit Application
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.surface 
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.screen,
  },
  headerTitle: { 
    ...typography.h1,
    fontSize: 28,
  },
  headerSubtitle: { 
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: { 
    paddingHorizontal: spacing.screen, 
    paddingBottom: spacing.xxl 
  },
  mtopCard: { 
    backgroundColor: colors.primary,
    borderRadius: radius.xl, 
    overflow: 'hidden',
    ...shadows.lg,
    marginBottom: spacing.xl,
  },
  mtopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mtopBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mtopLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mtopBrandText: {
    ...typography.label,
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1,
  },
  activeBadge: { 
    backgroundColor: colors.secondary, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: radius.pill 
  },
  activeBadgeText: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1 
  },
  mtopBody: {
    padding: spacing.lg,
  },
  mtopLabel: { 
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.5)', 
    fontSize: 9,
    letterSpacing: 1.5,
  },
  mtopNumber: { 
    ...typography.h1,
    color: '#fff', 
    fontSize: 32, 
    marginTop: 4, 
    marginBottom: spacing.xl,
  },
  mtopGrid: { 
    flexDirection: 'row', 
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  mtopItem: {
    flex: 1,
  },
  mtopValue: { 
    ...typography.subtitle,
    color: '#fff', 
    fontSize: 15,
    marginTop: 2,
  },
  mtopDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: spacing.md,
  },
  mtopFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  renewBtn: {
    height: 52,
    marginBottom: spacing.lg,
  },
  note: { 
    ...typography.bodySmall,
    color: colors.textMuted, 
    textAlign: 'center',
    lineHeight: 18,
  },
  statusCard: { 
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  statusBig: { 
    ...typography.h2,
    color: colors.primary 
  },
  statusSub: { 
    ...typography.bodySmall,
    color: colors.textSecondary, 
    marginTop: 4 
  },
  stepper: { 
    backgroundColor: colors.surfaceAlt, 
    borderRadius: radius.lg, 
    padding: spacing.lg, 
    marginBottom: spacing.xl,
  },
  step: { flexDirection: 'row' },
  stepIndicatorCol: { alignItems: 'center', marginRight: spacing.md },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotDone: { backgroundColor: colors.secondary },
  stepDotActive: { backgroundColor: colors.primary },
  stepNum: { 
    ...typography.labelSmall,
    color: colors.textMuted 
  },
  stepLine: { 
    width: 2, 
    flex: 1, 
    minHeight: 24, 
    backgroundColor: colors.border, 
    marginVertical: 4 
  },
  stepLineDone: { backgroundColor: colors.secondary },
  stepBody: { flex: 1, paddingBottom: spacing.lg },
  stepLabel: { 
    ...typography.label,
    color: colors.textMuted,
  },
  stepHint: { 
    ...typography.bodySmall,
    color: colors.textSecondary, 
    marginTop: 2 
  },
  docReviewCard: {
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  docReviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  docReviewName: {
    ...typography.label,
    fontSize: 13,
    color: colors.text,
  },
  docReviewRemark: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.error,
    marginTop: 2,
  },
  docReviewStatus: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  remarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.xl,
  },
  remarkText: { 
    flex: 1, 
    ...typography.bodySmall,
    color: colors.textSecondary, 
  },
  sectionTitle: { 
    ...typography.label,
    color: colors.textMuted, 
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: spacing.md, 
    marginTop: spacing.md 
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoLabel: {
    ...typography.labelSmall,
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1,
  },
  infoValue: { 
    ...typography.subtitle,
    fontSize: 16,
    color: colors.text 
  },
  docCard: { 
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  docRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docName: { 
    flex: 1, 
    ...typography.label,
    color: colors.textSecondary 
  },
  docAction: { 
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
  feeRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xl,
  },
  feeLabel: { 
    ...typography.body,
    color: colors.textSecondary,
  },
  feeValue: { 
    ...typography.h2,
    color: colors.text 
  },
});
