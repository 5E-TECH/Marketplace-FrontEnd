import type { AffiliateStats, AffiliateStatsRow } from '../api/affiliateApi';

const FIELDS = ['clicks', 'leads', 'validLeads', 'confirmed', 'delivered', 'refused', 'incomeHold', 'incomeAvailable'] as const;

function add(target: AffiliateStatsRow, row: AffiliateStatsRow): AffiliateStatsRow {
  const next = { ...target };
  for (const field of FIELDS) next[field] = target[field] + row[field];
  return next;
}

/**
 * Bir nechta sahifa (`streamId`) javobini bittaga yig'adi — «Mahsulot» filtri (sotuvchi-statistika):
 * BE-28 da mahsulot parametri yo'q, mahsulot = uning sahifalari yig'indisi. Bir xil kalitli qatorlar
 * (kun, sub1) qo'shiladi, tartib birinchi uchragandagidek; sahifa kesimida kalitlar har xil.
 */
export function mergeStats(list: readonly AffiliateStats[]): AffiliateStats {
  const rows = new Map<string, AffiliateStatsRow>();
  let totals: AffiliateStatsRow | null = null;
  for (const stats of list) {
    for (const row of stats.rows) {
      const current = rows.get(row.key);
      rows.set(row.key, current ? add(current, row) : { ...row });
    }
    totals = totals ? add(totals, stats.totals) : { ...stats.totals };
  }
  return {
    rows: [...rows.values()],
    totals: totals ?? { key: 'TOTAL', clicks: 0, leads: 0, validLeads: 0, confirmed: 0, delivered: 0, refused: 0, incomeHold: 0, incomeAvailable: 0 },
  };
}
