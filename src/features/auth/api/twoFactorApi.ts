import axios from 'axios';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { isUserRole, type LoginResponse, type TwoFactorChallenge, type TwoFactorSetup } from '../model/authTypes';

/** Backend: 3 xato kod → 15 daqiqa blok (BE-26, SOT-1 qiymati); taklif javobida `retryAfterSeconds` kelmasa. */
export const TWO_FACTOR_BLOCK_SECONDS = 15 * 60;
export const TWO_FACTOR_MAX_ATTEMPTS = 3;

const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * `POST /auth/login` javobi 2FA bosqichimi (BE-26 `TwoFactorChallengeResultDto`): sessiya o'rniga `challengeToken`.
 * Taklif maydonlari (`user`, `reset`) kelmasa — `null`.
 */
export function readTwoFactorChallenge(value: unknown, phone: string): TwoFactorChallenge | null {
  const data = record(unwrapApiData(value));
  const token = text(data.challengeToken);
  if (!token) return null;
  const user = record(data.user);
  const reset = record(data.reset);
  return {
    token,
    setupRequired: data.twoFactorSetupRequired === true || data.twoFactorRequired === false,
    phone,
    user: text(user.name) && isUserRole(user.role) ? { name: text(user.name), role: user.role } : null,
    reset: text(reset.by) && text(reset.at) ? { by: text(reset.by), at: text(reset.at) } : null,
  };
}

function readSession(value: unknown): LoginResponse {
  const token = record(unwrapApiData(value)).accessToken;
  return { accessToken: typeof token === 'string' && token ? token : null };
}

/** QR uchun sir va `otpauth://` havola — faqat 2FA hali ulanmagan bo'lsa (ulangan — 409). */
export async function setupTwoFactor(challengeToken: string): Promise<TwoFactorSetup> {
  const { data } = await httpClient.post<unknown>('/auth/2fa/setup', { challengeToken });
  const body = record(unwrapApiData(data));
  if (!text(body.secret) || !text(body.otpauthUrl).startsWith('otpauth://')) throw new Error('Serverdan kutilmagan javob olindi');
  return { secret: text(body.secret), otpauthUrl: text(body.otpauthUrl) };
}

/**
 * Birinchi kod bilan yoqish: bir martalik zaxira kodlar (faqat shu javobda) va sessiya (cookie). Sessiya kodlar
 * saqlangandan keyin ochiladi — avval «Zaxira kodlarni saqlang» ekrani.
 */
export async function enableTwoFactor({ challengeToken, code }: { challengeToken: string; code: string }): Promise<{ recoveryCodes: string[]; login: LoginResponse }> {
  const { data } = await httpClient.post<unknown>('/auth/2fa/enable', { challengeToken, code });
  const codes = record(unwrapApiData(data)).recoveryCodes;
  return { recoveryCodes: Array.isArray(codes) ? codes.filter((item): item is string => typeof item === 'string') : [], login: readSession(data) };
}

/** Kirish: ilovadagi 6 raqamli kod yoki bir martalik zaxira kod → sessiya (cookie). */
export async function verifyTwoFactor({ challengeToken, code, recoveryCode }: { challengeToken: string; code?: string; recoveryCode?: string }): Promise<LoginResponse> {
  const { data } = await httpClient.post<unknown>('/auth/2fa/verify', { challengeToken, ...(recoveryCode ? { recoveryCode } : { code }) });
  return readSession(data);
}

/** Zaxira kod backendda aynan berilganidek tekshiriladi: tire va bo'shliqlar olib tashlanadi, katta harf. */
export const normalizeRecoveryCode = (value: string) => value.replace(/[^0-9a-z]/gi, '').toUpperCase();
/** Zaxira kod maydoni: katta harf, faqat harf va raqam, «K7QM2-XPA4D» ko'rinishida (backend: 10 belgi). */
export function formatRecoveryInput(value: unknown): string {
  const clean = (typeof value === 'string' ? value : '').replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 20);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}

/** Ekranda o'qish oson bo'lishi uchun «K7QM2-XPA4D» (backend: 10 belgi, tiresiz). */
export const formatRecoveryCode = (code: string) => (code.length > 5 ? `${code.slice(0, Math.ceil(code.length / 2))}-${code.slice(Math.ceil(code.length / 2))}` : code);

export type TwoFactorFailure =
  /** Kod noto'g'ri; `attemptsLeft` — taklif (fe-27 §3), kelmasa `null` (ekran o'zi sanaydi). */
  | { kind: 'invalid'; attemptsLeft: number | null }
  /** 3 xato → 423; `retryAfter` — soniya (taklif `retryAfterSeconds` yoki `Retry-After`, bo'lmasa 15 daqiqa). */
  | { kind: 'blocked'; retryAfter: number }
  /** 2FA bosqichi muddati o'tdi (5 daqiqa) yoki hisob o'zgardi — paroldan qayta. */
  | { kind: 'expired' }
  /** Throttle (5/daqiqa) — 429. */
  | { kind: 'tooMany'; retryAfter: number }
  /** Ulash: 2FA allaqachon yoqilgan (409) — boshqa tab yoki qurilmada ulangan; paroldan qayta, endi kod so'raladi. */
  | { kind: 'alreadyEnabled' }
  | { kind: 'network' }
  | { kind: 'other'; message: string };

/**
 * 2FA xatosi — UI holati uchun (umumiy-2fa holatlari). Backend 401 ni matn bilan ajratadi (alohida `errorCode` yo'q):
 * «muddati o'tdi» — bosqich tugagan, qolgani — kod noto'g'ri.
 */
export function readTwoFactorFailure(error: unknown): TwoFactorFailure {
  if (!axios.isAxiosError(error)) return { kind: 'other', message: getApiErrorMessage(error) };
  if (!error.response) return { kind: 'network' };
  const { status, headers } = error.response;
  const body = record(error.response.data);
  const seconds = (fallback: number) => {
    const value = typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : Number(headers['retry-after']);
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : fallback;
  };
  if (status === 423) return { kind: 'blocked', retryAfter: seconds(TWO_FACTOR_BLOCK_SECONDS) };
  if (status === 429) return { kind: 'tooMany', retryAfter: seconds(60) };
  if (status === 409) return { kind: 'alreadyEnabled' };
  if (status === 401) {
    if (/muddati o.tdi|qayta kiring/i.test(text(body.message))) return { kind: 'expired' };
    return { kind: 'invalid', attemptsLeft: typeof body.attemptsLeft === 'number' ? body.attemptsLeft : null };
  }
  return { kind: 'other', message: getApiErrorMessage(error) };
}
