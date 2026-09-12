import type { AuthUser, UserRole } from '../model/authTypes';

/**
 * Sotuvchi kabinetiga kira oladigan rollar.
 *
 * Backend'dagi haqiqiy huquqlar bilan mos:
 *  - SELLER   — barcha kabinet bo'limlari,
 *  - OPERATOR — faqat buyurtma va yetkazib berish (do'kon scope'i ichida),
 *  - ADMIN/SUPERADMIN — kabinet endpointlari ular uchun yopiq (@Roles(SELLER)),
 *    ularning o'z admin API'si bor. Shuning uchun bu yerga kiritilmaydi.
 */
export const SELLER_CABINET_ROLES: readonly UserRole[] = ['SELLER', 'OPERATOR'];

/** Kabinetning istalgan himoyalangan sahifasiga kira oladigan rollar. */
export const CABINET_ROLES: readonly UserRole[] = [
  'SELLER',
  'OPERATOR',
  'ADMIN',
  'SUPERADMIN',
];

export function canAccessCabinet(user: Pick<AuthUser, 'role' | 'isDeleted'>): boolean {
  return !user.isDeleted && CABINET_ROLES.includes(user.role);
}

export function canAccessSellerCabinet(
  user: Pick<AuthUser, 'role' | 'isDeleted'>,
): boolean {
  return !user.isDeleted && SELLER_CABINET_ROLES.includes(user.role);
}

/** Operator faqat buyurtma oqimida ishlaydi — bosh sahifasi ham o'sha. */
export function getHomePathForRole(role: UserRole): string {
  return role === 'OPERATOR' ? '/orders' : '/';
}
