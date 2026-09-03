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
