import type { OrderStatus } from '../model/orderTypes';

/**
 * Buyurtma holatlari guruhlari (admin-buyurtmalar, nazoratchi-buyurtmalar, operator-buyurtmalarim tablari):
 * Omborda → Elchi'da → Yetkazilgan → Qaytish; «Bekor qilindi» alohida. «Muammoli» — 2-bosqich (BUY-7), yopiq tab.
 */
export const ORDER_GROUPS: ReadonlyArray<{ key: 'warehouse' | 'elchi' | 'delivered' | 'return' | 'cancelled'; statuses: readonly OrderStatus[] }> = [
  { key: 'warehouse', statuses: ['CONFIRMED', 'PICKING', 'PACKED'] },
  { key: 'elchi', statuses: ['HANDED_TO_ELCHI', 'IN_TRANSIT'] },
  { key: 'delivered', statuses: ['DELIVERED', 'REMITTED', 'SETTLED'] },
  { key: 'return', statuses: ['RETURN_REQUESTED', 'REFUSED', 'RETURNING', 'RETURNED_GRADED'] },
  { key: 'cancelled', statuses: ['CANCELLED'] },
];

/** Operator (operator-buyurtmalarim): «Bekor qilindi» Omborda guruhida — o'zi bekor qilgani shu yerda ko'rinadi. */
export const OPERATOR_ORDER_GROUPS: typeof ORDER_GROUPS = [
  { key: 'warehouse', statuses: ['CONFIRMED', 'PICKING', 'PACKED', 'CANCELLED'] },
  { key: 'elchi', statuses: ['HANDED_TO_ELCHI', 'IN_TRANSIT'] },
  { key: 'delivered', statuses: ['DELIVERED', 'REMITTED', 'SETTLED'] },
  { key: 'return', statuses: ['RETURN_REQUESTED', 'REFUSED', 'RETURNING', 'RETURNED_GRADED'] },
];

/** BUY-3 (BE-18): Elchi'ga topshirilgunga qadar — tasdiqlangan, yig'ilayotgan, qadoqlangan. */
export const CANCELABLE: readonly OrderStatus[] = ['CONFIRMED', 'PICKING', 'PACKED'];
export const isCancelable = (status: OrderStatus) => CANCELABLE.includes(status);

/** Buyurtma yo'li (karta tepasidagi 8 qadam): asosiy zanjir. */
export const ORDER_PATH: readonly OrderStatus[] = ['CONFIRMED', 'PICKING', 'PACKED', 'HANDED_TO_ELCHI', 'IN_TRANSIT', 'DELIVERED', 'REMITTED', 'SETTLED'];

/** Posilka Elchi'da yaratilgan (trek bor yoki bo'lishi kerak). */
export const AT_ELCHI: readonly OrderStatus[] = ['HANDED_TO_ELCHI', 'IN_TRANSIT', 'DELIVERED', 'REMITTED', 'SETTLED', 'RETURN_REQUESTED', 'REFUSED', 'RETURNING', 'RETURNED_GRADED'];
