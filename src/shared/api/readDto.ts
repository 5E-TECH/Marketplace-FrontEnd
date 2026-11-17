import { unwrapApiData } from './apiResponse';

/**
 * Javobni generatsiya qilingan DTO tipiga o'tkazadi, majburiy maydonlar borligini
 * tekshirib: backend shaklni o'zgartirsa sahifa «undefined» bilan chizilmaydi —
 * tushunarli xato bo'lib, `LoadError` ko'rsatiladi. Maydon tiplarini `contract:check`,
 * `api:check` va generatsiya qilingan tiplar kafolatlaydi.
 */
export function readDto<T extends object>(value: unknown, requiredKeys: readonly (keyof T & string)[]): T {
  const data = unwrapApiData(value);
  if (typeof data !== 'object' || data === null || requiredKeys.some((key) => !(key in data))) {
    throw new Error('Server javobi kutilgan formatda emas');
  }
  return data as T;
}

export function readDtoList<T extends object>(value: unknown, requiredKeys: readonly (keyof T & string)[]): T[] {
  const data = unwrapApiData(value);
  if (!Array.isArray(data)) throw new Error('Server javobi kutilgan formatda emas');
  return data.map((item) => readDto<T>(item, requiredKeys));
}
