import axios from 'axios';

const INVALID_CREDENTIALS_MESSAGE = 'Telefon yoki parol noto‘g‘ri';
const CONNECTION_ERROR_MESSAGE =
  'Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.';

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 400 || error.response?.status === 401) {
      return INVALID_CREDENTIALS_MESSAGE;
    }

    return CONNECTION_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message : CONNECTION_ERROR_MESSAGE;
}
