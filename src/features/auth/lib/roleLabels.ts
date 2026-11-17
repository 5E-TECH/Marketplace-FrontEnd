import type { TranslationKey } from '../../../shared/i18n/translations';
import type { UserRole } from '../model/authTypes';

/** Rolning foydalanuvchiga ko'rinadigan nomi (header, ruxsat xabarlari). */
export const ROLE_LABEL_KEYS: Record<UserRole, TranslationKey> = {
  AFFILIATE: 'role.affiliate',
  WHOLESALER: 'role.wholesaler',
  OPERATOR_LEAD: 'role.operatorLead',
  SUPERVISOR: 'role.supervisor',
  WAREHOUSE: 'role.warehouse',
  FINANCE: 'role.finance',
  ADMIN: 'role.adminShort',
  SUPERADMIN: 'role.superadminShort',
};
