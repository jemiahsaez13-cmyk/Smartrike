import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/views/styles/theme';

// Read the existing notification format so previously saved notices also use
// the four-field layout. Keep multiline incident details and penalties intact.
export const parseViolationNotice = (body: string) => {
  const content = body.replace(/\r\n/g, '\n');
  const detailsAndPenalty = content.match(/^Details:[ \t]*([\s\S]*)\nPenalty(?: \/ sanction)?:[ \t]*([\s\S]*)$/m);
  return {
    violation: content.match(/^Violation:[ \t]*(.*)$/m)?.[1]?.trim() || 'Not specified',
    incidentDate: content.match(/^Incident date:[ \t]*(.*)$/m)?.[1]?.trim() || 'Not specified',
    details: (detailsAndPenalty?.[1] ?? content.match(/^Details:[ \t]*(.*)$/m)?.[1])?.trim() || 'No additional details.',
    penalty: (detailsAndPenalty?.[2] ?? content.match(/^Penalty(?: \/ sanction)?:[ \t]*([\s\S]*)$/m)?.[1])?.trim() || 'None specified.',
  };
};

export const ViolationNotificationContent = ({ body }: { body: string }) => {
  const fields = parseViolationNotice(body);
  return (
    <View style={styles.content}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.error} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.label}>Violation</Text>
          <Text style={styles.title}>{fields.violation}</Text>
        </View>
      </View>
      <View style={styles.date}>
        <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.textSecondary} />
        <View style={styles.headingCopy}>
          <Text style={styles.label}>Incident date</Text>
          <Text style={styles.value}>{fields.incidentDate}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <Text style={styles.label}>Details</Text>
        <Text style={styles.value}>{fields.details}</Text>
      </View>
      <View style={styles.penalty}>
        <Text style={styles.label}>Penalty</Text>
        <Text style={styles.penaltyValue}>{fields.penalty}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, minWidth: 0, padding: spacing.lg, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.labelSmall, fontSize: 12, color: colors.textSecondary },
  title: { ...typography.h3, fontSize: 16, lineHeight: 24, color: colors.text },
  value: { ...typography.body, fontSize: 14, lineHeight: 22, color: colors.textSecondary },
  date: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  details: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md, gap: spacing.xs },
  penalty: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  penaltyValue: { ...typography.label, fontSize: 14, lineHeight: 22, color: colors.text },
});
