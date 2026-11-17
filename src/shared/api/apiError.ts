import axios from 'axios';

/**
 * Backend beradigan barqaror xato kodlari — API_CONTRACT.md §1.5.
 * Matn o'zgarishi mumkin, kod — yo'q; shuning uchun mantiq shu kodga tayanadi.
 */
type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BUSINESS_RULE_VIOLATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'INSUFFICIENT_STOCK'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  // Lid-sotuv (BE-25 shartnomasi): operator navbati, lid va landing.
  | 'LEAD_QUEUE_EMPTY'
  | 'OPERATOR_ON_BREAK'
  | 'OPERATOR_OFFLINE'
  | 'BOOKING_LIMIT_REACHED'
  | 'ADDRESS_NOT_CONFIRMED'
  | 'LANDING_NOT_OPEN'
  | 'OUT_OF_STOCK';

const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'VALIDATION_ERROR',
  'BUSINESS_RULE_VIOLATION',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_STATE',
  'INSUFFICIENT_STOCK',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
  'LEAD_QUEUE_EMPTY',
  'OPERATOR_ON_BREAK',
  'OPERATOR_OFFLINE',
  'BOOKING_LIMIT_REACHED',
  'ADDRESS_NOT_CONFIRMED',
  'LANDING_NOT_OPEN',
  'OUT_OF_STOCK',
];

const MAX_MESSAGE_LENGTH = 160;

/** axios javob tanasi `any` — mantiqqa `unknown` bo'lib kiradi. */
function getResponseData(error: unknown): unknown {
  return axios.isAxiosError(error) ? error.response?.data : undefined;
}

/** Server matni ishonchsiz uzunlikda bo'lsa ko'rsatmaymiz. */
function readServerMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return null;
  }

  const message: unknown = data.message;
  const candidate: unknown = Array.isArray(message)
    ? message.find((item): item is string => typeof item === 'string')
    : message;

  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed && trimmed.length <= MAX_MESSAGE_LENGTH ? trimmed : null;
}

/** Javobdagi `errorCode` — tanilmagan kod bo'lsa null. Mantiq matnga emas, shu kodga tayanadi. */
export function getApiErrorCode(error: unknown): ApiErrorCode | null {
  const data = getResponseData(error);
  if (typeof data !== 'object' || data === null || !('errorCode' in data)) {
    return null;
  }

  const errorCode: unknown = data.errorCode;
  return API_ERROR_CODES.includes(errorCode as ApiErrorCode)
    ? (errorCode as ApiErrorCode)
    : null;
}


const CODE_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Kiritilgan ma’lumotda xato bor. Tekshirib qayta yuboring.',
  BUSINESS_RULE_VIOLATION: 'Bu amalni bajarib bo‘lmaydi.',
  UNAUTHENTICATED: 'Sessiya tugadi. Qayta tizimga kiring.',
  FORBIDDEN: 'Bu amal uchun ruxsatingiz yo‘q.',
  NOT_FOUND: 'So‘ralgan ma’lumot topilmadi.',
  CONFLICT: 'Bu ma’lumot allaqachon mavjud.',
  INVALID_STATE: 'Joriy holatda bu amalni bajarib bo‘lmaydi.',
  INSUFFICIENT_STOCK: 'Omborda yetarli qoldiq yo‘q.',
  RATE_LIMITED: 'Juda ko‘p urinish bo‘ldi. Biroz kutib, qayta urinib ko‘ring.',
  PAYLOAD_TOO_LARGE: 'Yuborilgan fayl juda katta.',
  INTERNAL_ERROR:
    'Serverda vaqtinchalik xato yuz berdi. Birozdan keyin qayta urinib ko‘ring.',
  LEAD_QUEUE_EMPTY: 'Navbatda lid yo‘q. Yangi lid kelganda «Keyingi lid» yana ishlaydi.',
  OPERATOR_ON_BREAK: 'Siz tanaffusdasiz. Lid olish uchun holatni «Onlayn» qiling.',
  OPERATOR_OFFLINE: 'Siz oflaynsiz. Lid olish uchun holatni «Onlayn» qiling.',
  BOOKING_LIMIT_REACHED: 'Bronlaringiz to‘la. Avval bron qilingan lidlarga natija kiriting.',
  ADDRESS_NOT_CONFIRMED: 'Manzil tasdiqlanmagan. Avval mijoz manzilini tasdiqlang.',
  LANDING_NOT_OPEN: 'Sahifa hozir ariza qabul qilmaydi.',
  OUT_OF_STOCK: 'Omborda bu tovar qolmagan.',
};

const CONNECTION_ERROR_MESSAGE =
  'Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.';

const TIMEOUT_MESSAGE = 'Tizim javob bermadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.';

/** So'rov `timeout` dan oshdi (axios `ECONNABORTED` / `ETIMEDOUT`). */
export function isTimeoutError(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT');
}

/**
 * «Xato raqami» (umumiy-xato-yuklanish): backend har xatoga `requestId` beradi —
 * foydalanuvchi uni yordamga aytadi, server logidan aynan shu so'rov topiladi.
 */
export function getApiRequestId(error: unknown): string | null {
  const data = getResponseData(error);
  if (typeof data !== 'object' || data === null || !('requestId' in data)) return null;
  const requestId: unknown = data.requestId;
  return typeof requestId === 'string' && /^[\w.:-]{1,80}$/.test(requestId) ? requestId : null;
}

/** 429 javobidagi `Retry-After` (soniya) — «[soniya] dan keyin qayta urinib ko‘ring» uchun. */
export function getRetryAfterSeconds(error: unknown): number | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return null;
  const header: unknown = error.response.headers['retry-after'];
  const seconds = typeof header === 'string' ? Number(header) : typeof header === 'number' ? header : Number.NaN;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 3600) : null;
}

/**
 * Foydalanuvchiga ko'rsatiladigan xabar. Tartib: server matni (aniqroq) →
 * errorCode bo'yicha standart matn → ulanish xatosi.
 */
export function getApiErrorMessage(error: unknown): string {
  if (isTimeoutError(error)) return TIMEOUT_MESSAGE;
  if (axios.isAxiosError(error)) {
    const serverMessage = readServerMessage(getResponseData(error));
    if (serverMessage) return serverMessage;

    const code = getApiErrorCode(error);
    if (code) return CODE_MESSAGES[code];

    const status = error.response?.status;
    if (status && status >= 500) return CODE_MESSAGES.INTERNAL_ERROR;

    return CONNECTION_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message : CONNECTION_ERROR_MESSAGE;
}
