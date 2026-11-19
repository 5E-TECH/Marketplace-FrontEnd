import type { AffiliateStatsRow } from '../api/affiliateApi';
import { statsIncome } from './statsSummary';

/**
 * «Statistika» (FE-06, sotuvchi-statistika) hisoblari: sahifa kesimidagi «Sotilish» va «EPC»,
 * «Sahifa sifati» bloki. Hammasi BE-28 qatoridan — o'zimizdan son qo'shilmaydi.
 */

/** Sotilish = yetkazilgan / (yetkazilgan + rad etilgan), butun foiz; buyurtma yakunlanmagan bo'lsa — `null`. */
export function salesRate(row: Pick<AffiliateStatsRow, 'delivered' | 'refused'>): number | null {
  const finished = row.delivered + row.refused;
  return finished > 0 ? Math.round((row.delivered / finished) * 100) : null;
}

/** EPC — bir klik daromadi, so'm (daromad / kliklar, butun son); klik yo'q bo'lsa — `null`. */
export function earningsPerClick(row: Pick<AffiliateStatsRow, 'clicks' | 'incomeHold' | 'incomeAvailable'>): number | null {
  return row.clicks > 0 ? Math.round(statsIncome(row) / row.clicks) : null;
}

/** Sahifa sifati qoidasi (TZ 7): kamida 50 lid kelgach baholanadi. */
export const QUALITY_MIN_LEADS = 50;
/** Yaroqli lid ulushi chegarasi, % (yaroqli / lidlar). */
export const QUALITY_VALID_THRESHOLD = 60;
/** Tasdiq chegarasi, % (tasdiqlangan / yaroqli). */
export const QUALITY_CONFIRM_THRESHOLD = 25;

export type PageQualityState =
  /** Hali lid yo'q. */
  | 'noLeads'
  /** 50 liddan kam — baholanmaydi. */
  | 'notRated'
  /** Ikkala ko'rsatkich chegaradan yuqori. */
  | 'ok'
  /** Kamida bittasi chegaradan past (50 liddan keyin). */
  | 'below';

export interface PageQuality {
  state: PageQualityState;
  leads: number;
  /** Baholanishigacha yana nechta lid kerak (`notRated` da). */
  leadsToRate: number;
  /** Yaroqli lid ulushi, butun %; lid yo'q bo'lsa `null`. */
  validPercent: number | null;
  /** Tasdiq ulushi, butun %; yaroqli lid yo'q bo'lsa `null`. */
  confirmPercent: number | null;
  validBelow: boolean;
  confirmBelow: boolean;
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export function pageQuality(row: Pick<AffiliateStatsRow, 'leads' | 'validLeads' | 'confirmed'>): PageQuality {
  const validPercent = percent(row.validLeads, row.leads);
  const confirmPercent = percent(row.confirmed, row.validLeads);
  const rated = row.leads >= QUALITY_MIN_LEADS;
  const validBelow = rated && validPercent !== null && validPercent < QUALITY_VALID_THRESHOLD;
  const confirmBelow = rated && confirmPercent !== null && confirmPercent < QUALITY_CONFIRM_THRESHOLD;
  const state: PageQualityState =
    row.leads === 0 ? 'noLeads' : !rated ? 'notRated' : validBelow || confirmBelow ? 'below' : 'ok';
  return {
    state,
    leads: row.leads,
    leadsToRate: Math.max(0, QUALITY_MIN_LEADS - row.leads),
    validPercent,
    confirmPercent,
    validBelow,
    confirmBelow,
  };
}
