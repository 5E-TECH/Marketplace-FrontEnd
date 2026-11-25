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

/**
 * Taklif maydonli so'rov tanasi: backend noma'lum maydonni rad etsa (400, `details[].field` shu maydon), so'rov
 * ularsiz qayta yuboriladi — asosiy ma'lumot saqlanadi, taklif maydoni backend qo'shgach ishlaydi.
 */
export async function withOptionalBody<T, B extends Record<string, unknown>>(
  request: (body: Partial<B>) => Promise<T>,
  body: B,
  optional: readonly (keyof B & string)[],
): Promise<{ data: T; dropped: string[] }> {
  const clean = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)) as Partial<B>;
  const sent = Object.keys(clean).filter((key) => (optional as readonly string[]).includes(key));
  try {
    return { data: await request(clean), dropped: [] };
  } catch (error) {
    const fields = getApiErrorFields(error);
    const rejected = sent.length > 0 && axios.isAxiosError(error) && error.response?.status === 400 && fields.length > 0 && fields.every((field) => sent.includes(field));
    if (!rejected) throw error;
    const base = Object.fromEntries(Object.entries(clean).filter(([key]) => !sent.includes(key))) as Partial<B>;
    return { data: await request(base), dropped: sent };
  }
}
