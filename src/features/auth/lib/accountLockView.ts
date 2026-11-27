import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { formatUzPhone } from '../../../shared/lib/phone';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { userCode } from '../../staff/model/staffRules';
import type { AccountLock } from './accountLock';
import { ROLE_LABEL_KEYS } from './roleLabels';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** «Bobur Y. · Sotuvchi · U-0110»; ism kelmasa — telefon. */
export function lockAccountLine(lock: AccountLock, t: T, withId = true): string {
  const { name, role, id, phone } = lock.account;
  const who = name ? shortPersonName(name) : phone ? formatUzPhone(phone) : null;
  return [who, role ? t(ROLE_LABEL_KEYS[role]) : null, withId && id ? userCode(id) : null].filter(Boolean).join(' · ') || '—';
}

export const lockDate = (lock: AccountLock) => (lock.at ? tashkentDateTime(lock.at) : null);

/** Kim qaror qildi: bloklash — admin, nofaol qilish — nazoratchi (umumiy-sessiya 6: «… · admin qarori»). */
export function lockDecision(lock: AccountLock, t: T): string {
  const decision = t(lock.kind === 'INACTIVE' || lock.by?.role === 'SUPERVISOR' ? 'lock.decision.supervisor' : 'lock.decision.admin');
  return [lockDate(lock), decision].filter(Boolean).join(' · ');
}

export const lockSum = (amount: number, t: T) => t('lock.sum', { amount: formatMoney(amount) });

/** «bekor qilindi · 0 so‘m» yoki «ushlab turiladi · 120 000 so‘m». */
export function lockHeldText(lock: AccountLock, t: T): string | null {
  const held = lock.seller?.heldBonus;
  if (!held) return null;
  return t(held.cancelled ? 'lock.heldCancelled' : 'lock.heldKept', { amount: lockSum(held.amount, t) });
}

/** Oynadagi sabab: «Aldovli reklama — kreativ o‘chirildi» (dalil kichik harf bilan). */
export function lockReasonLine(lock: AccountLock): string | null {
  if (!lock.reason) return null;
  if (!lock.evidence) return lock.reason;
  return `${lock.reason} — ${lock.evidence.charAt(0).toLocaleLowerCase()}${lock.evidence.slice(1)}`;
}
