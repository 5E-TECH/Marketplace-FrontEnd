import type { LotState, StockLot, WarehouseStockRow } from '../../features/inbound/model/inboundTypes';

/** Partiya ko'rinishi: BE-17 `StockLotDto` + qoldiqdagi yacheyka va optovik, holat va qo'shni partiya. */
export interface LotView extends StockLot {
  state: LotState;
  /** Partiya raqami — yo'q bo'lsa ID: «#12». */
  number: string;
  cell: string | null;
  wholesalerName: string | null;
  /** Shu SKU ning sotuvdagi boshqa partiyasi (bitta yacheyka, bir xil shtrix-kod — yig'ishda skaner farqlamaydi). */
  sharesCellWith: string | null;
}

/** Holat: muddati o'tgan → sotuvdan chiqarilgan (BE-17 `blocked`, 60 kun) → sotuvda. */
export const lotState = (lot: StockLot, today: string): LotState => (lot.expiryDate < today ? 'EXPIRED' : lot.blocked ? 'BLOCKED' : 'ON_SALE');

export function lotViews(lots: readonly StockLot[], stock: readonly WarehouseStockRow[], today: string): LotView[] {
  const rows = new Map(stock.map((row) => [row.variantId, row]));
  const views = lots.map((lot) => ({
    ...lot,
    state: lotState(lot, today),
    number: lot.batch ?? `#${lot.id}`,
    cell: rows.get(lot.variantId)?.cell ?? null,
    wholesalerName: rows.get(lot.variantId)?.wholesalerName ?? null,
    sharesCellWith: null as string | null,
  }));
  views.forEach((view) => {
    if (view.state === 'ON_SALE') return;
    view.sharesCellWith = views.find((other) => other.variantId === view.variantId && other.state === 'ON_SALE')?.number ?? null;
  });
  return views;
}
