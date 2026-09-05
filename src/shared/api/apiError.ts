import axios from 'axios';

/**
 * Backend beradigan barqaror xato kodlari — API_CONTRACT.md §1.5.
 * Matn o'zgarishi mumkin, kod — yo'q; shuning uchun mantiq shu kodga tayanadi.
 */
export type ApiErrorCode =
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
  | 'INTERNAL_ERROR';

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

/** Javobdagi `errorCode` — tanilmagan kod bo'lsa null. */
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

/**
 * Xatoni log bilan solishtirish uchun server qaytargan kuzatuv ID'si
 * (`X-Request-Id` sarlavhasi yoki javob tanasidagi `requestId`).
 */
export function getRequestId(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;

  const header: unknown = error.response?.headers?.['x-request-id'];
  if (typeof header === 'string' && header) return header;

  const data = getResponseData(error);
  if (typeof data === 'object' && data !== null && 'requestId' in data) {
    const requestId: unknown = data.requestId;
    if (typeof requestId === 'string' && requestId) return requestId;
  }

  return null;
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
};

const CONNECTION_ERROR_MESSAGE =
  'Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.';

/**
 * Foydalanuvchiga ko'rsatiladigan xabar. Tartib: server matni (aniqroq) →
 * errorCode bo'yicha standart matn → ulanish xatosi.
 */
export function getApiErrorMessage(error: unknown): string {
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
