import { ROLE_LABEL_KEYS } from '../../../features/auth/lib/roleLabels';
import type { ActionDenial, StaffPermissions } from '../../../features/staff/model/staffRules';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortPersonName } from '../../../shared/lib/personName';
import { operatorSummary, type GroupKey, type StaffGroup } from './staffList';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export const groupLabel = (key: GroupKey, t: T) => (key === 'UNKNOWN' ? t('staff.status.unknownRole') : t(ROLE_LABEL_KEYS[key]));

/** Guruh sarlavhasi: «Operator · 13 — jamoa: nazoratchi Rustam Q.; 12 faol, 1 bloklangan». */
export function groupSuffix(group: StaffGroup, t: T, blockedOnly: boolean): string {
  const members = group.all ?? group.users;
  const count = members.length;
  if (group.key === 'UNKNOWN') return t('staff.group.unknown', { count });
  if (blockedOnly) return t('staff.group.blocked', { count });
  if (group.key !== 'OPERATOR_LEAD') return t('staff.group.count', { count });
  const { supervisors, active, blocked } = operatorSummary(members);
  if (supervisors.length === 1) return t('staff.group.operatorsTeam', { count, name: shortPersonName(supervisors[0]), active, blocked });
  if (supervisors.length > 1) return t('staff.group.operatorsTeams', { count, teams: supervisors.length, active, blocked });
  return t('staff.group.operators', { count, active, blocked });
}

/** Yopiq amal sababi (karta K4/K5): `staff.deny.<amal>.<sabab>`. */
export const denialKey = (action: keyof StaffPermissions, denial: ActionDenial) => `staff.deny.${action}.${denial}` as TranslationKey;
