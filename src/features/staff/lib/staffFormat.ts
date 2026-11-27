import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { formatUzPhone } from '../../../shared/lib/phone';
import { tashkentClock, tashkentDate, tashkentDay } from '../../../shared/lib/tashkentTime';
import type { StaffSession, UserAccount } from '../model/staffTypes';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const timeOf = (iso: string) => Date.parse(iso);
const isToday = (iso: string) => tashkentDate(timeOf(iso)) === tashkentDate();
const sameYear = (iso: string) => tashkentDate(timeOf(iso)).slice(0, 4) === tashkentDate().slice(0, 4);

/** «13.01» — joriy yilda yilsiz (Toshkent sanasi). */
function dayMonth(iso: string): string {
  const [day, month] = tashkentDay(iso).split('.');
  return `${day}.${month}`;
}

/** Ro'yxatdagi «Oxirgi kirish»: «bugun, 14:37» · «13.01, 17:40» · o'tgan yil — «28.12.2025». */
export function lastLoginText(iso: string, t: T): string {
  if (Number.isNaN(timeOf(iso))) return '—';
  if (isToday(iso)) return t('staff.time.today', { time: tashkentClock(timeOf(iso)) });
  return sameYear(iso) ? `${dayMonth(iso)}, ${tashkentClock(timeOf(iso))}` : tashkentDay(iso);
}

/** «Qo‘shilgan»: bugun — «bugun, 14:52», aks holda sana «26.12.2026» (admin-foydalanuvchi-karta). */
export function dayText(iso: string, t: T): string {
  if (Number.isNaN(timeOf(iso))) return '—';
  return isToday(iso) ? t('staff.time.today', { time: tashkentClock(timeOf(iso)) }) : tashkentDay(iso);
}

/** Qisqa payt (2FA tiklangan): bugun — «14:20», aks holda «13.01, 14:20». */
export function momentText(iso: string): string {
  if (Number.isNaN(timeOf(iso))) return '—';
  return isToday(iso) ? tashkentClock(timeOf(iso)) : `${dayMonth(iso)}, ${tashkentClock(timeOf(iso))}`;
}

/** Oynadagi kim qatori: «bugun 14:37 da kirdi» · «13.01 da kirdi». */
export function enteredText(iso: string, t: T): string {
  return isToday(iso) ? t('staff.entered.today', { time: tashkentClock(timeOf(iso)) }) : t('staff.entered.date', { date: sameYear(iso) ? dayMonth(iso) : tashkentDay(iso) });
}

/** Ro'yxat va oynalardagi ism: «Laylo N.»; ismi yo'q bo'lsa — telefon. */
export const displayName = (user: Pick<UserAccount, 'name' | 'phone'>) => (user.name.trim() ? shortPersonName(user.name) : formatUzPhone(user.phone));

/** Sessiya qurilmasi: «Chrome · Windows». */
export const sessionDevice = (session: Pick<StaffSession, 'browser' | 'os'>) => [session.browser, session.os].filter(Boolean).join(' · ');
