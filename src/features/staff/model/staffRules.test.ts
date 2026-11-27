import { describe, expect, it } from 'vitest';
import { accountStatus, canGrantRole, staffPermissions, twoFactorState, userCode } from './staffRules';

/** FE-15: holat, 2FA va kim nimani qila oladi (admin-foydalanuvchi-karta K4, K5, K6). */
describe('xodim qoidalari', () => {
  it('ID, holat va 2FA ustuni', () => {
    expect(userCode('1051')).toBe('U-1051');
    expect(userCode('U-2087')).toBe('U-2087');
    const base = { role: 'OPERATOR_LEAD' as const, isBlocked: false, isActive: true, lastLoginAt: '2026-11-26T08:00:00.000Z' };
    expect(accountStatus(base)).toBe('ACTIVE');
    expect(accountStatus({ ...base, lastLoginAt: null })).toBe('NEVER_LOGGED_IN');
    expect(accountStatus({ ...base, lastLoginAt: undefined })).toBe('ACTIVE');
    expect(accountStatus({ ...base, isBlocked: true, lastLoginAt: null })).toBe('BLOCKED');
    expect(accountStatus({ ...base, role: null })).toBe('UNKNOWN_ROLE');
    expect(twoFactorState({ role: 'OPERATOR_LEAD', totpEnabledAt: null })).toBe('NOT_REQUIRED');
    expect(twoFactorState({ role: 'FINANCE', totpEnabledAt: '2026-10-01T05:00:00.000Z' })).toBe('CONNECTED');
    expect(twoFactorState({ role: 'FINANCE', totpEnabledAt: null, twoFactorReset: { at: '2026-11-26T09:20:00.000Z', by: 'Akmal Sobirov' } })).toBe('RESET');
    expect(twoFactorState({ role: 'ADMIN', totpEnabledAt: null })).toBe('PENDING');
  });

  it('admin: o‘zi (K4) — rol, parol, sessiya va blok yopiq; superadmin (K5) — hammasi yopiq; 2FA — faqat superadmin', () => {
    const admin = { id: 'U-0007', role: 'ADMIN' as const };
    expect(staffPermissions(admin, { id: 'U-0007', role: 'ADMIN' })).toEqual({ changeRole: 'self', resetPassword: 'self', resetTwoFactor: 'superadminOnly', endSessions: 'self', block: 'self' });
    expect(staffPermissions(admin, { id: 'U-0008', role: 'SUPERADMIN' })).toEqual({ changeRole: 'superadminTarget', resetPassword: 'superadminTarget', resetTwoFactor: 'superadminOnly', endSessions: 'superadminTarget', block: 'superadminTarget' });
    expect(staffPermissions(admin, { id: 'U-0006', role: 'FINANCE' })).toEqual({ changeRole: null, resetPassword: null, resetTwoFactor: 'superadminOnly', endSessions: null, block: null });
  });

  it('superadmin: o‘z rolini o‘zgartiradi (oxirgi bo‘lsa — backend 409), o‘zini bloklamaydi; 2FA ni tiklaydi (K6)', () => {
    const superadmin = { id: 'U-0008', role: 'SUPERADMIN' as const };
    expect(staffPermissions(superadmin, { id: 'U-0008', role: 'SUPERADMIN' })).toMatchObject({ changeRole: null, block: 'self', resetPassword: 'self' });
    expect(staffPermissions(superadmin, { id: 'U-1009', role: 'FINANCE' }).resetTwoFactor).toBeNull();
    expect(canGrantRole('ADMIN', 'SUPERADMIN')).toBe(false);
    expect(canGrantRole('ADMIN', 'ADMIN')).toBe(true);
    expect(canGrantRole('SUPERADMIN', 'SUPERADMIN')).toBe(true);
  });
});
