export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Taklif (admin-kategoriyalar; OMB-3, TZ 8): BAD va yaroqlilik muddati — `null`/yo'q: ota kategoriyadan yoki sukut. */
  isBad?: boolean | null;
  expiryTracked?: boolean | null;
  children: Category[];
}

export interface CategoryPayload {
  name: string;
  parentId?: string | null;
  iconUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  /** Taklif (fe-12 §9): nomdan hosil bo'lgandan farq qilsagina yuboriladi — backend hozir slugni nomdan yaratadi. */
  slug?: string;
  /** Taklif (fe-12 §9): `null` — ota kategoriyadan meros. O'zgargandagina yuboriladi. */
  isBad?: boolean | null;
  expiryTracked?: boolean | null;
}

/** PATCH: faqat o'zgargan maydonlar. */
export type CategoryPatch = Partial<CategoryPayload>;
