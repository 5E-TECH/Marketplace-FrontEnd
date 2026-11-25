import axios from 'axios';
import { getApiErrorFields } from './apiError';

type Params = Record<string, string | number | boolean | undefined>;

/**
 * Taklif (backendda hali yo'q) so'rov parametrlari bilan chaqirish. Backend noma'lum parametrni rad etsa
 * (`forbidNonWhitelisted` → 400, `details[].field` shu parametr), so'rov ularsiz qayta yuboriladi —
 * ekran backend biladigan filtrlar bilan ishlayveradi. Qaytgan ikkinchi qiymat — qaysi taklif qo'llanmagani.
 */
export async function withOptionalParams<T>(
  request: (params: Params) => Promise<T>,
  params: Params,
  optional: readonly string[],
): Promise<{ data: T; dropped: string[] }> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
  const sent = Object.keys(clean).filter((key) => optional.includes(key));
  if (!sent.length) return { data: await request(clean), dropped: [] };
  try {
    return { data: await request(clean), dropped: [] };
  } catch (error) {
    const fields = getApiErrorFields(error);
    const rejected = axios.isAxiosError(error) && error.response?.status === 400 && fields.some((field) => sent.includes(field));
    if (!rejected) throw error;
    const base = Object.fromEntries(Object.entries(clean).filter(([key]) => !optional.includes(key)));
    return { data: await request(base), dropped: sent };
  }
}
