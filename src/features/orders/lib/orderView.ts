import type { TranslationKey } from '../../../shared/i18n/translations';
import { shortTime } from '../../../shared/lib/dayTime';
import type { OrderDetail, OrderListItem, OrderStatus } from '../model/orderTypes';
import { AT_ELCHI, isCancelable, ORDER_PATH } from './orderStatus';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Buyurtma lid raqami bilan ko'rinadi («L-1276»); lid bo'lmasa — buyurtma raqami. */
export const orderNumber = (order: Pick<OrderListItem, 'id' | 'leadId'>) => order.leadId ?? order.id;

/** Davom etayotgan holat — vaqt «dan» bilan («14:36 dan · Otabek N.», «13.01, 17:05 dan»). */
const ONGOING: readonly OrderStatus[] = ['PICKING', 'IN_TRANSIT'];

/** «Holat · o'zgardi» ustunidagi izoh: «14:24 · ertangi to'lqin», «14:36 dan · Otabek N.». */
export function statusLine(order: Pick<OrderListItem, 'status' | 'statusAt' | 'statusDetail'>, t: T, now = Date.now()): string | null {
  const time = order.statusAt ? shortTime(order.statusAt, now) : null;
  const when = time && ONGOING.includes(order.status) ? t('ord.since', { time }) : time;
  const parts = [when, order.statusDetail].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** «Buxoro viloyati, Buxoro shahri». */
export const placeLine = (order: Pick<OrderListItem, 'regionName' | 'districtName'>) => [order.regionName, order.districtName].filter(Boolean).join(', ') || null;

/** Bekor qilib bo'lmasa — sababi (menyu maslahati). `null` — bekor qilsa bo'ladi (BUY-3). */
export function cancelBlock(status: OrderStatus): TranslationKey | null {
  if (isCancelable(status)) return null;
  if (status === 'CANCELLED') return 'ord.cancel.already';
  return AT_ELCHI.includes(status) ? 'ord.cancel.atElchi' : 'ord.cancel.closed';
}

/** Holati 2 daqiqa ichida o'zgargan qator — 60 soniyalik yangilanishda ajraladi. */
export const isFreshOrder = (order: Pick<OrderListItem, 'statusAt'>, now = Date.now()) => Boolean(order.statusAt) && now - Date.parse(order.statusAt ?? '') < 2 * 60_000;

/** Qaytish zanjiri: rad etilgan yoki qaytarish so'ralgan posilka omborga qaytadi va saralanadi. */
const RETURN_TAIL: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  REFUSED: ['RETURNING', 'RETURNED_GRADED'],
  RETURN_REQUESTED: ['RETURNING', 'RETURNED_GRADED'],
  RETURNING: ['RETURNED_GRADED'],
};

export type OrderStep = { status: OrderStatus; state: 'done' | 'current' | 'todo'; at: string | null };

/**
 * Holat zanjiri (BUY-2; panel 560 va buyurtma kartasi «Buyurtma yo'li»): asosiy yo'l yoki tarixdagi holatlar + joriy +
 * qolgan qadamlar. Joriy vaqt — `statusAt` (jadval bilan bir); o'tgan qadamlar — qabul qilingan tarix yozuvidan.
 */
export function orderChain({ status, statusAt }: Pick<OrderListItem, 'status' | 'statusAt'>, detail: OrderDetail | undefined): OrderStep[] {
  const history = detail?.lead?.statusHistory.filter((entry) => entry.accepted) ?? [];
  const atOf = (code: OrderStatus) => (code === status && statusAt) || ([...history].reverse().find((entry) => entry.toStatus === code)?.createdAt ?? null);
  const index = ORDER_PATH.indexOf(status);
  if (index >= 0) {
    return ORDER_PATH.map((code, position) => ({ status: code, state: position < index ? 'done' : position === index ? 'current' : 'todo', at: position <= index ? atOf(code) : null }));
  }
  const passed = [...new Set(history.map((entry) => entry.toStatus))].filter((code) => code !== status);
  return [
    ...passed.map((code): OrderStep => ({ status: code, state: 'done', at: atOf(code) })),
    { status, state: 'current', at: atOf(status) },
    ...(RETURN_TAIL[status] ?? []).map((code): OrderStep => ({ status: code, state: 'todo', at: null })),
  ];
}

/** Karta ma'lumotidan ro'yxat qatori shakli — umumiy oynalar (bekor qilish, yorliq) va menyu uchun. */
export function orderListItem(detail: OrderDetail): OrderListItem {
  const item = detail.sellerOrders[0]?.items[0] ?? null;
  return {
    id: detail.id,
    leadId: detail.lead?.leadId ?? null,
    status: detail.status,
    createdAt: detail.createdAt,
    buyerName: detail.buyerName,
    phoneMasked: detail.phoneMasked ?? null,
    totalAmount: detail.totalAmount,
    deliveryFee: detail.deliveryFee,
    source: detail.lead?.source ?? null,
    affiliateId: detail.lead?.affiliateId ?? null,
    regionName: detail.customer?.regionName ?? null,
    districtName: detail.customer?.districtName ?? null,
    whereDeliver: detail.lead?.whereDeliver ?? null,
    productId: item?.productId ?? null,
    productName: item?.productName ?? null,
    quantity: item?.quantity ?? null,
    streamCode: detail.stream?.code ?? null,
    affiliateName: detail.stream?.affiliateName ?? null,
    statusAt: detail.statusAt ?? detail.updatedAt,
    statusDetail: detail.statusDetail ?? null,
    trackNumber: detail.parcel?.track ?? null,
    confirmedBy: detail.confirmedByActor ?? null,
    stockCell: isCancelable(detail.status) ? detail.picking?.cell ?? null : null,
  };
}
