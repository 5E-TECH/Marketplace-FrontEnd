import type { CreativeType } from '../model/adminProductTypes';

/** BE-08 sozlamasi (`CREATIVE_*_TYPES`, `*_MAX_MB`) — server ham tekshiradi; bu yerda — darhol javob. */
export const CREATIVE_LIMITS: Record<CreativeType, { mimes: readonly string[]; maxMb: number; accept: string }> = {
  VIDEO: { mimes: ['video/mp4', 'video/webm'], maxMb: 100, accept: 'video/mp4,video/webm' },
  IMAGE: { mimes: ['image/jpeg', 'image/png', 'image/webp'], maxMb: 10, accept: 'image/jpeg,image/png,image/webp' },
};

export const MEDIA_ACCEPT = `${CREATIVE_LIMITS.IMAGE.accept},${CREATIVE_LIMITS.VIDEO.accept}`;

/** Fayl turi (rasm yoki video) va chegarasi: `type` — qabul qilinmaydi, `size` — chegaradan katta. */
export function checkMediaFile(file: File): { ok: true; type: CreativeType } | { ok: false; reason: 'type' } | { ok: false; reason: 'size'; limitMb: number } {
  const type = (Object.keys(CREATIVE_LIMITS) as CreativeType[]).find((key) => CREATIVE_LIMITS[key].mimes.includes(file.type));
  if (!type) return { ok: false, reason: 'type' };
  const { maxMb } = CREATIVE_LIMITS[type];
  return file.size > maxMb * 1024 * 1024 ? { ok: false, reason: 'size', limitMb: maxMb } : { ok: true, type };
}
