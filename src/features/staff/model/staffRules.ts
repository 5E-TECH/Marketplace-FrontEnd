import { TWO_FACTOR_ROLES, type UserRole } from '../../auth/model/authTypes';
import type { AccountStatus, TwoFactorState, UserAccount } from './staffTypes';

/** Ekrandagi ID: backend raqamli ID si `U-1051`; mock ID allaqachon shu ko'rinishda. */
export const userCode = (id: string) => (/^\d+$/.test(id) ? `U-${id}` : id);

export const usesTwoFactor = (role: UserRole | null) => role !== null && TWO_FACTOR_ROLES.includes(role);

export function accountStatus(user: Pick<UserAccount, 'role' | 'isBlocked' | 'isActive' | 'lastLoginAt'>): AccountStatus {
  if (user.role === null) return 'UNKNOWN_ROLE';
  if (user.isBlocked) return 'BLOCKED';
  if (!user.isActive) return 'INACTIVE';
  // `undefined` — backend oxirgi kirishni bermagan: «hali kirmagan» deb bo'lmaydi.
  if (user.lastLoginAt === null) return 'NEVER_LOGGED_IN';
  return 'ACTIVE';
}

export function twoFactorState(user: Pick<UserAccount, 'role' | 'totpEnabledAt' | 'twoFactorReset'>): TwoFactorState {
  if (!usesTwoFactor(user.role)) return 'NOT_REQUIRED';
  if (user.totpEnabledAt) return 'CONNECTED';
  return user.twoFactorReset ? 'RESET' : 'PENDING';
}

/**
 * Amal nima uchun yopiq (admin-foydalanuvchi-karta K4 «o'zi», K5 «superadmin — admin ko'rinishi»); null — ochiq.
 * Backend: blok va rol — admin/superadmin hisobini faqat superadmin; 2FA tiklash — faqat superadmin.
 */
export type ActionDenial = 'self' | 'superadminTarget' | 'adminTarget' | 'superadminOnly';

export interface StaffPermissions {
  changeRole: ActionDenial | null;
  resetPassword: ActionDenial | null;
  resetTwoFactor: ActionDenial | null;
  endSessions: ActionDenial | null;
  block: ActionDenial | null;
}

export function staffPermissions(viewer: { id: string; role: UserRole }, target: Pick<UserAccount, 'id' | 'role'>): StaffPermissions {
  const self = viewer.id === target.id;
  const superadmin = viewer.role === 'SUPERADMIN';
  const protectedTarget: ActionDenial | null = superadmin ? null
    : target.role === 'SUPERADMIN' ? 'superadminTarget'
      : target.role === 'ADMIN' ? 'adminTarget' : null;
  return {
    // Superadmin o'z rolini ham o'zgartiradi — oxirgi superadmin bo'lsa backend 409 qaytaradi (D2).
    changeRole: self && !superadmin ? 'self' : protectedTarget,
    resetPassword: self ? 'self' : protectedTarget,
    resetTwoFactor: superadmin ? null : 'superadminOnly',
    endSessions: self ? 'self' : protectedTarget,
    block: self ? 'self' : protectedTarget,
  };
}

/** «Superadmin» rolini faqat superadmin beradi (Rol berish, Rolni almashtirish, Yangi xodim). */
export const canGrantRole = (viewerRole: UserRole, role: UserRole) => role !== 'SUPERADMIN' || viewerRole === 'SUPERADMIN';
