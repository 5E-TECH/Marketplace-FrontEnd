import axios, { type AxiosRequestConfig } from 'axios';
import { httpClient } from './httpClient';
import { REQUEST_TIMEOUT } from './requestOptions';

/**
 * Fayl yuklab olish (FE-02): blob so'rov, fayl nomi `Content-Disposition` dan,
 * brauzerga saqlash. CSV, PDF yorliq va reestrlar shu yerdan o'tadi.
 */

/**
 * `responseType: 'blob'` bo'lganda backendning JSON xatosi ham Blob bo'lib keladi —
 * umumiy xato ishlovchisi (`getApiErrorMessage`) uni o'qiy olmaydi va «server bilan
 * bog'lanib bo'lmadi» deb chiqaradi. Blob'ni JSON'ga qaytaramiz.
 */
export async function withReadableErrorBody(error: unknown): Promise<unknown> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text()) as unknown;
    } catch {
      // JSON bo'lmasa asl xato qoladi.
    }
  }
  return error;
}

/** Fayl nomida yo'l yoki boshqaruv belgisi bo'lmasin: brauzerdek faqat oxirgi qism olinadi. */
function sanitizeFileName(name: string): string {
  const baseName = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = baseName.replace(/[\u0000-\u001f\u007f:*?"<>|]+/g, '_').replace(/^\.+/, '').trim();
  return clean.slice(0, 180);
}

/** `attachment; filename*=UTF-8''statistika_08.01-14.01.2027.csv` yoki `filename="…"`. */
export function fileNameFromDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback;
  const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)?.[1];
  if (encoded) {
    try {
      const name = sanitizeFileName(decodeURIComponent(encoded.trim().replace(/^"|"$/g, '')));
      if (name) return name;
    } catch {
      // Noto'g'ri kodlangan bo'lsa oddiy `filename` ga o'tamiz.
    }
  }
  const plain = /filename\s*=\s*("?)([^";]+)\1/.exec(header)?.[2];
  const name = plain ? sanitizeFileName(plain) : '';
  return name || fallback;
}

/** Blob'ni brauzerga fayl qilib saqlaydi (yashirin havola orqali). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Brauzer yuklashni boshlagach URL kerak emas; darhol bekor qilinsa Firefox to'xtatadi.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Matnni (masalan, `buildCsv` natijasi) CSV fayl qilib saqlaydi. */
export function saveCsv(csv: string, fileName: string): void {
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
}

export interface DownloadedFile {
  fileName: string;
  size: number;
}

export interface FetchedFile {
  blob: Blob;
  fileName: string;
}

/** Server tayyorlagan faylni olib keladi (saqlamaydi) — oldindan ko'rish va chop etish uchun. */
export async function fetchFile(
  url: string,
  fallbackName: string,
  config: Omit<AxiosRequestConfig, 'responseType'> = {},
): Promise<FetchedFile> {
  try {
    const response = await httpClient.request<Blob>({
      method: 'GET',
      timeout: REQUEST_TIMEOUT.file,
      ...config,
      url,
      responseType: 'blob',
    });
    if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error('Fayl bo‘sh qaytdi');
    return { blob: response.data, fileName: fileNameFromDisposition(response.headers['content-disposition'], fallbackName) };
  } catch (error) {
    throw await withReadableErrorBody(error);
  }
}

/** Server tayyorlagan faylni yuklab, saqlaydi. Nom serverdan, bo'lmasa `fallbackName`. */
export async function downloadFile(
  url: string,
  fallbackName: string,
  config: Omit<AxiosRequestConfig, 'responseType'> = {},
): Promise<DownloadedFile> {
  const { blob, fileName } = await fetchFile(url, fallbackName, config);
  saveBlob(blob, fileName);
  return { fileName, size: blob.size };
}
