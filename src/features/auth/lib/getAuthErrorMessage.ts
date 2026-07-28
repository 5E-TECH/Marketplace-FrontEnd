import axios from 'axios';

const INVALID_CREDENTIALS_MESSAGE = 'Telefon yoki parol noto‘g‘ri';
const CONNECTION_ERROR_MESSAGE =
  'Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.';

function getApiMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return null;
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  if (Array.isArray(data.message)) {
    const firstMessage = data.message.find(
      (message): message is string => typeof message === 'string',
    );

    return firstMessage ?? null;
  }

  return null;
}

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiMessage = getApiMessage(error.response?.data);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.response?.status === 401) {
      return INVALID_CREDENTIALS_MESSAGE;
    }

    return CONNECTION_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message : CONNECTION_ERROR_MESSAGE;
}
