import { http } from 'msw';
import type { components } from '../../generated/api-types';
import { affiliateStatsRow, db } from '../db';
import { addDays, API, fail, ok, pageOf, seeded } from '../utils';
import { currentMockUser } from './auth';

type Schemas = components['schemas'];

/** Sotuvchi kabineti (BE-25: /affiliate/*). Faqat AFFILIATE — boshqasiga 403. */
const guard = (request: Request, cookies: Record<string, string>) => {
  const user = currentMockUser(request, cookies);
  if (!user) return fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan');
  if (user.role !== 'AFFILIATE') return fail(403, 'FORBIDDEN', 'Bu bo‘lim sotuvchi uchun');
  return null;
};

function statsRows(from: string, to: string): Schemas['AffiliateStatsRowDto'][] {
  const rows: Schemas['AffiliateStatsRowDto'][] = [];
  for (let day = from; day <= to && rows.length < 400; day = addDays(day, 1)) rows.push(affiliateStatsRow(day));
  return rows;
}

function totals(rows: Schemas['AffiliateStatsRowDto'][]): Schemas['AffiliateStatsRowDto'] {
  const sum = (field: Exclude<keyof Schemas['AffiliateStatsRowDto'], 'key'>) => rows.reduce((total, row) => total + row[field], 0);
  return {
    key: 'TOTAL',
    clicks: sum('clicks'), leads: sum('leads'), validLeads: sum('validLeads'), confirmed: sum('confirmed'),
    delivered: sum('delivered'), refused: sum('refused'), incomeHold: sum('incomeHold'), incomeAvailable: sum('incomeAvailable'),
  };
}

export const affiliateHandlers = [
  http.get(`${API}/affiliate/stats`, ({ request, cookies }) => {
    const denied = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return fail(400, 'VALIDATION_ERROR', 'from va to sanasi kerak (YYYY-MM-DD)');
    }
    const groupBy = url.searchParams.get('groupBy') ?? 'DAY';
    const daily = statsRows(from, to);
    const rows = groupBy === 'DAY'
      ? daily
      : db.streams.map((stream) => ({ ...totals(daily.map((row) => affiliateStatsRow(`${row.key}:${stream.code}`))), key: groupBy === 'SUB1' ? 'fb-reels-1' : stream.code }));
    const body: Schemas['AffiliateStatsDto'] = { rows, totals: totals(daily) };
    return ok(body);
  }),

  http.get(`${API}/affiliate/offers`, ({ request, cookies }) => {
    const denied = guard(request, cookies);
    if (denied) return denied;
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLocaleLowerCase() ?? '';
    const page: Schemas['AffiliateOffersPageDto'] = pageOf(db.offers.filter((offer) => offer.name.toLocaleLowerCase().includes(search)), url);
    return ok(page);
  }),

  http.get(`${API}/affiliate/streams`, ({ request, cookies }) => {
    const denied = guard(request, cookies);
    if (denied) return denied;
    const page: Schemas['AffiliateStreamsPageDto'] = pageOf(db.streams, new URL(request.url));
    return ok(page);
  }),

  http.post(`${API}/affiliate/streams`, async ({ request, cookies }) => {
    const denied = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['CreateAffiliateStreamDto']>;
    const offer = db.offers.find((item) => item.productId === body.productId);
    if (!offer) return fail(404, 'NOT_FOUND', 'Offer topilmadi');
    const code = `m${seeded(`${Date.now()}`, 10000, 99999).toString(36)}`;
    const stream: Schemas['AffiliateStreamDto'] = {
      ...db.streams[0], id: `34${db.streams.length + 1}`, code, link: `https://elchi.example/${code}`,
      productId: offer.productId, productName: offer.name, salePrice: offer.approvedPrice,
      clicks: 0, leads: 0, sales: 0, createdAt: new Date().toISOString(),
    };
    db.streams.unshift(stream);
    return ok(stream, 201);
  }),

  http.get(`${API}/affiliate/leads`, ({ request, cookies }) => {
    const denied = guard(request, cookies);
    if (denied) return denied;
    const statuses = ['CALLBACK', 'CONFIRMED', 'MERGED', 'NEW', 'CONFIRMED', 'REJECTED'] as const;
    const rows: Schemas['AffiliateLeadRowDto'][] = statuses.map((status, index) => ({
      id: `L-12${72 - index}`,
      createdAt: new Date(Date.now() - (index + 1) * 47 * 60_000).toISOString(),
      streamCode: db.streams[index % db.streams.length].code,
      sub1: index % 2 ? 'fb-reels-1' : null, sub2: null, sub3: null, sub4: null, sub5: null,
      phoneLast4: String(2087 + index * 1111).slice(-4),
      status,
      orderStatus: status === 'CONFIRMED' ? 'IN_TRANSIT' : null,
      commission: status === 'CONFIRMED' ? 65_000 : null,
      commissionState: status === 'CONFIRMED' ? 'PENDING' : status === 'MERGED' ? 'NONE' : null,
    }));
    const page: Schemas['AffiliateLeadsPageDto'] = pageOf(rows, new URL(request.url));
    return ok(page);
  }),
];
