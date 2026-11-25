import type { WholesalerAct, WholesalerMoney } from '../../features/wholesalers/model/wholesalerTypes';

/**
 * Optovik kartasi (FE-25, admin-optovik-karta) — taklif raqamlari: mahsulot bo'yicha sotuv (Elchi'da yo'lda,
 * yetkazilgan, qaytgan), moliya hisobi (BE-33: to'lanadigan, ushlab turilgan, akt-sverka) va optovikka aktlar.
 * Dizayn namunasi: Namuna Savdo MChJ (7) — 27 dona yo'lda, 187 sotilgan, 5 qaytgan; 20 080 000 so'm to'lanadigan.
 */
export const MOCK_PRODUCT_SALES: Record<string, { inTransit: number; sold: number; returned: number }> = {
  '501': { inTransit: 12, sold: 141, returned: 2 },
  '502': { inTransit: 0, sold: 0, returned: 0 },
  '503': { inTransit: 3, sold: 0, returned: 1 },
  '504': { inTransit: 12, sold: 46, returned: 2 },
};

/** Qaytganlardan: omborda saralanmoqda va hali Elchi'da qaytib kelmoqda (5 = 3 + 2). */
export const MOCK_RETURNS_SPLIT: Record<string, { sorting: number; inElchi: number; returnCodes: string[] }> = {
  '7': { sorting: 3, inElchi: 2, returnCodes: ['BA-0041', 'BA-0042'] },
};

/** Keyingi dushanba 09:00 (Toshkent) — haftalik akt-sverka (moliya cron). */
function nextMonday(now = Date.now()): string {
  const tashkent = new Date(now + 5 * 3_600_000);
  const days = (8 - tashkent.getUTCDay()) % 7 || 7;
  const day = new Date(Date.UTC(tashkent.getUTCFullYear(), tashkent.getUTCMonth(), tashkent.getUTCDate() + days, 4, 0));
  return day.toISOString();
}

export function mockWholesalerMoney(id: string): WholesalerMoney | null {
  if (id !== '7') return null;
  return {
    payable: 20_080_000, payableQty: 168, held: 2_420_000, heldQty: 19, paid: 0, written: 22_500_000, writtenQty: 187,
    formula: [{ quantity: 141, basePrice: 140_000 }, { quantity: 46, basePrice: 60_000 }],
    nextActAt: nextMonday(),
    lastAct: {
      id: '1', code: 'AS-0001', periodFrom: '2027-01-04', periodTo: '2027-01-10', status: 'READY', preparedAt: '2027-01-11T04:00:00.000Z',
      counted: 0, notCounted: 17_480_000, transfer: 0,
    },
  };
}

export function mockWholesalerActs(id: string): WholesalerAct[] {
  if (id !== '7') return [];
  return [
    { id: 'BA-0042', kind: 'DEFECT', code: 'BA-0042', title: 'Elektr choynak · 1 dona · L-1031', at: '2027-01-14T05:30:00.000Z', sentAt: null },
    { id: 'BA-0041', kind: 'DEFECT', code: 'BA-0041', title: 'Oshxona tarozisi · 1 dona · L-1012', at: '2027-01-13T05:00:00.000Z', sentAt: null },
    { id: 'P-0098', kind: 'RECEIVING', code: 'P-0098', title: 'Bolalar termos shishasi · farq: 2 brak', at: '2026-12-29T05:00:00.000Z', sentAt: null },
    { id: 'AS-0001', kind: 'SETTLEMENT', code: 'AS-0001', title: '04.01–10.01.2027 · o‘tkaziladi 0 so‘m', at: '2027-01-11T04:00:00.000Z', sentAt: null },
  ];
}
