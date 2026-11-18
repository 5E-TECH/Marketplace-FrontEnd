import axios from 'axios';
import { fileNameFromDisposition, saveBlob, withReadableErrorBody } from '../../../shared/api/download';
import { httpClient } from '../../../shared/api/httpClient';
import { readDto } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import type { LoginResponse } from '../../auth/model/authTypes';

/**
 * Sotuvchi: SMS kod bilan ro'yxat va kirish (FE-04, SOT-1).
 *
 * DIQQAT: backend (BE-05, BE-06) hali yo'q — shakl taklif, `docs/api-taklif/fe-04-sotuvchi.md`;
 * endpointlar `contract/pending-endpoints.json` da. Hozir mock (src/mocks) bilan ishlaydi.
 * Qoidalar (SOT-1): kod 6 xonali, 5 daqiqa amal qiladi, 3 marta xato — 15 daqiqa blok.
 */
export type OtpPurpose = 'REGISTER' | 'LOGIN';

export interface OtpSent {
  /**
   * Kod necha soniya amal qiladi («amal qiladi: 04:12»). Mutlaq vaqt emas — foydalanuvchi
   * soati noto'g'ri bo'lsa ham taymer to'g'ri ishlaydi.
   */
  expiresIn: number;
  /** SMS provayder javob bermadi: kod yo'qolmaydi, server o'zi qayta yuboradi. */
  delivery: 'SENT' | 'DELAYED';
}

export interface LegalDocument {
  type: 'affiliate-offer' | 'personal-data-consent';
  version: string;
  effectiveAt: string | null;
  /** «Asosiy shartlar»: atama va izoh («Haq» — «faqat mijoz to‘lagan buyurtma uchun…»). */
  summary: Array<{ term: string; text: string }>;
  sections: Array<{ id: string; title: string; body: string }>;
}

export async function sendOtp(phone: string, purpose: OtpPurpose): Promise<OtpSent> {
  const { data } = await httpClient.post<unknown>('/auth/otp/send', { phone, purpose }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<OtpSent>(data, ['expiresIn', 'delivery']);
}

/** Ro'yxat: telefon tasdiqlandi — oferta qadamiga o'tish uchun bir martalik token. */
export async function verifyRegisterOtp(phone: string, code: string): Promise<{ registrationToken: string }> {
  const { data } = await httpClient.post<unknown>('/auth/otp/verify', { phone, code, purpose: 'REGISTER' satisfies OtpPurpose }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<{ registrationToken: string }>(data, ['registrationToken']);
}

/** Kirish: kod to'g'ri — sessiya (`accessToken`; cookie rejimida `null`, refresh cookie'da). */
export async function loginWithOtp(phone: string, code: string): Promise<LoginResponse> {
  const { data } = await httpClient.post<unknown>('/auth/otp/verify', { phone, code, purpose: 'LOGIN' satisfies OtpPurpose }, { timeout: REQUEST_TIMEOUT.action });
  return { accessToken: readSessionToken(data) };
}

export async function registerAffiliate(input: { registrationToken: string; offerVersion: string; consentVersion: string }): Promise<LoginResponse> {
  const { data } = await httpClient.post<unknown>('/auth/register/affiliate', input, { timeout: REQUEST_TIMEOUT.action });
  return { accessToken: readSessionToken(data) };
}

/** «PDF yuklab olish» — joriy versiya (superadmin PDF qilib yuklaydi; hujjat-sotuvchi-oferta). */
export async function downloadLegalDocumentPdf(type: LegalDocument['type'], version: string): Promise<void> {
  try {
    const response = await httpClient.get<Blob>(`/legal/documents/${encodeURIComponent(type)}/pdf`, { responseType: 'blob', timeout: 60_000 });
    const fallback = `${type === 'affiliate-offer' ? 'sotuvchi-ofertasi' : 'rozilik'}-${version}.pdf`;
    saveBlob(response.data, fileNameFromDisposition(response.headers['content-disposition'], fallback));
  } catch (error) {
    throw await withReadableErrorBody(error);
  }
}

export async function getLegalDocument(type: LegalDocument['type'], signal?: AbortSignal): Promise<LegalDocument> {
  const { data } = await httpClient.get<unknown>(`/legal/documents/${encodeURIComponent(type)}`, { signal });
  return readDto<LegalDocument>(data, ['type', 'version', 'summary', 'sections']);
}

function readSessionToken(value: unknown): string | null {
  const data = readDto<{ accessToken?: unknown }>(value, []);
  const token = data.accessToken;
  if (token === undefined || token === null) return null;
  if (typeof token !== 'string' || !token || /\s/.test(token)) throw new Error('Serverdan kutilmagan javob olindi');
  return token;
}

/** OTP xatosi — UI holati uchun (umumiy-kirish §1, sotuvchi-royxat §1–2). */
export type OtpFailure =
  | { kind: 'invalid'; attemptsLeft: number }
  | { kind: 'expired' }
  /** `retryAfter` — necha soniyadan keyin yangi kod so'rash mumkin. */
  | { kind: 'blocked'; retryAfter: number }
  | { kind: 'alreadyRegistered' }
  | { kind: 'notFound' }
  | { kind: 'operator' }
  | { kind: 'network' }
  | { kind: 'other'; error: unknown };

export function readOtpFailure(error: unknown): OtpFailure {
  if (!axios.isAxiosError(error)) return { kind: 'other', error };
  if (!error.response) return { kind: 'network' };
  const data: unknown = error.response.data;
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  switch (body.errorCode) {
    case 'OTP_INVALID':
      return { kind: 'invalid', attemptsLeft: typeof body.attemptsLeft === 'number' ? body.attemptsLeft : 0 };
    case 'OTP_EXPIRED':
      return { kind: 'expired' };
    case 'OTP_BLOCKED': {
      // Tana yoki `Retry-After` sarlavhasi (soniya); bo'lmasa — SOT-1 dagi 15 daqiqa.
      const header = Number(error.response.headers['retry-after']);
      const seconds = typeof body.retryAfterSeconds === 'number' ? body.retryAfterSeconds : header;
      return { kind: 'blocked', retryAfter: Number.isFinite(seconds) && seconds > 0 ? seconds : 15 * 60 };
    }
    case 'PHONE_ALREADY_REGISTERED':
      return { kind: 'alreadyRegistered' };
    case 'ACCOUNT_NOT_FOUND':
      return { kind: 'notFound' };
    case 'PHONE_OPERATOR_INVALID':
      return { kind: 'operator' };
    default:
      return error.response.status >= 500 ? { kind: 'network' } : { kind: 'other', error };
  }
}

/** Ro'yxat tokeni eskirgan (oferta qadamida uzoq turildi) — SMS kodni qaytadan olish kerak. */
export function isRegistrationExpired(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const data: unknown = error.response?.data;
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>).errorCode === 'REGISTRATION_EXPIRED';
}
