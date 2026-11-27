import { isUserRole } from '../../auth/model/authTypes';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { asRecord, readText } from '../../../shared/api/responseFields';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { AuditEntry } from '../model/staffTypes';
import { userCode } from '../model/staffRules';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const ACTION_KEYS: Record<string, TranslationKey> = {
  'withdrawal.approve': 'staff.audit.withdrawal.approve',
  'withdrawal.pay': 'staff.audit.withdrawal.pay',
  'user.role.update': 'staff.audit.user.role.update',
  'admin.team.role.update': 'staff.audit.user.role.update',
  'user.block': 'staff.audit.user.block',
  'user.unblock': 'staff.audit.user.unblock',
  'user.2fa.reset': 'staff.audit.user.2fa.reset',
  'user.password.reset': 'staff.audit.user.password.reset',
  'user.session.revoke': 'staff.audit.user.session.revoke',
  'admin.team.create': 'staff.audit.admin.team.create',
  'user.team.update': 'staff.audit.user.team.update',
  'operator.softphone.update': 'staff.audit.operator.softphone.update',
  'user.impersonate': 'staff.audit.user.impersonate',
  'supervisor.operator.create': 'staff.audit.supervisor.operator.create',
  'supervisor.operator.update': 'staff.audit.supervisor.operator.update',
  'supervisor.operator.deactivate': 'staff.audit.supervisor.operator.deactivate',
  'supervisor.operator.activate': 'staff.audit.supervisor.operator.activate',
  'supervisor.block.request': 'staff.audit.supervisor.block.request',
  'supervisor.unblock.request': 'staff.audit.supervisor.unblock.request',
};

const STATUS_KEYS: Record<string, TranslationKey> = {
  REQUESTED: 'staff.auditStatus.REQUESTED',
  APPROVED: 'staff.auditStatus.APPROVED',
  PAID: 'staff.auditStatus.PAID',
  REJECTED: 'staff.auditStatus.REJECTED',
};

/** O'zgarish qiymati: holat, rol yoki xom qiymat. */
function valueText(value: unknown, t: T): string {
  const record = asRecord(value);
  const raw = readText(record, 'status', 'role') || (typeof value === 'string' ? value : '');
  if (!raw) return '';
  if (STATUS_KEYS[raw]) return t(STATUS_KEYS[raw]);
  return isUserRole(raw) ? t(ROLE_LABEL_KEYS[raw]) : raw;
}

/**
 * Audit yozuvi kartadagi «Oxirgi amallari» qatori (admin-foydalanuvchi-karta): «Pul yechish · Sherzod A.» va
 * «1 000 000 so‘m · So‘raldi → Tasdiqlandi». Nomi ma'lum bo'lmagan amal — backend kodi bilan.
 */
export function auditText(entry: AuditEntry, t: T): { title: string; detail: string } {
  const meta = entry.meta;
  const target = readText(meta, 'targetName') || readText(asRecord(meta.after), 'name') || readText(asRecord(meta.before), 'name');
  const action = ACTION_KEYS[entry.action] ? t(ACTION_KEYS[entry.action]) : entry.action;
  const who = target ? shortPersonName(target) : entry.entityId ? userCode(entry.entityId) : '';
  const before = valueText(meta.before, t);
  const after = valueText(meta.after, t);
  const amount = typeof meta.amount === 'number' ? t('staff.money', { amount: formatMoney(meta.amount) }) : '';
  const reason = readText(meta, 'reason');
  const change = before && after ? `${before} → ${after}` : after;
  return {
    title: who ? `${action} · ${who}` : action,
    detail: [amount, change, reason].filter(Boolean).join(' · '),
  };
}
