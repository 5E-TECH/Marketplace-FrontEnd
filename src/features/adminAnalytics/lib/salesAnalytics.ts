import dayjs from 'dayjs';
import type { AdminOrder, AdminOrderDetail, AdminOrderStatus } from '../../orders/model/orderTypes';

const DATE = 'YYYY-MM-DD';

/**
 * Savdo deb hisoblanadigan buyurtmalar — backend `/admin/dashboard` dagi `gmv` bilan bir xil qoida:
 * qoralama (tasdiqlanmagan COD), to'lov kutilayotgan, bekor qilingan va qaytarilganlar kirmaydi.
 */
const REALIZED_STATUSES: readonly AdminOrderStatus[] = ['PAID', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED'];
export const isRealized = (order: AdminOrder) => REALIZED_STATUSES.includes(order.status);

/**
 * Buyurtma kuni. Backend `dateFrom`/`dateTo` filtri kunni UTC bo'yicha oladi — grafik ham shunday
 * guruhlanadi, aks holda davr chetidagi buyurtma tanlangan davrdan tashqaridagi kunga tushardi.
 */
const orderDay = (createdAt: string) => new Date(createdAt).toISOString().slice(0, 10);

export interface SalesRange { dateFrom: string; dateTo: string }
export interface SalesTotals { gmv: number; orders: number; averageCheck: number }
export interface SalesDay { date: string; gmv: number; orders: number }
export interface ShopSales { shopId: string; gmv: number; orders: number }
export interface ProductSales { productId: string; name: string; quantity: number; gmv: number }

export function salesTotals(orders: AdminOrder[]): SalesTotals {
  const gmv = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  return { gmv, orders: orders.length, averageCheck: orders.length ? Math.round(gmv / orders.length) : 0 };
}

/** Davrning har kuni (savdosiz kunlar ham nol bilan) — grafikda bo'shliq "yo'q kun" emas, "savdo bo'lmagan kun". */
export function salesByDay(orders: AdminOrder[], range: SalesRange): SalesDay[] {
  const byDate = new Map<string, SalesDay>();
  for (let day = dayjs(range.dateFrom); !day.isAfter(dayjs(range.dateTo), 'day'); day = day.add(1, 'day')) {
    const date = day.format(DATE);
    byDate.set(date, { date, gmv: 0, orders: 0 });
  }
  for (const order of orders) {
    const entry = byDate.get(orderDay(order.createdAt));
    if (!entry) continue;
    entry.gmv += order.totalAmount;
    entry.orders += 1;
  }
  return [...byDate.values()];
}

/** Xuddi shu uzunlikdagi oldingi davr — "o'syaptimi yoki tushyaptimi" shu bilan solishtiriladi. */
export function previousRange(range: SalesRange): SalesRange {
  const days = dayjs(range.dateTo).diff(dayjs(range.dateFrom), 'day') + 1;
  const dateTo = dayjs(range.dateFrom).subtract(1, 'day');
  return { dateFrom: dateTo.subtract(days - 1, 'day').format(DATE), dateTo: dateTo.format(DATE) };
}

/** Foizdagi o'zgarish; oldingi davrda qiymat bo'lmasa solishtirib bo'lmaydi (`null`). */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Do'konlar reytingi — har sotuvchi buyurtmasining tovarlar summasi (yetkazish haqisiz). */
export function rankShops(details: AdminOrderDetail[]): ShopSales[] {
  const shops = new Map<string, ShopSales>();
  for (const sellerOrder of details.flatMap((detail) => detail.sellerOrders)) {
    if (!sellerOrder.shopId) continue;
    const entry = shops.get(sellerOrder.shopId) ?? { shopId: sellerOrder.shopId, gmv: 0, orders: 0 };
    entry.gmv += sellerOrder.amount ?? 0;
    entry.orders += 1;
    shops.set(sellerOrder.shopId, entry);
  }
  return [...shops.values()].sort((a, b) => b.gmv - a.gmv || b.orders - a.orders);
}

/** Mahsulotlar reytingi — sotilgan dona bo'yicha, teng bo'lsa summa bo'yicha. */
export function rankProducts(details: AdminOrderDetail[]): ProductSales[] {
  const products = new Map<string, ProductSales>();
  for (const item of details.flatMap((detail) => detail.items)) {
    const key = item.productId ?? item.name;
    const entry = products.get(key) ?? { productId: key, name: item.name, quantity: 0, gmv: 0 };
    entry.quantity += item.quantity ?? 0;
    entry.gmv += item.totalPrice ?? 0;
    products.set(key, entry);
  }
  return [...products.values()].sort((a, b) => b.quantity - a.quantity || b.gmv - a.gmv);
}
