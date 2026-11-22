import { User } from '@/models/entities/User';

const DAY_MS = 86_400_000;

/** Duration choices on the Suspend Account form (days). */
export const SUSPENSION_PRESET_DAYS = [1, 3, 7, 15, 30];
export const SUSPENSION_MAX_DAYS = 365;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

export const dayLabel = (days: number) => `${days} day${days === 1 ? '' : 's'}`;

type SuspensionFields = Pick<User, 'suspended_at' | 'suspended_until' | 'suspension_reason'>;

/** The suspension already ran out (the account can be reactivated). */
export const suspensionEnded = (user: SuspensionFields, now: Date = new Date()): boolean =>
  !!user.suspended_until && new Date(user.suspended_until).getTime() <= now.getTime();

/**
 * Duration lines shown to the suspended user and the admin, e.g.
 *   "7 days · Nov 23, 2026, 3:00 PM – Nov 30, 2026, 3:00 PM"
 *   "6 days left"
 */
export const describeSuspension = (user: SuspensionFields, now: Date = new Date()) => {
  if (!user.suspended_until) {
    return { period: 'Until reactivated by the administrator', remaining: null as string | null };
  }
  const until = new Date(user.suspended_until).getTime();
  const total = user.suspended_at ? Math.round((until - new Date(user.suspended_at).getTime()) / DAY_MS) : null;
  const left = until - now.getTime();
  const remaining = left <= 0
    ? 'Ended'
    : left < DAY_MS
    ? `${Math.max(1, Math.ceil(left / 3_600_000))} hour${Math.ceil(left / 3_600_000) === 1 ? '' : 's'} left`
    : `${dayLabel(Math.ceil(left / DAY_MS))} left`;
  const range = user.suspended_at
    ? `${formatDateTime(user.suspended_at)} – ${formatDateTime(user.suspended_until)}`
    : `Until ${formatDateTime(user.suspended_until)}`;
  return { period: total ? `${dayLabel(total)} · ${range}` : range, remaining };
};

/** Sign-in message for a suspended account: duration and reason. */
export const suspensionMessage = (user: SuspensionFields): string => {
  const { period, remaining } = describeSuspension(user);
  const lines = [
    'Your account is suspended by the TODA administrator.',
    `Duration: ${period}${remaining && remaining !== 'Ended' ? ` (${remaining})` : ''}`,
  ];
  if (user.suspension_reason) lines.push(`Reason: ${user.suspension_reason}`);
  lines.push(user.suspended_until
    ? 'You can sign in again when the suspension ends. To appeal, contact the FEDTODAB office.'
    : 'Please contact the FEDTODAB office to appeal.');
  return lines.join('\n');
};
