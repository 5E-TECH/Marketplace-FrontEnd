import { httpClient } from './httpClient';
import { unwrapApiData } from './apiResponse';

function parseUploadedFileUrl(value: unknown): string {
  const result = unwrapApiData(value);
  if (typeof result === 'string' && result.trim()) return result;
  if (typeof result === 'object' && result !== null) {
    const record = result as Record<string, unknown>;
    for (const key of ['url', 'imageUrl', 'fileUrl', 'location', 'path']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }
  throw new Error('Fayl yuklandi, ammo server URL qaytarmadi');
}

export async function uploadFile(
  file: File,
  productId: string,
  isCover: boolean,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('productId', productId);
  formData.append('isCover', String(isCover));
  const { data } = await httpClient.post<unknown>('/files/upload', formData, {
    timeout: 60_000,
    onUploadProgress: ({ loaded, total }) => {
      if (!total) return;
      onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
    },
  });
  return parseUploadedFileUrl(data);
}
