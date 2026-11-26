import { describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { MOCK_RECOVERY_CODES, MOCK_SETUP_SECRET, MOCK_TOTP_SECRET } from '../../../mocks/fixtures/twoFactor';
import { currentTotp } from '../../../mocks/totp';
import { TwoFactorRequiredError } from '../lib/twoFactorRequiredError';
import { authenticate, signIn } from './authApi';
import { enableTwoFactor, formatRecoveryCode, normalizeRecoveryCode, readTwoFactorFailure, setupTwoFactor, verifyTwoFactor } from './twoFactorApi';

/** FE-27 (BE-26): parol → 2FA bosqichi → kod / zaxira kod / birinchi ulash — mock orqali, backend qoidalari bilan. */
async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return readTwoFactorFailure(error);
  }
  throw new Error('So‘rov rad etilishi kerak edi');
}

const admin = { phone: '+998900000007', password: 'Secure123' };
const finance = { phone: '+998900000006', password: 'Secure123' };
const operator = { phone: '+998900000003', password: 'Secure123' };

async function challengeFor(credentials: typeof admin) {
  const result = await signIn(credentials);
  if (result.kind !== 'challenge') throw new Error('2FA bosqichi kutilgan edi');
  return result.challenge;
}

describe('2FA (FE-27, BE-26)', () => {
  it('bayroq o‘chiq — admin parol bilan sessiya oladi (backend sukuti)', async () => {
    expect((await signIn(admin)).kind).toBe('session');
  });

  it('TC1/TC2: admin — kodsiz sessiya yo‘q; xato kod → qolgan urinishlar, 3-xato → 423 blok; to‘g‘ri kod → sessiya', async () => {
    db.twoFactor.enabled = true;
    const challenge = await challengeFor(admin);
    expect(challenge).toMatchObject({ setupRequired: false, phone: admin.phone, user: { name: 'Nodira Karimova', role: 'ADMIN' }, reset: null });
    await expect(authenticate(admin)).rejects.toBeInstanceOf(TwoFactorRequiredError);

    await expect(failure(verifyTwoFactor({ challengeToken: challenge.token, code: '000000' }))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 2 });
    await expect(failure(verifyTwoFactor({ challengeToken: challenge.token, code: '000001' }))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 1 });
    await expect(failure(verifyTwoFactor({ challengeToken: challenge.token, code: '000002' }))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 0 });
    const blocked = await failure(verifyTwoFactor({ challengeToken: challenge.token, code: currentTotp(MOCK_TOTP_SECRET) }));
    expect(blocked).toMatchObject({ kind: 'blocked' });
    expect(blocked.kind === 'blocked' && blocked.retryAfter > 890).toBe(true);

    db.twoFactor.accounts['900000007'].blockedUntil = null;
    db.twoFactor.accounts['900000007'].failed = 0;
    await expect(verifyTwoFactor({ challengeToken: challenge.token, code: currentTotp(MOCK_TOTP_SECRET) })).resolves.toEqual({ accessToken: 'mock.900000007' });
  });

  it('TC3: zaxira kod (tire va kichik harf bilan kiritilgan) → sessiya; ikkinchi marta ishlamaydi', async () => {
    db.twoFactor.enabled = true;
    const typed = formatRecoveryCode(MOCK_RECOVERY_CODES[0]).toLowerCase();
    expect(typed).toBe('k7qm2-xpa4d');
    const first = await challengeFor(admin);
    await expect(verifyTwoFactor({ challengeToken: first.token, recoveryCode: normalizeRecoveryCode(typed) })).resolves.toEqual({ accessToken: 'mock.900000007' });
    const second = await challengeFor(admin);
    await expect(failure(verifyTwoFactor({ challengeToken: second.token, recoveryCode: normalizeRecoveryCode(typed) }))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 2 });
  });

  it('TC4: moliya birinchi kirish — QR sir, birinchi kod bilan yoqish → zaxira kodlar va sessiya', async () => {
    db.twoFactor.enabled = true;
    const challenge = await challengeFor(finance);
    expect(challenge.setupRequired).toBe(true);
    const setup = await setupTwoFactor(challenge.token);
    expect(setup.secret).toBe(MOCK_SETUP_SECRET);
    expect(setup.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Elchi%20Marketplace%3A%2B998900000006\?secret=MZXW6YTBOI4DQNBR7KPA/);
    await expect(failure(enableTwoFactor({ challengeToken: challenge.token, code: '123456' }))).resolves.toEqual({ kind: 'invalid', attemptsLeft: 2 });
    const enabled = await enableTwoFactor({ challengeToken: challenge.token, code: currentTotp(MOCK_SETUP_SECRET) });
    expect(enabled.recoveryCodes).toHaveLength(8);
    expect(enabled.login).toEqual({ accessToken: 'mock.900000006' });
  });

  it('TC5: operator va boshqa rollar — 2FA so‘ralmaydi; bosqich muddati o‘tsa «expired»', async () => {
    db.twoFactor.enabled = true;
    expect((await signIn(operator)).kind).toBe('session');
    const challenge = await challengeFor(admin);
    db.twoFactor.challenges.clear();
    await expect(failure(verifyTwoFactor({ challengeToken: challenge.token, code: currentTotp(MOCK_TOTP_SECRET) }))).resolves.toEqual({ kind: 'expired' });
  });
});
