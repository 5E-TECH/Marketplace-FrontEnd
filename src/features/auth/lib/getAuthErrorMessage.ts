import axios from 'axios';

const INVALID_CREDENTIALS_MESSAGE = 'Telefon yoki parol noto‘g‘ri';
const CONNECTION_ERROR_MESSAGE =
  'Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.';
const SERVER_ERROR_MESSAGE =
  'Serverda vaqtinchalik xato yuz berdi. Birozdan keyin qayta urinib ko‘ring.';
const RATE_LIMIT_MESSAGE =
  'Juda ko‘p urinish bo‘ldi. Biroz kutib, qayta urinib ko‘ring.';
const ACCESS_DENIED_MESSAGE = 'Bu akkaunt orqali seller kabinetiga kirish mumkin emas.';
const MAX_ERROR_MESSAGE_LENGTH = 160;

function getApiMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return null;
  }

  if (typeof data.message === 'string') {
    const message = data.message.trim();
    return message.length <= MAX_ERROR_MESSAGE_LENGTH ? message : null;
  }

  if (Array.isArray(data.message)) {
    const firstMessage = data.message.find(
      (message): message is string => typeof message === 'string',
    );

    const message = firstMessage?.trim();
    return message && message.length <= MAX_ERROR_MESSAGE_LENGTH ? message : null;
  }

  return null;
}

export function getAuthErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401) {
      return INVALID_CREDENTIALS_MESSAGE;
    }

    if (status === 403) {
      return ACCESS_DENIED_MESSAGE;
    }

    if (status === 429) {
      return RATE_LIMIT_MESSAGE;
    }

    if (status && status >= 500) {
      return SERVER_ERROR_MESSAGE;
    }

    const apiMessage = getApiMessage(error.response?.data);
    if (apiMessage && status && [400, 409, 422].includes(status)) {
      return apiMessage;
    }

    return CONNECTION_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message : CONNECTION_ERROR_MESSAGE;
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
