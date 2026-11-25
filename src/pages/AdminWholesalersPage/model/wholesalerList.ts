import { hasContract } from '../../../features/wholesalers/lib/wholesalerRules';
import type { CabinetFilter, ContractFilter, Wholesaler, WholesalerTab } from '../../../features/wholesalers/model/wholesalerTypes';
import { WHOLESALER_TABS } from '../../../features/wholesalers/model/wholesalerTypes';

export type PageTab = 'wholesalers' | 'shipments' | 'applications';

/** Optovik kartasi (FE-25, admin-optovik-karta). */
export const cardPath = (id: string) => `/admin/wholesalers/${encodeURIComponent(id)}`;

export const parsePageTab = (value: string | null): PageTab => (value === 'shipments' || value === 'applications' ? value : 'wholesalers');
export const parseStatusTab = (value: string | null): WholesalerTab => ((WHOLESALER_TABS as readonly string[]).includes(value ?? '') ? (value as WholesalerTab) : 'ALL');
export const parseContract = (value: string | null): ContractFilter | null => (value === 'SIGNED' || value === 'MISSING' ? value : null);
export const parseCabinet = (value: string | null): CabinetFilter | null => (value === 'ACTIVE' || value === 'INVITED' || value === 'NONE' ? value : null);

export interface WholesalerKpis {
  /** Faol va shartnomasi imzolangan — mahsulot va postavka qabul qila oladiganlar. */
  working: number;
  stock: { onHand: number; available: number; reserved: number } | null;
  waiting: { count: number; qty: number; codes: string[] } | null;
  payable: { amount: number; held: number } | null;
}

/**
 * Sahifa tepasidagi to'rt raqam — optoviklar yig'masidan (taklif `stats`). Bittasida ham `stats` bo'lmasa (backend hali
 * bermasa) — o'sha ko'rsatkich «—», noto'g'ri kichik son ko'rsatilmaydi.
 */
export function wholesalerKpis(list: readonly Wholesaler[]): WholesalerKpis {
  const stats = list.map((item) => item.stats);
  const complete = stats.every(Boolean);
  const sum = (pick: (value: NonNullable<Wholesaler['stats']>) => number) => stats.reduce((total, value) => total + (value ? pick(value) : 0), 0);
  return {
    working: list.filter((item) => item.status === 'ACTIVE' && hasContract(item)).length,
    stock: complete ? { onHand: sum((value) => value.stock.onHand), available: sum((value) => value.stock.available), reserved: sum((value) => value.stock.reserved) } : null,
    waiting: complete ? {
      count: sum((value) => value.shipments.waiting),
      qty: sum((value) => value.shipments.waitingQty),
      codes: stats.flatMap((value) => value?.shipments.waitingCodes ?? []).sort(),
    } : null,
    payable: complete ? { amount: sum((value) => value.payable.amount), held: sum((value) => value.payable.held) } : null,
  };
}

/** Ko'p kodli qatorda birinchi uchtasi va «…»: «P-0111, P-0112, P-0113». */
export const codeList = (codes: readonly string[], max = 3) => (codes.length > max ? `${codes.slice(0, max).join(', ')}, …` : codes.join(', '));
