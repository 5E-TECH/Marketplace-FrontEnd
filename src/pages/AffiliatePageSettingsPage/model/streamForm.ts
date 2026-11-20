import type { AffiliateStream, StreamPatch } from '../../../features/affiliate/api/offersApi';
import type { StreamTemplate } from '../../../features/affiliate/model/offerTypes';

export const SUB_KEYS = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'] as const;
export type SubKey = (typeof SUB_KEYS)[number];

/** «Sahifani sozlash» formasi (FE-05: shablon, narx, sub1–sub5, Meta va TikTok piksel). Postback — FE-28. */
export interface StreamForm {
  template: StreamTemplate;
  price: number | null;
  subs: Record<SubKey, string>;
  metaPixelId: string;
  tiktokPixelId: string;
}

export const formOf = (stream: AffiliateStream): StreamForm => ({
  template: stream.template,
  price: stream.salePrice,
  subs: { sub1: stream.sub1 ?? '', sub2: stream.sub2 ?? '', sub3: stream.sub3 ?? '', sub4: stream.sub4 ?? '', sub5: stream.sub5 ?? '' },
  metaPixelId: stream.metaPixelId ?? '',
  tiktokPixelId: stream.tiktokPixelId ?? '',
});

/** Faqat o'zgargan maydonlar (bo'sh satr — o'chirish, backend shunday qabul qiladi). */
export function formPatch(stream: AffiliateStream, form: StreamForm): StreamPatch {
  const base = formOf(stream);
  const patch: StreamPatch = {};
  if (form.template !== base.template) patch.template = form.template;
  if (form.price !== null && form.price !== base.price) patch.salePrice = form.price;
  for (const key of SUB_KEYS) if (form.subs[key].trim() !== base.subs[key]) patch[key] = form.subs[key].trim();
  if (form.metaPixelId.trim() !== base.metaPixelId) patch.metaPixelId = form.metaPixelId.trim();
  if (form.tiktokPixelId.trim() !== base.tiktokPixelId) patch.tiktokPixelId = form.tiktokPixelId.trim();
  return patch;
}

/** Piksel formati — backend bilan bir xil: Meta faqat raqam, TikTok lotin harf va raqam. */
export function pixelErrors(form: StreamForm): { meta: boolean; tiktok: boolean } {
  return {
    meta: !/^\d*$/.test(form.metaPixelId.trim()),
    tiktok: !/^[A-Za-z0-9]*$/.test(form.tiktokPixelId.trim()),
  };
}

/** Havola sub bilan: «elchi.uz/w4n8re?sub1=fb-reels-1» — bo'sh sublar qo'shilmaydi. */
export function linkWithSubs(link: string, subs: StreamForm['subs']): string {
  const url = new URL(link);
  for (const key of SUB_KEYS) if (subs[key].trim()) url.searchParams.set(key, subs[key].trim());
  return url.toString();
}
