import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { fetchMyApplication, submitApplication } from '@/controllers/slices/franchiseSlice';
import {
  REQUIRED_DOCUMENTS,
  FRANCHISE_FLOW,
  FRANCHISE_STATUS_LABEL,
  FranchiseType,
} from '@/models/entities/Franchise';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { Loading } from '@/views/components/common/Loading';

export const FranchiseScreen = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { myApplication, loading } = useAppSelector((state) => state.franchise);
  const driver = user as any;

  const [docs, setDocs] = useState(REQUIRED_DOCUMENTS.map((name) => ({ name, uploaded: false })));
  const [plate, setPlate] = useState<string>(driver?.vehicle_details?.plate_number || 'ABC-1234');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) dispatch(fetchMyApplication(user.id));
  }, [user?.id]);

  const toggleDoc = (idx: number) =>
    setDocs((prev) => prev.map((d, i) => (i === idx ? { ...d, uploaded: !d.uploaded } : d)));

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
    <LinearGradient colors={['#1E90FF', '#0DA5C0', '#00C9FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <Text style={styles.headerTitle}>Franchise (MTOP)</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </LinearGradient>
  );

  // --- Active MTOP ---
  if (isActive) {
    return (
      <View style={styles.container}>
        <Header subtitle="Your franchise is active" />
        <ScrollView contentContainerStyle={styles.content}>
          <Surface style={styles.mtopCard} elevation={3}>
            <LinearGradient colors={['#0D1B2A', '#1873CC']} style={styles.mtopGradient}>
              <View style={styles.mtopTop}>
                <MaterialCommunityIcons name="shield-check" size={28} color="#fff" />
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.mtopLabel}>MTOP NUMBER</Text>
              <Text style={styles.mtopNumber}>{myApplication?.mtop_number}</Text>
              <View style={styles.mtopRow}>
                <View>
                  <Text style={styles.mtopSmallLabel}>OPERATOR</Text>
                  <Text style={styles.mtopValue}>{myApplication?.driver_name}</Text>
                </View>
                <View>
                  <Text style={styles.mtopSmallLabel}>PLATE</Text>
                  <Text style={styles.mtopValue}>{myApplication?.plate_number}</Text>
                </View>
                <View>
                  <Text style={styles.mtopSmallLabel}>TODA</Text>
                  <Text style={styles.mtopValue}>{myApplication?.toda}</Text>
                </View>
              </View>
            </LinearGradient>
          </Surface>

          <TouchableOpacity style={styles.renewBtn} onPress={handleRenew} activeOpacity={0.85}>
            <MaterialCommunityIcons name="autorenew" size={20} color={colors.primary} />
            <Text style={styles.renewText}>Renew Franchise</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Keep your OR/CR and TODA membership updated. Renew before expiry to avoid penalties.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // --- In-progress application: stepper ---
  if (inProgress) {
    const currentIdx = FRANCHISE_FLOW.indexOf(myApplication!.status);
    return (
      <View style={styles.container}>
        <Header subtitle={`Application ${myApplication!.type === 'renewal' ? '(Renewal)' : '(New)'} in review`} />
        <ScrollView contentContainerStyle={styles.content}>
          <Surface style={styles.statusCard} elevation={2}>
            <Text style={styles.statusBig}>{FRANCHISE_STATUS_LABEL[myApplication!.status]}</Text>
            <Text style={styles.statusSub}>Plate {myApplication!.plate_number} • ₱{myApplication!.fees} fees</Text>
          </Surface>

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

          {myApplication!.remarks ? (
            <Surface style={styles.remarkCard} elevation={1}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
              <Text style={styles.remarkText}>{myApplication!.remarks}</Text>
            </Surface>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // --- Apply form (no application or rejected) ---
  return (
    <View style={styles.container}>
      <Header subtitle="Apply for a tricycle franchise" />
      <ScrollView contentContainerStyle={styles.content}>
        {myApplication?.status === 'rejected' && (
          <Surface style={[styles.remarkCard, { borderColor: colors.error }]} elevation={1}>
            <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} />
            <Text style={styles.remarkText}>
              Previous application was rejected{myApplication.remarks ? `: ${myApplication.remarks}` : '.'} You may re-apply.
            </Text>
          </Surface>
        )}

        <Text style={styles.sectionTitle}>Unit</Text>
        <Surface style={styles.infoCard} elevation={1}>
          <MaterialCommunityIcons name="rickshaw" size={22} color={colors.primary} />
          <Text style={styles.infoText}>Plate Number: {plate}</Text>
        </Surface>

        <Text style={styles.sectionTitle}>Required Documents</Text>
        <Surface style={styles.docCard} elevation={1}>
          {docs.map((doc, idx) => (
            <TouchableOpacity key={doc.name} style={styles.docRow} onPress={() => toggleDoc(idx)} activeOpacity={0.7}>
              <MaterialCommunityIcons
                name={doc.uploaded ? 'checkbox-marked-circle' : 'cloud-upload-outline'}
                size={22}
                color={doc.uploaded ? colors.success : colors.textLight}
              />
              <Text style={[styles.docName, doc.uploaded && { color: colors.text }]}>{doc.name}</Text>
              <Text style={[styles.docAction, doc.uploaded && { color: colors.success }]}>
                {doc.uploaded ? 'Uploaded' : 'Upload'}
              </Text>
            </TouchableOpacity>
          ))}
        </Surface>

        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Estimated Filing & Franchise Fees</Text>
          <Text style={styles.feeValue}>₱1,500.00</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!allUploaded || submitting) && { opacity: 0.6 }]}
          onPress={() => handleSubmit('new')}
          disabled={!allUploaded || submitting}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#1E90FF', '#0DA5C0']} style={styles.submitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Application'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: '500' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  mtopCard: { borderRadius: 20, overflow: 'hidden', ...shadows.lg },
  mtopGradient: { padding: spacing.lg },
  mtopTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  activeBadge: { backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  mtopLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  mtopNumber: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 1, marginTop: 4, marginBottom: spacing.lg },
  mtopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mtopSmallLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  mtopValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  renewText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  note: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.lg, lineHeight: 19, textAlign: 'center' },
  statusCard: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.md, alignItems: 'center' },
  statusBig: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statusSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  stepper: { backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderLight },
  step: { flexDirection: 'row' },
  stepIndicatorCol: { alignItems: 'center', marginRight: spacing.md },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotDone: { backgroundColor: colors.success },
  stepDotActive: { backgroundColor: colors.primary },
  stepNum: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  stepLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.borderLight, marginVertical: 2 },
  stepLineDone: { backgroundColor: colors.success },
  stepBody: { flex: 1, paddingBottom: spacing.lg },
  stepLabel: { fontSize: 15, fontWeight: '700', color: colors.textLight },
  stepHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  remarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  remarkText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoText: { fontSize: 15, fontWeight: '600', color: colors.text },
  docCard: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: 12 },
  docName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  docAction: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  feeLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  feeValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  submitBtn: { height: 54, borderRadius: 16, overflow: 'hidden', marginTop: spacing.sm },
  submitGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
