import type { AdminUserRole } from './adminUserTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';

export const ADMIN_USER_ROLE_OPTIONS: ReadonlyArray<{
  value: AdminUserRole;
  label: TranslationKey;
  description: TranslationKey;
}> = [
  { value: 'BUYER', label: 'role.buyer', description: 'role.buyerDescription' },
  { value: 'SELLER', label: 'role.seller', description: 'role.sellerDescription' },
  { value: 'OPERATOR', label: 'role.operator', description: 'role.operatorDescription' },
  { value: 'ADMIN', label: 'role.admin', description: 'role.adminDescription' },
  { value: 'SUPERADMIN', label: 'role.superadmin', description: 'role.superadminDescription' },
];
