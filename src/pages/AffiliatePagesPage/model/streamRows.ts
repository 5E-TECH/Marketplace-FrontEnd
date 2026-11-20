import type { AffiliateStats } from '../../../features/affiliate/api/affiliateApi';
import type { AffiliateOffer, AffiliateStream } from '../../../features/affiliate/api/offersApi';
import { feeAt } from '../../../features/affiliate/lib/offerMath';
import { statsIncome } from '../../../features/affiliate/lib/statsSummary';
import { streamStatus, type StreamDisplayStatus } from '../../../features/affiliate/lib/streamStatus';
import { tashkentDate, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';

export type StreamTab = 'all' | 'active' | 'stopped';
export const STREAM_TABS: readonly StreamTab[] = ['all', 'active', 'stopped'];

export interface StreamRow {
  stream: AffiliateStream;
  offer: AffiliateOffer | undefined;
  status: StreamDisplayStatus;
  /** Shu narxda har sotuvdan haq; offer ro'yxatda bo'lmasa — noma'lum. */
  fee: number | null;
  /** Hamma vaqt daromadi (mavjud + ushlab turilgan) va ushlab turilgani; statistika kelmaguncha `null`. */
  income: number | null;
  hold: number | null;
  /** «yaratildi 14.01.2027, 14:37» (bugun) yoki «07.01.2027». */
  createdLabel: string;
}

/** Sahifalar qatorlari: holat offer qoldig'idan, haq — narxdan, daromad — statistika (kesim: sahifa) dan. */
export function streamRows(streams: readonly AffiliateStream[], offers: ReadonlyMap<string, AffiliateOffer>, byStream: AffiliateStats | undefined, today: string): StreamRow[] {
  const income = new Map((byStream?.rows ?? []).map((row) => [row.key, row]));
  return streams.map((stream) => {
    const offer = offers.get(stream.productId);
    const stats = income.get(stream.code);
    return {
      stream,
      offer,
      status: streamStatus(stream, offer),
      fee: offer ? feeAt(offer, stream.salePrice) : null,
      income: byStream ? (stats ? statsIncome(stats) : 0) : null,
      hold: byStream ? (stats?.incomeHold ?? 0) : null,
      createdLabel: tashkentDate(Date.parse(stream.createdAt)) === today ? tashkentDateTime(stream.createdAt) : tashkentDay(stream.createdAt),
    };
  });
}

export const inTab = (row: StreamRow, tab: StreamTab) => tab === 'all' || (tab === 'active') === (row.status === 'ACTIVE');

/** Qidiruv: sahifa kodi yoki mahsulot nomi (katta-kichik harf farqsiz). */
export function matchesSearch(row: StreamRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || row.stream.code.toLocaleLowerCase().includes(needle) || row.stream.productName.toLocaleLowerCase().includes(needle);
}

export function streamTotals(rows: readonly StreamRow[]) {
  const known = rows.every((row) => row.income !== null);
  return {
    clicks: rows.reduce((total, row) => total + row.stream.clicks, 0),
    leads: rows.reduce((total, row) => total + row.stream.leads, 0),
    sales: rows.reduce((total, row) => total + (row.stream.sales ?? 0), 0),
    income: known ? rows.reduce((total, row) => total + (row.income ?? 0), 0) : null,
    hold: known ? rows.reduce((total, row) => total + (row.hold ?? 0), 0) : null,
  };
}

/** «Hamma vaqt» davri: eng eski sahifa yaratilgan kundan bugungacha. */
export function allTimeFrom(streams: readonly AffiliateStream[], today: string): string {
  return streams.reduce((first, stream) => {
    const day = tashkentDate(Date.parse(stream.createdAt));
    return day < first ? day : first;
  }, today);
}
