import type { components } from '../generated/api-types';
import { mockOffers } from './fixtures/offers';
import { resetRegisteredMockAccounts } from './fixtures/users';
import { resetMockOperator } from './handlers/operator';
import { resetMockOtp } from './handlers/sellerAuth';
import { resetMockProfiles } from './handlers/sellerProfile';
import { addDays, seeded, tashkentDate } from './utils';

/**
 * Mock «baza»: dev sessiyasi davomida o'zgaradigan holat (operator holati, bronlar,
 * bildirishnomalar). Shakl generatsiya qilingan tiplardan — backend DTO o'zgarsa,
 * `tsc` shu yerda yiqiladi va mock jimgina eskirib qolmaydi.
 * Testlar har birida `resetMockDb()` bilan boshlang'ich holatga qaytaradi.
 */
type Schemas = components['schemas'];

export interface MockNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  data: Record<string, unknown>;
  createdAt: string;
}

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const PRODUCTS = [
  { id: '501', name: 'Simsiz quloqchinlar', salePrice: 262_000 },
  { id: '502', name: 'Oshxona tarozisi', salePrice: 189_000 },
  { id: '503', name: 'Elektr choynak', salePrice: 245_000 },
] as const;

function streams(): Schemas['AffiliateStreamDto'][] {
  return [
    { code: 'k7m2qa', product: PRODUCTS[0], salePrice: 262_000, clicks: 500, leads: 40, sales: 10 },
    { code: 'p3v9tx', product: PRODUCTS[0], salePrice: 287_000, clicks: 200, leads: 20, sales: 4 },
  ].map((stream, index) => ({
    id: `33${index + 1}`,
    code: stream.code,
    link: `https://elchi.example/${stream.code}`,
    productId: stream.product.id,
    productName: stream.product.name,
    template: 'STANDART',
    salePrice: stream.salePrice,
    status: 'ACTIVE',
    sub1: null, sub2: null, sub3: null, sub4: null, sub5: null,
    metaPixelId: null,
    tiktokPixelId: null,
    postbackUrl: null,
    hasPostbackSecret: false,
    hasCapiToken: false,
    clicks: stream.clicks,
    leads: stream.leads,
    sales: stream.sales,
    createdAt: `${addDays(tashkentDate(), -7)}T09:00:00.000Z`,
  }));
}

/** Kunlik statistika qatori — sana bo'yicha barqaror sonlar. */
export function affiliateStatsRow(key: string): Schemas['AffiliateStatsRowDto'] {
  const clicks = seeded(`${key}:c`, 40, 130);
  const leads = Math.round(clicks / seeded(`${key}:r`, 9, 14));
  const validLeads = Math.max(0, leads - seeded(`${key}:i`, 0, 2));
  const confirmed = Math.min(validLeads, seeded(`${key}:t`, 1, 5));
  const delivered = seeded(`${key}:d`, 0, 4);
  const refused = seeded(`${key}:x`, 0, 2);
  const income = delivered * 65_000;
  const hold = seeded(`${key}:h`, 0, 1) ? income : 0;
  return { key, clicks, leads, validLeads, confirmed, delivered, refused, incomeHold: hold, incomeAvailable: income - hold };
}

function operatorLeads(): Schemas['OperatorLeadListItemDto'][] {
  return [
    { id: 'L-1284', status: 'BOOKED', customerName: 'Aziza', productName: PRODUCTS[0].name, bookedUntil: minutesFromNow(8), callbackAt: null, reminderDue: false },
    { id: 'L-1255', status: 'CALLBACK', customerName: 'Muxlisa', productName: PRODUCTS[1].name, bookedUntil: null, callbackAt: minutesFromNow(4), reminderDue: true },
    { id: 'L-1253', status: 'CALLBACK', customerName: 'Hilola', productName: PRODUCTS[2].name, bookedUntil: null, callbackAt: minutesFromNow(95), reminderDue: false },
  ];
}

function notifications(): MockNotification[] {
  return [
    // Sotuvchi xabarlari (sotuvchi-bosh «Bugungi xabarlar»): `data` — mahsulot, sahifa kodi va haq (taklif, fe-04-sotuvchi.md 5-bo'lim).
    { id: '1', type: 'lead_confirmed', title: 'Yangi sotuv', body: 'Operator buyurtmani tasdiqladi. Haqingiz 86 250 so‘m — mijoz to‘lagach yoziladi.', isRead: false, data: { productName: 'Simsiz quloqchinlar', streamCode: 'p3v9tx' }, createdAt: minutesFromNow(-30) },
    { id: '2', type: 'order_delivered', title: 'Yetkazildi', body: 'Ushlab turilgan: odatda 1–2 kunda «mavjud»ga o‘tadi', isRead: true, data: { productName: 'Simsiz quloqchinlar', streamCode: 'k7m2qa', amount: 65_000 }, createdAt: minutesFromNow(-120) },
  ];
}

export const MOCK_PRODUCTS = PRODUCTS;

function createMockDb() {
  return {
    offers: mockOffers(),
    streams: streams(),
    operator: {
      state: 'OFFLINE' as Schemas['OperatorStateDto']['state'],
      maxBookings: 5,
      leads: operatorLeads(),
    },
    notifications: notifications(),
  };
}

export const db = createMockDb();

export function resetMockDb(): void {
  Object.assign(db, createMockDb());
  resetRegisteredMockAccounts();
  resetMockOtp();
  resetMockProfiles();
  resetMockOperator();
}
