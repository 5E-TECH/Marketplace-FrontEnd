import { http, HttpResponse } from 'msw';
import { digitsOf, findMockUser, mockTokenFor, registerMockAffiliate } from '../fixtures/users';
import { isUzMobileNumber } from '../../shared/lib/phone';
import { samplePdf } from '../samplePdf';
import { API, fail, ok } from '../utils';
import { accountLockResponse, sessionCookie } from './auth';
import { recordMockRegistration } from './sellerProfile';

/**
 * Sotuvchi SMS kodi (FE-04; backend BE-06 hali yo'q — taklif: docs/api-taklif/fe-04-sotuvchi.md).
 * Qoidalar SOT-1 dagidek: kod 5 daqiqa, 3 xato → 15 daqiqa blok, qayta yuborilsa eski kod bekor.
 *
 * Mock'da kod doim `123456`. Maxsus raqam: 900000066 — SMS kechikmoqda (provayder javob bermadi).
 */
export const MOCK_OTP_CODE = '123456';
export const MOCK_DELAYED_SMS_PHONE = '900000066';

const CODE_TTL_MS = 5 * 60_000;
const BLOCK_MS = 15 * 60_000;
const MAX_ATTEMPTS = 3;

interface OtpState {
  purpose: 'REGISTER' | 'LOGIN';
  expiresAt: number;
  attempts: number;
  blockedUntil: number;
}

const otp = new Map<string, OtpState>();
const registrationTokens = new Map<string, string>();

export function resetMockOtp(): void {
  otp.clear();
  registrationTokens.clear();
}

/** Kabinetga SMS bilan faqat sotuvchi va optovik kiradi; xodimlar — parol bilan. */
const canUseSms = (role: string) => role === 'AFFILIATE' || role === 'WHOLESALER';

const blocked = (state: OtpState | undefined) => (state && state.blockedUntil > Date.now() ? state : null);

const retryAfter = (state: OtpState) => Math.max(1, Math.ceil((state.blockedUntil - Date.now()) / 1000));

const blockedResponse = (state: OtpState) =>
  fail(423, 'OTP_BLOCKED', 'Kod 3 marta noto‘g‘ri kiritildi', { 'Retry-After': String(retryAfter(state)) }, { retryAfterSeconds: retryAfter(state) });

export const sellerAuthHandlers = [
  http.post(`${API}/auth/otp/send`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { phone?: unknown; purpose?: unknown };
    const digits = typeof body.phone === 'string' ? digitsOf(body.phone) : '';
    const purpose = body.purpose === 'LOGIN' ? 'LOGIN' : 'REGISTER';
    if (!isUzMobileNumber(digits)) return fail(400, 'PHONE_OPERATOR_INVALID', 'Bu raqam O‘zbekiston mobil operatoriga tegishli emas');

    const account = findMockUser(digits);
    if (purpose === 'REGISTER' && account) return fail(409, 'PHONE_ALREADY_REGISTERED', 'Bu raqam bilan hisob bor');
    if (purpose === 'LOGIN' && (!account || !canUseSms(account.role))) return fail(404, 'ACCOUNT_NOT_FOUND', 'Bu raqam bilan hisob topilmadi');

    const previous = blocked(otp.get(digits));
    if (previous) return blockedResponse(previous);

    // Yangi kod — eskisi bekor, urinishlar hisobi saqlanadi (sotuvchi-royxat holat 12).
    const state: OtpState = { purpose, expiresAt: Date.now() + CODE_TTL_MS, attempts: otp.get(digits)?.attempts ?? 0, blockedUntil: 0 };
    otp.set(digits, state);
    console.info(`[mock] SMS kod +998${digits}: ${MOCK_OTP_CODE}`);
    return ok({ expiresIn: Math.round(CODE_TTL_MS / 1000), delivery: digits === MOCK_DELAYED_SMS_PHONE ? 'DELAYED' : 'SENT' });
  }),

  http.post(`${API}/auth/otp/verify`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { phone?: unknown; code?: unknown; purpose?: unknown };
    const digits = typeof body.phone === 'string' ? digitsOf(body.phone) : '';
    const state = otp.get(digits);
    if (!state) return fail(410, 'OTP_EXPIRED', 'Kod muddati o‘tdi');
    if (blocked(state)) return blockedResponse(state);
    if (state.expiresAt <= Date.now()) return fail(410, 'OTP_EXPIRED', 'Kod muddati o‘tdi');

    if (body.code !== MOCK_OTP_CODE) {
      state.attempts += 1;
      if (state.attempts >= MAX_ATTEMPTS) {
        state.blockedUntil = Date.now() + BLOCK_MS;
        state.attempts = 0;
        return blockedResponse(state);
      }
      return fail(400, 'OTP_INVALID', 'Kod noto‘g‘ri', undefined, { attemptsLeft: MAX_ATTEMPTS - state.attempts });
    }

    otp.delete(digits);
    if (state.purpose === 'REGISTER') {
      const registrationToken = `reg.${digits}.${Date.now().toString(36)}`;
      registrationTokens.set(registrationToken, digits);
      return ok({ registrationToken });
    }
    const account = findMockUser(digits);
    if (!account) return fail(404, 'ACCOUNT_NOT_FOUND', 'Bu raqam bilan hisob topilmadi');
    // Backend: bloklangan yoki nofaol — kod yuborilmaydi (404, hisob borligi oshkor qilinmaydi). Taklif (fe-15 §15): kod
    // yuboriladi, to'g'ri kod raqam egasi ekanini isbotlagach — `ACCOUNT_BLOCKED` va sabab (karkassiz sahifa).
    const locked = accountLockResponse(account);
    if (locked) return locked;
    return ok({ accessToken: mockTokenFor(account) }, 200, { 'Set-Cookie': sessionCookie(account) });
  }),

  http.post(`${API}/auth/register/affiliate`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { registrationToken?: unknown; offerVersion?: unknown; consentVersion?: unknown };
    const digits = typeof body.registrationToken === 'string' ? registrationTokens.get(body.registrationToken) : undefined;
    if (!digits) return fail(410, 'REGISTRATION_EXPIRED', 'Ro‘yxat muddati o‘tdi — SMS kodni qaytadan oling');
    // «Oferta qabul qilinmasa ro‘yxat tugamaydi» — server ham versiyasiz qabul qilmaydi.
    if (typeof body.offerVersion !== 'string' || !body.offerVersion || typeof body.consentVersion !== 'string' || !body.consentVersion) {
      return fail(400, 'OFFER_NOT_ACCEPTED', 'Oferta va rozilik qabul qilinmagan');
    }
    registrationTokens.delete(body.registrationToken as string);
    const account = findMockUser(digits) ?? registerMockAffiliate(digits);
    recordMockRegistration(account, body.offerVersion, body.consentVersion);
    return ok({ accessToken: mockTokenFor(account) }, 201, { 'Set-Cookie': sessionCookie(account) });
  }),

  http.get(`${API}/legal/documents/:type/pdf`, ({ params }) => {
    const offer = params.type === 'affiliate-offer';
    if (!offer && params.type !== 'personal-data-consent') return fail(404, 'NOT_FOUND', 'Hujjat topilmadi');
    const name = offer ? 'sotuvchi-ofertasi-1.0.pdf' : 'rozilik-1.0.pdf';
    const pdf = samplePdf([offer ? 'Sotuvchi ofertasi - 1.0-versiya' : 'Shaxsiy malumotlarni qayta ishlashga rozilik - 1.0', '[matn - EQ-10, yurist tayyorlaydi]']);
    return new HttpResponse(pdf.buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"` } });
  }),

  http.get(`${API}/legal/documents/:type`, ({ params }) => {
    if (params.type === 'affiliate-offer') {
      return ok({
        type: 'affiliate-offer',
        version: '1.0',
        effectiveAt: null,
        summary: [
          { term: 'Haq', text: 'faqat mijoz to‘lagan buyurtma uchun, so‘mda yoziladi.' },
          { term: 'Pul yechish', text: 'kuniga 1 marta, kamida 50 000 so‘m, 24 soat ichida; 1% soliq ushlab qolinadi.' },
          { term: 'Soliq maqomi', text: 'pul yechishdan oldin o‘zini o‘zi band qilganlik (JShShIR) tekshiriladi.' },
          { term: 'Qoidabuzarlik', text: 'ogohlantirish → haqni 30 kungacha ushlab turish → bloklash.' },
        ],
        sections: [
          'Atamalar va taraflar', 'Sotuvchi sahifasi va lid', 'Haq va uni hisoblash', 'Ushlab turish va pul yechish', 'Soliq maqomi',
          'Reklama qoidalari', 'Mijoz ma’lumoti', 'Choralar va bloklash', 'O‘zgartirish va yangi versiya',
        ].map((title, index) => ({ id: `s${index + 1}`, title: `${index + 1}. ${title}`, body: '[oferta matni — EQ-10, yurist tayyorlaydi]' })),
      });
    }
    if (params.type === 'personal-data-consent') {
      return ok({
        type: 'personal-data-consent',
        version: '1.0',
        effectiveAt: null,
        summary: [],
        sections: [
          { id: 'what', title: 'Qaysi ma’lumot', body: 'telefon raqami; JShShIR va maqom (tekshirilgan vaqti bilan); karta — faqat provayder belgisi va oxirgi 4 raqam' },
          { id: 'why', title: 'Nima uchun', body: 'kabinetga kirish; soliq agenti sifatida 1% ni ushlab qolish va hisobot berish; pulni kartaga o‘tkazish' },
          { id: 'where', title: 'Qayerda saqlanadi', body: 'serverlar O‘zbekistonda' },
          { id: 'revoke', title: 'Rozilikni qaytarish', body: '[tartib — EQ-10]' },
        ],
      });
    }
    return fail(404, 'NOT_FOUND', 'Hujjat topilmadi');
  }),
];
