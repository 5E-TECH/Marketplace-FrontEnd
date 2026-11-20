import { http } from 'msw';
import type { components } from '../../generated/api-types';
import { affiliateStatsRow, db } from '../db';
import { addDays, API, fail, ok, pageOf, seeded, tashkentDate } from '../utils';
import { isNewMockAccount } from '../fixtures/users';
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

const ROW_FIELDS = ['clicks', 'leads', 'validLeads', 'confirmed', 'delivered', 'refused'] as const;

/**
 * Kunlik qatorni sahifalarga bo'ladi: sahifalar yig'indisi kunlik jamiga teng (backendda ham
 * shunday — bitta lidlar to'plami). Birinchi sahifaga ~60 %, qolgani teng.
 */
function splitByStream(row: Schemas['AffiliateStatsRowDto'], count: number): Schemas['AffiliateStatsRowDto'][] {
  return splitByWeights(row, Array.from({ length: count }, (_, index) => (count === 1 ? 1 : index === 0 ? 0.6 : 0.4 / (count - 1))));
}

/** sub1 qiymatlari (FE-06 «Kesim: Sub»): bo'sh qiymat — `''` («sub yo'q» qatori). Yig'indisi jamiga teng. */
const SUB1_SPLIT: readonly [string, number][] = [['fb-reels-1', 0.45], ['fb-reels-2', 0.3], ['tg-kanal', 0.15], ['', 0.1]];

function splitByWeights(row: Schemas['AffiliateStatsRowDto'], weights: readonly number[]): Schemas['AffiliateStatsRowDto'][] {
  const part = (value: number) => {
    const parts = weights.map((weight) => Math.floor(value * weight));
    parts[0] += value - parts.reduce((sum, item) => sum + item, 0);
    return parts;
  };
  const split = Object.fromEntries(ROW_FIELDS.map((field) => [field, part(row[field])])) as Record<(typeof ROW_FIELDS)[number], number[]>;
  return weights.map((_, index) => {
    const income = split.delivered[index] * 65_000;
    const hold = row.incomeHold > 0 ? income : 0;
    return {
      key: row.key,
      ...(Object.fromEntries(ROW_FIELDS.map((field) => [field, split[field][index]])) as Record<(typeof ROW_FIELDS)[number], number>),
      incomeHold: hold,
      incomeAvailable: income - hold,
    };
  });
}

function totals(rows: Schemas['AffiliateStatsRowDto'][]): Schemas['AffiliateStatsRowDto'] {
  const sum = (field: Exclude<keyof Schemas['AffiliateStatsRowDto'], 'key'>) => rows.reduce((total, row) => total + row[field], 0);
  return {
    key: 'TOTAL',
    clicks: sum('clicks'), leads: sum('leads'), validLeads: sum('validLeads'), confirmed: sum('confirmed'),
    delivered: sum('delivered'), refused: sum('refused'), incomeHold: sum('incomeHold'), incomeAvailable: sum('incomeAvailable'),
  };
}

type LeadStatus = Schemas['AffiliateLeadRowDto']['status'];
const OPEN_STATUSES: readonly LeadStatus[] = ['CALLBACK', 'CALLBACK', 'NEW', 'MERGED', 'BOOKED', 'REJECTED', 'NO_CONTACT'];

/** Kun qatoridagi lidlar: tasdiqlangan va yaroqsiz soni statistikadagidek, qolgani — urug'li tasodif. */
function leadsOfDay(day: Schemas['AffiliateStatsRowDto'], today: string): Schemas['AffiliateLeadRowDto'][] {
  const perStream = splitByStream(day, Math.max(db.streams.length, 1));
  const codes = perStream.flatMap((part, index) => Array.from({ length: part.leads }, () => db.streams[index]?.code ?? 'k7m2qa'));
  const invalid = day.leads - day.validLeads;
  const now = Date.now();
  // Bugungi lidlar hozirgacha bo'lgan soatlarga, o'tgan kunlarniki — kun bo'ylab.
  const dayStart = Date.parse(`${day.key}T00:00:00+05:00`);
  const span = day.key === today ? Math.max(60_000, now - dayStart - 60_000) : 24 * 3_600_000 - 60_000;
  return codes.map((streamCode, index) => {
    const leadStatus: LeadStatus = index < day.confirmed
      ? 'CONFIRMED'
      : index < day.confirmed + invalid
        ? 'INVALID'
        : OPEN_STATUSES[seeded(`${day.key}:${index}:s`, 0, OPEN_STATUSES.length - 1)];
    const confirmed = leadStatus === 'CONFIRMED';
    return {
      id: `L-${day.key.replaceAll('-', '').slice(2)}${String(index + 1).padStart(2, '0')}`,
      createdAt: new Date(dayStart + Math.round((span * (index + 1)) / (codes.length + 1))).toISOString(),
      streamCode,
      sub1: SUB1_SPLIT[index % SUB1_SPLIT.length][0] || null, sub2: null, sub3: null, sub4: null, sub5: null,
      phoneLast4: String(seeded(`${day.key}:${index}:p`, 1000, 9999)),
      status: leadStatus,
      orderStatus: confirmed ? 'IN_TRANSIT' : null,
      commission: confirmed ? 65_000 : null,
      commissionState: confirmed ? 'PENDING' : leadStatus === 'MERGED' ? 'NONE' : null,
    };
  });
}

const emptyCounts = { clicks: 0, leads: 0, validLeads: 0, confirmed: 0, delivered: 0, refused: 0, incomeHold: 0, incomeAvailable: 0 };

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
    const streamId = url.searchParams.get('streamId');
    // Yangi sotuvchi (dev'da ro'yxatdan o'tgan): sahifasi yo'q — hamma son 0.
    const fresh = isNewMockAccount(currentMockUser(request, cookies) ?? { phone: '' });
    const allDaily = statsRows(from, to).map((row) => (fresh ? { ...row, ...emptyCounts } : row));
    const streams = fresh ? [] : db.streams;
    const byStream = allDaily.map((row) => splitByStream(row, Math.max(streams.length, 1)));
    // Sahifa filtri (`streamId`): faqat o'sha sahifaning ulushi — kun va sub kesimi ham shu bo'yicha.
    const streamIndex = streamId ? streams.findIndex((stream) => stream.id === streamId) : -1;
    if (streamId && streamIndex < 0) return fail(404, 'NOT_FOUND', 'Sahifa topilmadi');
    const daily = streamIndex >= 0 ? byStream.map((parts, day) => ({ ...parts[streamIndex], key: allDaily[day].key })) : allDaily;
    const all = totals(daily);
    const rows = groupBy === 'DAY'
      ? daily
      : groupBy === 'SUB1'
        ? splitByWeights(all, SUB1_SPLIT.map(([, weight]) => weight)).map((row, index) => ({ ...row, key: SUB1_SPLIT[index][0] })).filter((row) => row.clicks + row.leads > 0)
        : streams
            .map((stream, index) => ({ ...totals(byStream.map((parts) => parts[index])), key: stream.code }))
            .filter((_, index) => streamIndex < 0 || index === streamIndex);
    const body: Schemas['AffiliateStatsDto'] = { rows, totals: all };
    return ok(body);
  }),

  // Balans (taklif, BE-23): oxirgi 30 kun daromadi. Ushlab turilgani — oxirgi 2 kundagisi (odatda 1–2 kunda
  // «mavjud»ga o'tadi), eskisi mavjudga qo'shiladi. FE-07 gacha pul yechilmagan.
  http.get(`${API}/affiliate/balance`, ({ request, cookies }) => {
    const denied = guard(request, cookies);
    if (denied) return denied;
    if (isNewMockAccount(currentMockUser(request, cookies) ?? { phone: '' })) return ok({ available: 0, held: 0 });
    const today = tashkentDate();
    const recentFrom = addDays(today, -1);
    const rows = statsRows(addDays(today, -29), today);
    const held = rows.filter((row) => row.key >= recentFrom).reduce((sum, row) => sum + row.incomeHold, 0);
    const all = totals(rows);
    return ok({ available: all.incomeAvailable + all.incomeHold - held, held });
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
    const fresh = isNewMockAccount(currentMockUser(request, cookies) ?? { phone: '' });
    const page: Schemas['AffiliateStreamsPageDto'] = pageOf(fresh ? [] : db.streams, new URL(request.url));
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
    const url = new URL(request.url);
    const today = tashkentDate();
    const from = url.searchParams.get('from') ?? today;
    const to = url.searchParams.get('to') ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return fail(400, 'VALIDATION_ERROR', 'from va to sanasi kerak (YYYY-MM-DD)');
    }
    const fresh = isNewMockAccount(currentMockUser(request, cookies) ?? { phone: '' });
    const status = url.searchParams.get('status');
    const streamCode = db.streams.find((stream) => stream.id === url.searchParams.get('streamId'))?.code;
    // Lidlar statistika bilan bir xil: kun va sahifa bo'yicha soni `/affiliate/stats` dagidek.
    const rows = (fresh ? [] : statsRows(from, to).flatMap((day) => leadsOfDay(day, today)))
      .filter((row) => !status || row.status === status)
      .filter((row) => !streamCode || row.streamCode === streamCode)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page: Schemas['AffiliateLeadsPageDto'] = pageOf(rows, url);
    return ok(page);
  }),
];
