/** C6.9 — bosh sahifa reklama bannerlari (backend: /admin/content/banners). */
export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Backend hisoblaydi: shu daqiqada storefront'da ko'rinayaptimi. */
  isVisible: boolean;
}

export interface BannerPayload {
  title?: string;
  imageUrl?: string;
  linkUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface BannerOrderItem { id: string; sortOrder: number }

/** Backend `MAX_BANNERS` bilan bir xil: undan ko'pini yaratib bo'lmaydi. */
export const MAX_BANNERS = 100;

/** Storefront do'kon sahifasi (Marketplace-Storefront: `src/app/dokon/[slug]`). */
export const shopBannerLink = (slug: string): string => `/dokon/${encodeURIComponent(slug)}`;

/** `/dokon/:slug` havolasidan slug; boshqa havola bo'lsa null. */
export function shopSlugFromBannerLink(link: string | null): string | null {
  const match = link?.match(/^\/dokon\/([^/?#]+)\/?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
