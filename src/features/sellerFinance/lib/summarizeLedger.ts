import type { LedgerEntry, SellerPayout } from '../model/sellerFinanceTypes';

export interface PeriodTotals {
  /** SALE + COD_SALE — sotilgan tovarlar qiymati. */
  gross: number;
  /** COMMISSION yozuvlari (musbat ko'rinishda). */
  commission: number;
  /** REFUND yozuvlari (musbat ko'rinishda). */
  refunds: number;
  /** gross − commission − refunds. */
  net: number;
  ordersCount: number;
}

export interface OrderSettlement {
  key: string;
  kind: 'order' | 'return';
  referenceId: string;
  paymentMethod: 'online' | 'cod' | null;
  /** Shu buyurtma bo'yicha eng birinchi yozuv sanasi. */
  date: string;
  gross: number;
  commission: number;
  refunds: number;
  net: number;
  /** Online sotuv uchun ochilgan payout (`referenceId` = posilka). COD'da naqd sotuvchida — payout yo'q. */
  payout: SellerPayout | null;
}

/** Posilkaga bog'langan yozuvlar; `return_request` refund'i esa qaytarish so'rovining raqami bilan keladi. */
const ORDER_REFERENCES = new Set(['seller_order', 'cod_seller_order', 'seller_order_refund']);
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Backend ledger yozuvlaridan davr yig'indisi va har buyurtma bo'yicha hisob (finance-service qoidalari):
 * online — SALE(+), COMMISSION(−); COD — COD_SALE(+), COD_SETTLEMENT(−, naqd sotuvchida), COMMISSION(−);
 * qaytarish — REFUND(−). COD_SETTLEMENT, PAYOUT va ADJUST tushum hisobiga kirmaydi.
 */
export function summarizeLedger(entries: readonly LedgerEntry[], payouts: readonly SellerPayout[]): { totals: PeriodTotals; orders: OrderSettlement[] } {
  const payoutByOrder = new Map(payouts.map((payout) => [payout.referenceId, payout]));
  const rows = new Map<string, OrderSettlement>();
  const row = (entry: LedgerEntry): OrderSettlement | null => {
    const kind = ORDER_REFERENCES.has(entry.referenceType) ? 'order' : entry.referenceType === 'return_request' ? 'return' : null;
    if (!kind) return null;
    const key = `${kind}:${entry.referenceId}`;
    const current = rows.get(key) ?? { key, kind, referenceId: entry.referenceId, paymentMethod: null, date: entry.createdAt, gross: 0, commission: 0, refunds: 0, net: 0, payout: kind === 'order' ? payoutByOrder.get(entry.referenceId) ?? null : null };
    if (Date.parse(entry.createdAt) < Date.parse(current.date)) current.date = entry.createdAt;
    rows.set(key, current);
    return current;
  };
  for (const entry of entries) {
    const target = row(entry);
    if (!target) continue;
    if (entry.entryType === 'SALE' || entry.entryType === 'COD_SALE') {
      target.gross += entry.amount;
      target.paymentMethod = entry.entryType === 'SALE' ? 'online' : 'cod';
    } else if (entry.entryType === 'COMMISSION') {
      target.commission -= entry.amount;
      target.paymentMethod ??= entry.referenceType === 'cod_seller_order' ? 'cod' : 'online';
    } else if (entry.entryType === 'REFUND') {
      target.refunds -= entry.amount;
    }
  }
  const orders = [...rows.values()]
    .map((item) => ({ ...item, gross: round(item.gross), commission: round(item.commission), refunds: round(item.refunds), net: round(item.gross - item.commission - item.refunds) }))
    .filter((item) => item.gross || item.commission || item.refunds)
    .sort((first, second) => Date.parse(second.date) - Date.parse(first.date));
  const sum = (pick: (item: OrderSettlement) => number) => round(orders.reduce((total, item) => total + pick(item), 0));
  const totals = { gross: sum((item) => item.gross), commission: sum((item) => item.commission), refunds: sum((item) => item.refunds), net: 0, ordersCount: orders.filter((item) => item.kind === 'order' && item.gross > 0).length };
  totals.net = round(totals.gross - totals.commission - totals.refunds);
  return { totals, orders };
}
