import { http } from 'msw';
import type { components } from '../../generated/api-types';
import { db, MOCK_PRODUCTS } from '../db';
import { API, fail, ok, seeded } from '../utils';
import { currentMockUser } from './auth';

type Schemas = components['schemas'];

/**
 * Operator navbati (BE-13 / BE-25: /operator/*). Qoidalar backend'dagidek: lid olish
 * faqat «Onlayn»da, bir vaqtda ≤ 5 bron, bron 10 daqiqa (5, 6-qoidalar).
 */
const BOOKING_MINUTES = 10;

const guard = (request: Request, cookies: Record<string, string>, roles: readonly string[] = ['OPERATOR_LEAD']) => {
  const user = currentMockUser(request, cookies);
  if (!user) return { denied: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan'), user: null };
  if (!roles.includes(user.role)) return { denied: fail(403, 'FORBIDDEN', 'Bu bo‘lim operator uchun'), user };
  return { denied: null, user };
};

const activeBookings = () => db.operator.leads.filter((lead) => lead.status === 'BOOKED').length;

function stateDto(): Schemas['OperatorStateDto'] {
  return { state: db.operator.state, activeBookings: activeBookings(), maxBookings: db.operator.maxBookings };
}

function leadCard(id: string): Schemas['LeadCardDto'] | null {
  const item = db.operator.leads.find((lead) => lead.id === id);
  if (!item) return null;
  const product = MOCK_PRODUCTS.find((entry) => entry.name === item.productName) ?? MOCK_PRODUCTS[0];
  const deliveryFee = 30_000;
  return {
    id: item.id,
    status: item.status,
    source: 'LANDING',
    customerName: item.customerName,
    phoneMasked: `+998 ** *** ${seeded(item.id, 10, 99)} ${seeded(`${item.id}:2`, 10, 99)}`,
    product: { id: product.id, name: product.name, salePrice: product.salePrice },
    quantity: 1,
    address: {
      regionSoato: '1730', regionName: 'Farg‘ona viloyati',
      districtSoato: '1730412', districtName: 'Qo‘qon shahri',
      addressLine: 'Navoiy ko‘chasi, 12-uy', whereDeliver: 'CENTER', confirmedAt: null, editedByOperator: false,
    },
    price: { unitPrice: product.salePrice, quantity: 1, subtotal: product.salePrice, whereDeliver: 'CENTER', deliveryFee, totalAmount: product.salePrice + deliveryFee },
    rejectReason: null,
    callScript: 'Assalomu alaykum! Elchi Market’dan qo‘ng‘iroq qilyapman — buyurtmangizni tasdiqlash uchun.',
    stockShortage: false,
    attemptsCount: 0,
    bookedUntil: item.bookedUntil,
    nextAttemptAt: item.callbackAt,
    orderId: null,
    attempts: [],
    history: [{ at: new Date(Date.now() - 6 * 60_000).toISOString(), fromStatus: null, toStatus: 'NEW', actor: 'Tizim', note: null }],
    previousLeads: [],
    createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
  };
}

let nextLeadNumber = 1290;

export const operatorHandlers = [
  http.put(`${API}/operator/state`, async ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['UpdateOperatorStateDto']>;
    if (body.state !== 'ONLINE' && body.state !== 'BREAK' && body.state !== 'OFFLINE') {
      return fail(400, 'VALIDATION_ERROR', 'state: ONLINE, BREAK yoki OFFLINE');
    }
    db.operator.state = body.state;
    return ok(stateDto());
  }),

  http.get(`${API}/operator/queue-summary`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies, ['OPERATOR_LEAD', 'SUPERVISOR', 'ADMIN', 'SUPERADMIN']);
    if (denied) return denied;
    const summary: Schemas['OperatorQueueSummaryDto'] = {
      newLeads: 8,
      dueCallbacks: db.operator.leads.filter((lead) => lead.reminderDue).length + 5,
      booked: activeBookings() + 8,
      operators: [
        { operatorId: 'U-0003', name: 'Dilnoza R.', state: db.operator.state, activeBookings: activeBookings() },
        { operatorId: 'U-0031', name: 'Feruza Y.', state: 'BREAK', activeBookings: 2 },
        { operatorId: 'U-0032', name: 'Lola A.', state: 'OFFLINE', activeBookings: 0 },
      ],
    };
    return ok(summary);
  }),

  http.get(`${API}/operator/leads`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    return ok(db.operator.leads.filter((lead) => lead.status === 'BOOKED' || lead.status === 'CALLBACK'));
  }),

  http.post(`${API}/operator/leads/next`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    if (db.operator.state === 'BREAK') return fail(409, 'OPERATOR_ON_BREAK', 'Operator tanaffusda');
    if (db.operator.state === 'OFFLINE') return fail(409, 'OPERATOR_OFFLINE', 'Operator oflayn');
    if (activeBookings() >= db.operator.maxBookings) return fail(409, 'BOOKING_LIMIT_REACHED', 'Bronlar to‘la');
    nextLeadNumber += 1;
    const product = MOCK_PRODUCTS[nextLeadNumber % MOCK_PRODUCTS.length];
    db.operator.leads.unshift({
      id: `L-${nextLeadNumber}`, status: 'BOOKED', customerName: ['Mohira', 'Sarvar', 'Gulnoza'][nextLeadNumber % 3],
      productName: product.name, bookedUntil: new Date(Date.now() + BOOKING_MINUTES * 60_000).toISOString(), callbackAt: null, reminderDue: false,
    });
    return ok(leadCard(`L-${nextLeadNumber}`));
  }),

  http.get(`${API}/operator/leads/:id`, ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const card = leadCard(String(params.id));
    return card ? ok(card) : fail(404, 'NOT_FOUND', 'Lid topilmadi');
  }),

  http.post(`${API}/operator/leads/:id/result`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const lead = db.operator.leads.find((item) => item.id === String(params.id));
    if (!lead) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['SubmitLeadResultDto']>;
    const status: Schemas['LeadResultAcceptedDto']['status'] =
      body.outcome === 'CONFIRMED' ? 'CONFIRMED'
        : body.outcome === 'REJECTED' ? 'REJECTED'
          : body.outcome === 'INVALID' ? 'INVALID'
            : body.outcome === 'DUPLICATE' ? 'MERGED' : 'CALLBACK';
    const nextAttemptAt = status === 'CALLBACK' ? body.callbackAt ?? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    db.operator.leads = db.operator.leads.filter((item) => item.id !== lead.id);
    if (status === 'CALLBACK') db.operator.leads.push({ ...lead, status, bookedUntil: null, callbackAt: nextAttemptAt, reminderDue: false });
    const accepted: Schemas['LeadResultAcceptedDto'] = { leadId: lead.id, status, nextAttemptAt };
    return ok(accepted);
  }),

  http.patch(`${API}/operator/leads/:id/address`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const card = leadCard(String(params.id));
    if (!card) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['UpdateLeadAddressDto']>;
    return ok({ ...card, address: card.address && { ...card.address, addressLine: body.addressLine ?? card.address.addressLine, whereDeliver: body.whereDeliver ?? card.address.whereDeliver, confirmedAt: new Date().toISOString(), editedByOperator: true } });
  }),

  http.post(`${API}/operator/leads/:id/quote`, async ({ request, cookies, params }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const card = leadCard(String(params.id));
    if (!card) return fail(404, 'NOT_FOUND', 'Lid topilmadi');
    const body = (await request.json().catch(() => ({}))) as Partial<Schemas['LeadPriceQuoteDto']>;
    const quantity = Math.max(1, Math.min(10, Number(body.quantity) || 1));
    const whereDeliver = body.whereDeliver === 'ADDRESS' ? 'ADDRESS' : 'CENTER';
    const deliveryFee = whereDeliver === 'ADDRESS' ? 45_000 : 30_000;
    const subtotal = card.product.salePrice * quantity;
    const price: Schemas['LeadPriceDto'] = { unitPrice: card.product.salePrice, quantity, subtotal, whereDeliver, deliveryFee, totalAmount: subtotal + deliveryFee };
    return ok(price);
  }),

  http.get(`${API}/operator/stats`, ({ request, cookies }) => {
    const { denied } = guard(request, cookies);
    if (denied) return denied;
    const stats: Schemas['OperatorStatsDto'] = { attempts: 38, confirmed: 9, approveRate: 0.41, saleRate: 0.72, firstCallMedianMinutes: 4 };
    return ok(stats);
  }),
];
