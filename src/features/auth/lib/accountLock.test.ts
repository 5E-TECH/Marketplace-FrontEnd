import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { findMockUserById } from '../../../mocks/fixtures/users';
import { MOCK_OTP_CODE } from '../../../mocks/handlers/sellerAuth';
import { loginWithOtp, sendOtp } from '../../sellerAuth/api/sellerAuthApi';
import { authenticate } from '../api/authApi';
import { lockAccountOf, readAccountLock } from './accountLock';
import { lockAccountLine, lockDecision, lockHeldText, lockReasonLine } from './accountLockView';

/** FE-15 (umumiy-sessiya 6–8, umumiy-kirish 12; taklif §15): 401 dan hisob yopilgani va tafsiloti. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('So‘rov rad etilishi kerak edi');
}

/** Haqiqiy backend javobi — `errorCode` siz (UNAUTHENTICATED), faqat matn. */
function backend401(message: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(message, 'ERR_BAD_REQUEST', config, null, { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { statusCode: 401, message, errorCode: 'UNAUTHENTICATED' } });
}

const t = (key: string, params: Record<string, string | number> = {}) => `${key}${Object.keys(params).length ? JSON.stringify(params) : ''}`;

describe('readAccountLock', () => {
  it('bloklangan operator parol bilan kirsa — ACCOUNT_BLOCKED: kim, qachon, kim blokladi, sabab, nazoratchi', async () => {
    const error = await rejection(authenticate({ phone: '+998911001078', password: 'Secure123' }));
    const lock = readAccountLock(error, lockAccountOf(null, '+998911001078'));
    expect(lock).toMatchObject({
      kind: 'BLOCKED',
      account: { id: 'U-1078', name: 'Kamron Davletov', role: 'OPERATOR_LEAD', phone: '+998911001078' },
      by: { name: 'Nodira Karimova', role: 'ADMIN' },
      reason: 'Firibgarlik tekshiruvi: soxta tasdiqlar',
      supervisorName: 'Rustam Qodirov',
      seller: null,
    });
    expect(lock?.at).toEqual(expect.any(String));
    if (!lock) return;
    expect(lockDecision(lock, t)).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} · lock\.decision\.admin$/);
    expect(lockAccountLine(lock, t)).toBe('Kamron D. · role.operatorLead · U-1078');
  });

  it('nazoratchi nofaol qilgan — ACCOUNT_INACTIVE, qaror nazoratchiniki', async () => {
    const marjona = findMockUserById('U-1055');
    if (!marjona?.staff) throw new Error('U-1055 yo‘q');
    marjona.isActive = false;
    marjona.staff.inactive = { at: new Date().toISOString(), by: 'Rustam Qodirov', reason: 'Ta’tilda' };
    const lock = readAccountLock(await rejection(authenticate({ phone: '+998911001055', password: 'Secure123' })), lockAccountOf(null));
    expect(lock).toMatchObject({ kind: 'INACTIVE', by: { name: 'Rustam Qodirov', role: 'SUPERVISOR' }, reason: 'Ta’tilda', supervisorName: 'Rustam Qodirov' });
    if (lock) expect(lockDecision(lock, t)).toMatch(/lock\.decision\.supervisor$/);
  });

  it('bloklangan sotuvchi SMS kodni to‘g‘ri kiritsa — sabab, dalil, asos, sahifalar va pul', async () => {
    await sendOtp('+998930000110', 'LOGIN');
    const lock = readAccountLock(await rejection(loginWithOtp('+998930000110', MOCK_OTP_CODE)), lockAccountOf(null, '+998930000110'));
    expect(lock).toMatchObject({
      kind: 'BLOCKED',
      account: { id: 'U-0110', name: 'Bobur Yoqubov', role: 'AFFILIATE' },
      reason: 'Aldovli reklama',
      evidence: 'Kreativ o‘chirildi',
      basis: 'oferta',
      seller: { pagesStopped: true, heldBonus: { amount: 0, cancelled: true }, balance: 0 },
    });
    if (!lock) return;
    expect(lockReasonLine(lock)).toBe('Aldovli reklama — kreativ o‘chirildi');
    expect(lockHeldText(lock, t)).toBe('lock.heldCancelled{"amount":"lock.sum{\\"amount\\":\\"0\\"}"}');
  });

  it('haqiqiy backend: login «Hisobingiz bloklangan» — blok, tafsilotsiz (raqam qoladi); «Hisob faol emas» — ajratilmaydi', () => {
    const blocked = readAccountLock(backend401('Hisobingiz bloklangan'), lockAccountOf(null, '+998911001078'));
    expect(blocked).toMatchObject({ kind: 'BLOCKED', account: { id: null, name: null, role: null, phone: '+998911001078' }, at: null, reason: null, seller: null });
    if (blocked) expect(lockAccountLine(blocked, t)).toBe('+998 91 100 10 78');
    expect(readAccountLock(backend401('Hisob faol emas'), lockAccountOf(null))).toBeNull();
    expect(readAccountLock(backend401('Telefon yoki parol xato'), lockAccountOf(null))).toBeNull();
    expect(readAccountLock(new Error('tarmoq'), lockAccountOf(null))).toBeNull();
  });
});
