import type { UserRole } from '../../auth/model/authTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';

/**
 * «Kim nima qila oladi» (TZ 3, admin-rollar): ruxsatlar tizimda belgilangan — backend guard'lari (BE-05 `@Roles`)
 * bilan bir xil, admin o'zgartirmaydi (faqat ko'rish). Superadmin hamma amalni bajaradi.
 */
export type Grant = 'yes' | 'own';

export interface Permission {
  id: string;
  label: TranslationKey;
  /** Amal ostidagi izoh: «faqat superadmin o‘zgartiradi; admin — faqat ko‘radi». */
  note?: TranslationKey;
  /** Superadmindan boshqa rollar; yo'q rol — ruxsat yo'q. */
  grants: Partial<Record<UserRole, Grant>>;
  /** «o‘ziniki» sababi (maslahat va rol paneli). */
  own?: Partial<Record<UserRole, TranslationKey>>;
}

/** Matritsa ustunlari tartibi: tashqi foydalanuvchilardan superadmingacha. */
export const MATRIX_ROLES: readonly UserRole[] = ['AFFILIATE', 'WHOLESALER', 'OPERATOR_LEAD', 'SUPERVISOR', 'WAREHOUSE', 'FINANCE', 'ADMIN', 'SUPERADMIN'];

export const PERMISSIONS: readonly Permission[] = [
  { id: 'offers', label: 'staff.perm.offers', grants: { AFFILIATE: 'yes', ADMIN: 'yes' } },
  { id: 'streams', label: 'staff.perm.streams', grants: { AFFILIATE: 'yes' } },
  { id: 'leadStats', label: 'staff.perm.leadStats', grants: { AFFILIATE: 'yes', ADMIN: 'yes' } },
  { id: 'leadWork', label: 'staff.perm.leadWork', grants: { OPERATOR_LEAD: 'yes', SUPERVISOR: 'yes' } },
  { id: 'leadTransfer', label: 'staff.perm.leadTransfer', grants: { SUPERVISOR: 'yes', ADMIN: 'yes' } },
  { id: 'leadReopen', label: 'staff.perm.leadReopen', grants: { ADMIN: 'yes' } },
  {
    id: 'recordings', label: 'staff.perm.recordings', grants: { OPERATOR_LEAD: 'own', SUPERVISOR: 'yes', ADMIN: 'yes' },
    own: { OPERATOR_LEAD: 'staff.perm.own.recordings' },
  },
  { id: 'productOffer', label: 'staff.perm.productOffer', grants: { WHOLESALER: 'yes' } },
  { id: 'moderation', label: 'staff.perm.moderation', grants: { ADMIN: 'yes' } },
  { id: 'warehouse', label: 'staff.perm.warehouse', grants: { WAREHOUSE: 'yes' } },
  { id: 'returns', label: 'staff.perm.returns', grants: { WAREHOUSE: 'yes' } },
  {
    id: 'stock', label: 'staff.perm.stock', grants: { WHOLESALER: 'own', WAREHOUSE: 'yes', ADMIN: 'yes' },
    own: { WHOLESALER: 'staff.perm.own.stock' },
  },
  { id: 'withdraw', label: 'staff.perm.withdraw', grants: { AFFILIATE: 'yes' } },
  { id: 'payments', label: 'staff.perm.payments', grants: { FINANCE: 'yes' } },
  { id: 'settings', label: 'staff.perm.settings', note: 'staff.perm.settingsNote', grants: {} },
];

/** Superadmin — hamma amal; boshqasi — jadvaldagidek (`null` — ruxsat yo'q). */
export function grantOf(permission: Permission, role: UserRole): Grant | null {
  if (role === 'SUPERADMIN') return 'yes';
  return permission.grants[role] ?? null;
}

/** Bir amalda kimdir faqat o'zinikini ko'rsa, to'liq ruxsatli rolda «— hammasi» deb yoziladi. */
export const hasOwnVariant = (permission: Permission) => Object.values(permission.grants).includes('own');

export const rolePermissions = (role: UserRole) => PERMISSIONS.filter((permission) => grantOf(permission, role) !== null);
