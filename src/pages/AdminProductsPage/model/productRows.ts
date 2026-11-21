import type { AdminProductListItem, ProductListTab } from '../../../features/adminProducts/model/adminProductTypes';
import { formatStamp } from '../../../features/adminProducts/lib/productFormat';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentDay } from '../../../shared/lib/tashkentTime';

export const productHref = (product: Pick<AdminProductListItem, 'id'>) => `/admin/products/${encodeURIComponent(product.id)}`;

export const PRODUCT_TABS: readonly ProductListTab[] = ['ALL', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'BLOCKED', 'DRAFT'];
export type Attention = 'OUT_OF_STOCK' | 'EXPIRY_SOON';
export type Channel = 'cpa' | 'site';

/** Ro'yxat tartibi (admin-mahsulotlar): ko'rib chiqilayotgan, faol, to'xtatilgan, rad etilgan, qoralama; ichida — yangisi tepada. */
const ORDER: Record<string, number> = { PENDING_REVIEW: 0, ACTIVE: 1, BLOCKED: 2, REJECTED: 3, DRAFT: 4, OUT_OF_STOCK: 5, ARCHIVED: 6 };
const rank = (product: AdminProductListItem) => ORDER[product.isBlocked ? 'BLOCKED' : product.status] ?? 9;

export function sortProducts(items: readonly AdminProductListItem[]): AdminProductListItem[] {
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}

/** Faol, lekin qoldiq 0 — «Qoldiq tugagan» belgisi va «Qoldiq 0» diqqat filtri. */
export const isOutOfStock = (product: AdminProductListItem) =>
  product.status === 'ACTIVE' && !product.isBlocked && product.stock !== undefined && product.stock !== null && product.stock.available <= 0;

/**
 * Holat belgisi ostidagi vaqt: faol — «06.01.2027 dan»; ko'rib chiqilmoqda, qoralama, qoldiq 0 — «13.01.2027, 17:20 dan»;
 * rad etilgan — vaqtning o'zi; to'xtatilgan — «14.01.2027, 14:37 · Nodira K.».
 */
export function statusMeta(product: AdminProductListItem, since: (date: string) => string): string {
  const at = product.statusChangedAt ?? product.submittedAt ?? product.updatedAt;
  const stamp = formatStamp(at).replace(' ', ', ');
  if (product.isBlocked) return product.statusChangedBy ? `${stamp} · ${shortPersonName(product.statusChangedBy)}` : stamp;
  if (product.status === 'REJECTED') return stamp;
  if (product.status === 'ACTIVE' && !isOutOfStock(product)) return since(tashkentDay(at));
  return since(stamp);
}

/** «Sabab (Nodira K., 13.01.2027, 15:30):» — kim va qachon (taklif: `statusChangedBy`). */
export function reasonMeta(product: AdminProductListItem): string {
  const stamp = formatStamp(product.statusChangedAt ?? product.updatedAt).replace(' ', ', ');
  return product.statusChangedBy ? `${shortPersonName(product.statusChangedBy)}, ${stamp}` : stamp;
}
