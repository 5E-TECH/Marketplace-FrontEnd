/**
 * BE-26 (FE-27): xodim 2FA mock holati. `enabled` — backenddagi `ADMIN_2FA` bayrog'i: sukut o'chiq (backend ham
 * FE-27 chiqquncha o'chiq), shuning uchun boshqa e2e lar parol bilan kiradi; 2FA testlari uni yoqadi.
 * Admin (900000007) — ulangan, moliya (900000006) — birinchi kirish, superadmin (900000008) — ulangan.
 */
export const MOCK_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
/** `POST /auth/2fa/setup` dagi yangi sir — backend kabi 20 bayt (32 belgili base32); e2e shu bilan kodni hisoblaydi. */
export const MOCK_SETUP_SECRET = 'MZXW6YTBOI4DQNBR7KPAJBSWY3DPEHPK';
/** Backend: 8 ta, 10 belgili base32 (`base32Encode(randomBytes(6)).slice(0, 10)`), tiresiz. */
export const MOCK_RECOVERY_CODES = ['K7QM2XPA4D', 'P4WT2HNCB6', 'B5RZ6FQJX3', 'X3LM7VDAH6', 'H6CY4KPET2', 'T2NG4WQSR7', 'R3FD3MZBE5', 'E5JV7TXLW2'];
export const MOCK_NEW_RECOVERY_CODES = ['Q2HZ7MXKD4', 'W6PN3RTYA5', 'C4JV7LQSE2', 'N5FB2XWKM6', 'Y3TD6HGRP4', 'L7QX4CZNB5', 'F7MW6EJTK3', 'S5RA2VPHD7'];
export const TWO_FACTOR_ROLES = ['ADMIN', 'SUPERADMIN', 'FINANCE'];
export const TWO_FACTOR_MAX_FAILED = 3;
export const TWO_FACTOR_BLOCK_SECONDS = 900;
export const TWO_FACTOR_CHALLENGE_SECONDS = 300;

export interface MockTwoFactorAccount {
  secret: string | null;
  enabledAt: string | null;
  lastStep: number | null;
  recovery: string[];
  failed: number;
  blockedUntil: number | null;
  /** Taklif (fe-27 §2): superadmin tiklagan — «2FA tiklandi» xabari. */
  reset: { by: string; at: string } | null;
}

const enrolled = (): MockTwoFactorAccount => ({
  secret: MOCK_TOTP_SECRET, enabledAt: '2026-10-01T05:00:00.000Z', lastStep: null, recovery: [...MOCK_RECOVERY_CODES], failed: 0, blockedUntil: null, reset: null,
});
const fresh = (): MockTwoFactorAccount => ({ secret: null, enabledAt: null, lastStep: null, recovery: [], failed: 0, blockedUntil: null, reset: null });

export function mockTwoFactor() {
  return {
    enabled: false,
    // Moliya Ozoda Botirova (FE-15, 2FA tiklash namunasi) — ilova ulangan.
    accounts: { '900000006': fresh(), '900000007': enrolled(), '900000008': enrolled(), '911001009': enrolled() } as Record<string, MockTwoFactorAccount>,
    /** `challengeToken` → telefon va muddat (backend: alohida sir bilan JWT, 5 daqiqa). */
    challenges: new Map<string, { digits: string; expiresAt: number }>(),
  };
}

export const freshTwoFactorAccount = fresh;
