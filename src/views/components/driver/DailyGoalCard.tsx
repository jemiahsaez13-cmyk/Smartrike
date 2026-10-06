import React, { useState } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/controllers/store';
import { updateProfile } from '@/controllers/slices/authSlice';
import { Card } from '@/views/components/common/Card';
import { Input } from '@/views/components/common/Input';
import { Button } from '@/views/components/common/Button';
import { colors, typography } from '@/views/styles/theme';
import { getDriverDailyGoal } from '@/config/constants';
import { notify } from '@/utils/confirm';

const MAX_QUOTA = 100000; // matches users_daily_quota_range (migration 069)

interface Props {
  earnings: number;
  style?: StyleProp<ViewStyle>;
}

// Daily goal progress with a driver-editable quota (saved to users.daily_quota).
export const DailyGoalCard: React.FC<Props> = ({ earnings, style }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const goal = getDriverDailyGoal(user);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const today = earnings || 0;
  const pct = Math.min(100, (today / goal) * 100);
  const remaining = Math.max(0, goal - today);
  const message =
    remaining <= 0
      ? 'Goal reached — great work today!'
      : today > 0
      ? `₱${remaining.toFixed(0)} more to hit today's goal.`
      : 'Complete trips to start earning toward your goal.';

  const startEdit = () => {
    setDraft(String(goal));
    setEditing(true);
  };

  const save = async () => {
    const value = Math.round(Number(draft.replace(/[^0-9.]/g, '')) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value > MAX_QUOTA) {
      notify('Invalid quota', `Enter an amount between ₱1 and ₱${MAX_QUOTA.toLocaleString()}.`);
      return;
    }
    setSaving(true);
    try {
      await dispatch(updateProfile({ daily_quota: value })).unwrap();
      setEditing(false);
    } catch (e: any) {
      notify('Update failed', e?.message || 'Could not save your daily quota. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="elevated" padding="lg" style={style}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Goal</Text>
        {!editing && (
          <TouchableOpacity style={styles.editBtn} onPress={startEdit} hitSlop={8}>
            <MaterialCommunityIcons name="pencil" size={14} color={colors.primary} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <View>
          <Input
            label="Daily quota (₱)"
            value={draft}
            onChangeText={setDraft}
            keyboardType="numeric"
            autoFocus
          />
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => setEditing(false)} disabled={saving} containerStyle={styles.action}>
              Cancel
            </Button>
            <Button onPress={save} loading={saving} disabled={saving} containerStyle={styles.action}>
              Save
            </Button>
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.value, typography.currency]}>
            ₱{today.toFixed(2)} / ₱{goal.toFixed(2)}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.subtitle}>{message}</Text>
        </>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    ...typography.label,
    color: colors.primary,
  },
  value: {
    ...typography.label,
    color: colors.primary,
    marginBottom: 12,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.borderLight,
    borderRadius: 5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 5,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  action: {
    flex: 1,
  },
});
