import axios from 'axios';
import type { Language } from '../../preferences/model/preferencesSlice';

const messages = {
  uz: { forbidden: 'Operatorlarni faqat seller akkaunti boshqara oladi.', conflict: 'Bu telefon raqamli foydalanuvchi allaqachon mavjud.', rate: 'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.', server: 'Serverda vaqtinchalik xato yuz berdi.', network: 'Server bilan bog‘lanib bo‘lmadi.' },
  ru: { forbidden: 'Управлять операторами может только seller-аккаунт.', conflict: 'Пользователь с этим номером уже существует.', rate: 'Слишком много попыток. Повторите позже.', server: 'Временная ошибка сервера.', network: 'Не удалось связаться с сервером.' },
  en: { forbidden: 'Only a seller account can manage operators.', conflict: 'A user with this phone number already exists.', rate: 'Too many attempts. Please try again later.', server: 'Temporary server error.', network: 'Could not connect to the server.' },
} satisfies Record<Language, Record<string, string>>;

function backendMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('message' in data)) return null;
  if (typeof data.message === 'string') return data.message.trim() || null;
  if (Array.isArray(data.message)) return data.message.filter((value): value is string => typeof value === 'string').join('. ') || null;
  return null;
}

export function getUserErrorMessage(error: unknown, language: Language): string {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : messages[language].network;
  const status = error.response?.status;
  if (status === 403) return messages[language].forbidden;
  if (status === 409) return backendMessage(error.response?.data) ?? messages[language].conflict;
  if (status === 429) return messages[language].rate;
  if (status && status >= 500) return messages[language].server;
  return backendMessage(error.response?.data) ?? messages[language].network;
}
