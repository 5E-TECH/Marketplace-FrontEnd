import type { TranslationKey } from '../../../shared/i18n/translations';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import type { OperatorLive, OperatorStatsRow } from '../model/operatorTypes';
import type { UserAccount } from '../model/staffTypes';
import { lastLoginText } from './staffFormat';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Softfon hisobi — operator ID sidan («U-2088» → «2088»). */
export const softphoneAccountOf = (code: string) => code.replace(/^U-/, '');

const isToday = (iso: string) => tashkentDate(Date.parse(iso)) === tashkentDate();
const minutesSince = (iso: string, now: number) => Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));

/** «01:12» — suhbat davomiyligi. */
function clock(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Telefoniya bosqichi: «suhbatda 01:12 · L-1284», «jiringlamoqda · L-1254»; bo'sh — null. */
export function activityText(live: OperatorLive | null, t: T, now = Date.now(), withLead = true): string | null {
  const activity = live?.activity;
  if (!activity || activity.kind === 'IDLE') return null;
  const text = activity.kind === 'IN_CALL'
    ? t('staff.ops.act.IN_CALL', { time: activity.since ? clock(activity.since, now) : '00:00' })
    : t(`staff.ops.act.${activity.kind}`);
  return activity.leadId && withLead ? `${text} · ${activity.leadId}` : text;
}

/**
 * «Hozir» ustunining ikkinchi qatori (admin-operatorlar-jamoasi): onlayn — «13:15 dan · suhbatda 01:12 · L-1284»,
 * tanaffus — «14:15 dan · 22 daq», oflayn — «14:20 dan» yoki «bugun kirmagan».
 */
export function presenceParts(user: UserAccount, live: OperatorLive | null, t: T, now = Date.now(), withLead = true): { since: string | null; detail: string | null } {
  const since = live?.since ? t('staff.ops.since', { time: tashkentClock(Date.parse(live.since)) }) : null;
  const state = live?.state ?? 'OFFLINE';
  if (state === 'ONLINE') return { since, detail: activityText(live, t, now, withLead) };
  if (state === 'BREAK') return { since, detail: live?.since ? t('staff.ops.forMinutes', { min: minutesSince(live.since, now) }) : null };
  if (since) return { since, detail: null };
  return { since: null, detail: user.lastLoginAt && isToday(user.lastLoginAt) ? null : t('staff.ops.notToday') };
}

export function presenceLine(user: UserAccount, live: OperatorLive | null, t: T, now = Date.now(), withLead = true): string | null {
  const { since, detail } = presenceParts(user, live, t, now, withLead);
  return [since, detail].filter(Boolean).join(' · ') || null;
}

/** «38 · 41%» va «tasdiq 9 / 22 · 4 daq». */
export function statsText(stats: OperatorStatsRow, t: T): { main: string; sub: string } {
  const rate = stats.approveRate === null ? '—' : `${stats.approveRate.toString()}%`;
  return {
    main: t('staff.ops.stats', { attempts: stats.attempts, rate }),
    sub: stats.firstCallMedianMinutes === null
      ? t('staff.ops.statsSubNoMedian', { confirmed: stats.confirmed, valid: stats.valid })
      : t('staff.ops.statsSub', { confirmed: stats.confirmed, valid: stats.valid, median: stats.firstCallMedianMinutes }),
  };
}

/** «1/5 · +3»: hozirgi bronlar / chegara va rejalashtirilgan qo'ng'iroqlar. */
export function bookingsText(live: OperatorLive): string {
  const base = `${live.activeBookings.toString()}/${live.maxBookings.toString()}`;
  return live.scheduledCalls ? `${base} · +${live.scheduledCalls.toString()}` : base;
}

/** Nazoratchi: «bugun 08:55 dan tizimda» · «oxirgi kirish 13.01, 17:40» · «hali kirmagan». */
export function supervisorPresence(user: UserAccount, t: T): string {
  if (!user.lastLoginAt) return t(user.lastLoginAt === null ? 'staff.ops.neverIn' : 'staff.ops.lastSeen', { when: '—' });
  return isToday(user.lastLoginAt)
    ? t('staff.ops.inSystemToday', { time: tashkentClock(Date.parse(user.lastLoginAt)) })
    : t('staff.ops.lastSeen', { when: lastLoginText(user.lastLoginAt, t) });
}
