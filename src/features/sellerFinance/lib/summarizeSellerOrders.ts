import type { SellerOrder, SellerOrderStatus } from '../../orders/model/orderTypes';

/** Yetkazilmagan, lekin bekor ham qilinmagan buyurtmalar — tushum hali kutilmoqda. */
const IN_PROGRESS: ReadonlySet<SellerOrderStatus> = new Set(['NEW', 'PENDING', 'CONFIRMED', 'SHIPMENT_CREATED', 'RECEIVED', 'ON_THE_ROAD']);
const CLOSED: ReadonlySet<SellerOrderStatus> = new Set(['CANCELLED', 'RETURNED']);

interface EarningsBucket { count: number; amount: number }
export interface SellerOrdersSummary {
  delivered: EarningsBucket;
  inProgress: EarningsBucket;
  closed: EarningsBucket;
  ordersCount: number;
}

/**
 * Buyurtmalar bo'yicha yig'indi: summa — tovarlar qiymati (`subtotal`), komissiya
 * ayirilmagan va yetkazish haqi qo'shilmagan. Komissiya, qo'lga tegadigan summa va
 * o'tkazmalar backend hisobidan keladi — bu yerda taxmin qilinmaydi.
 */
export function summarizeSellerOrders(orders: ReadonlyArray<Pick<SellerOrder, 'status' | 'subtotal'>>): SellerOrdersSummary {
  const bucket = (): EarningsBucket => ({ count: 0, amount: 0 });
  const summary: SellerOrdersSummary = { delivered: bucket(), inProgress: bucket(), closed: bucket(), ordersCount: orders.length };
  for (const order of orders) {
    const target = order.status === 'DELIVERED' ? summary.delivered : IN_PROGRESS.has(order.status) ? summary.inProgress : CLOSED.has(order.status) ? summary.closed : null;
    if (!target) continue;
    target.count += 1;
    target.amount += order.subtotal;
  }
  return summary;
}
