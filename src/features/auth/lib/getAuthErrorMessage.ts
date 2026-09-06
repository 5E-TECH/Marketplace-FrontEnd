import axios from 'axios';
import { getApiErrorMessage } from '../../../shared/api/apiError';

const INVALID_CREDENTIALS_MESSAGE = 'Telefon yoki parol noto‘g‘ri';
const ACCESS_DENIED_MESSAGE = 'Bu akkaunt orqali seller kabinetiga kirish mumkin emas.';

/**
 * Login/registratsiya formalari uchun xabar. 401 va 403 da serverning matni
 * emas, aniq va bir xil xabar ko'rsatiladi (foydalanuvchi mavjudligini
 * oshkor qilmaslik uchun). Qolgan holatlarda umumiy xato ishlovchisi —
 * u `errorCode` ni hisobga oladi.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401) return INVALID_CREDENTIALS_MESSAGE;
    if (status === 403) return ACCESS_DENIED_MESSAGE;
  }

  return getApiErrorMessage(error);
}

export function getApiFieldErrors(error: unknown): Array<{ name: string; errors: string[] }> {
  if (!axios.isAxiosError(error)) return [];
  const data: unknown = error.response?.data as unknown;
  if (typeof data !== 'object' || data === null || !('details' in data) || !Array.isArray(data.details)) return [];

  const details: unknown[] = data.details;
  return details.flatMap((detail: unknown) => {
    if (typeof detail !== 'object' || detail === null) return [];
    const record = detail as Record<string, unknown>;
    const field = typeof record.field === 'string' ? record.field.trim() : '';
    const message = typeof record.error === 'string' ? record.error.trim() : '';
    return field && message ? [{ name: field, errors: [message] }] : [];
  });
}
