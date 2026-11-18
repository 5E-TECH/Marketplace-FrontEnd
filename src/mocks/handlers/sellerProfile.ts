import { delay, http, HttpResponse } from 'msw';
import type { AgreementAcceptance, SellerProfile, SelfEmployedInfo } from '../../features/sellerProfile/model/sellerProfileTypes';
import { digitsOf, isNewMockAccount, type MockAccount } from '../fixtures/users';
import { samplePdf } from '../samplePdf';
import { API, fail, ok } from '../utils';
import { currentMockUser } from './auth';

/**
 * Sotuvchi profili (FE-04; backend hali yo'q — taklif: docs/api-taklif/fe-04-sotuvchi.md).
 * Jasur (900000001) — hammasi tayyor: JShShIR tasdiqlangan, karta bor. Dev'da ro'yxatdan
 * o'tgan sotuvchi — ism bo'sh, JShShIR kiritilmagan, karta yo'q.
 *
 * Mock JShShIR: `…0000` bilan tugasa — darhol rad etiladi (rad etish holatini ko'rish uchun).
 */
const DAY = 24 * 60 * 60_000;
const profiles = new Map<string, SellerProfile>();
/** Yuklangan ma'lumotnomalar: id → fayl (faqat egasi o'qiydi). */
const documents = new Map<string, { owner: string; name: string; type: string; bytes: ArrayBuffer }>();

const notSubmitted: SelfEmployedInfo = {
  status: 'NOT_SUBMITTED', pinflLast4: null, activity: null, submittedAt: null, checkedAt: null, reason: null, comment: null, documentName: null,
};

const agreements = (offerVersion: string, consentVersion: string, at: string): AgreementAcceptance[] => [
  { type: 'affiliate-offer', version: offerVersion, acceptedAt: at, current: true },
  { type: 'personal-data-consent', version: consentVersion, acceptedAt: at, current: true },
];

function seedProfile(account: MockAccount): SellerProfile {
  const [firstName = '', ...rest] = account.name.split(' ');
  if (account.id === 'U-0001') {
    const registeredAt = new Date(Date.now() - 10 * DAY).toISOString();
    return {
      id: account.id, firstName, lastName: rest.join(' '), phone: account.phone, registeredAt,
      lastLoginAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      agreements: agreements('1.0', '1.0', registeredAt),
      selfEmployed: {
        status: 'VERIFIED', pinflLast4: '4018', activity: 'SMM va internet-marketing',
        submittedAt: new Date(Date.now() - 9.2 * DAY).toISOString(), checkedAt: new Date(Date.now() - 9 * DAY).toISOString(),
        reason: null, comment: null, documentName: 'maqom-malumotnoma.pdf',
      },
      card: { brand: 'UZCARD', last4: '7731', addedAt: new Date(Date.now() - 9 * DAY).toISOString() },
    };
  }
  if (account.id === 'U-0010') {
    const registeredAt = new Date(Date.now() - 40 * DAY).toISOString();
    return {
      id: account.id, firstName, lastName: rest.join(' '), phone: account.phone, registeredAt,
      lastLoginAt: new Date(Date.now() - DAY).toISOString(),
      agreements: agreements('0.9', '1.0', registeredAt),
      selfEmployed: {
        status: 'REJECTED', pinflLast4: '3365', activity: 'SMM va internet-marketing',
        submittedAt: new Date(Date.now() - 2 * DAY).toISOString(), checkedAt: new Date(Date.now() - 1.5 * DAY).toISOString(),
        reason: 'Faoliyat turi 34-band emas', comment: 'Hujjatda boshqa faoliyat turi.', documentName: 'maqom-malumotnoma.pdf',
      },
      card: null,
    };
  }
  const registeredAt = new Date().toISOString();
  return {
    id: account.id, firstName, lastName: rest.join(' '), phone: account.phone, registeredAt, lastLoginAt: registeredAt,
    agreements: agreements('1.0', '1.0', registeredAt), selfEmployed: notSubmitted, card: null,
  };
}

function profileOf(account: MockAccount): SellerProfile {
  const key = digitsOf(account.phone);
  const existing = profiles.get(key);
  if (existing) return existing;
  const created = seedProfile(account);
  profiles.set(key, created);
  return created;
}

/** Ro'yxat yakunlandi: qabul qilingan versiya va vaqt saqlanadi (sotuvchi-oferta). */
export function recordMockRegistration(account: MockAccount, offerVersion: string, consentVersion: string): void {
  const at = new Date().toISOString();
  profiles.set(digitsOf(account.phone), { ...seedProfile(account), registeredAt: at, lastLoginAt: at, agreements: agreements(offerVersion, consentVersion, at) });
}

export function resetMockProfiles(): void {
  profiles.clear();
  documents.clear();
}

const sellerOnly = (request: Request, cookies: Record<string, string>) => {
  const user = currentMockUser(request, cookies);
  if (!user) return { error: fail(401, 'UNAUTHENTICATED', 'Sessiya tugagan') };
  if (user.role !== 'AFFILIATE') return { error: fail(403, 'FORBIDDEN', 'Bu bo‘lim sotuvchi uchun') };
  return { user };
};

export const sellerProfileHandlers = [
  http.get(`${API}/affiliate/profile`, ({ request, cookies }) => {
    const { user, error } = sellerOnly(request, cookies);
    return error ?? ok(profileOf(user));
  }),

  http.patch(`${API}/affiliate/profile`, async ({ request, cookies }) => {
    const { user, error } = sellerOnly(request, cookies);
    if (error) return error;
    const body = (await request.json().catch(() => ({}))) as { firstName?: unknown; lastName?: unknown };
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
      return fail(400, 'VALIDATION_ERROR', 'Ism va familiyani kiriting');
    }
    const current = profileOf(user);
    // Ism o'zgarsa tasdiqlangan maqom qayta tekshiriladi (sotuvchi-jshshir «Ismim o‘zgarsa?»).
    const nameChanged = current.firstName !== firstName || current.lastName !== lastName;
    const selfEmployed: SelfEmployedInfo = nameChanged && current.selfEmployed.status === 'VERIFIED'
      ? { ...current.selfEmployed, status: 'PENDING', submittedAt: new Date().toISOString(), checkedAt: null }
      : current.selfEmployed;
    const next = { ...current, firstName, lastName, selfEmployed };
    profiles.set(digitsOf(user.phone), next);
    // `/auth/me` dagi ism ham yangilanadi — faqat dev'da ro'yxatdan o'tganlar (tayyor namunalar o'zgarmaydi).
    if (isNewMockAccount(user)) user.name = `${firstName} ${lastName}`;
    return ok(next);
  }),

  http.post(`${API}/affiliate/self-employed/document`, async ({ request, cookies }) => {
    const { user, error } = sellerOnly(request, cookies);
    if (error) return error;
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File) || file.size === 0) return fail(400, 'FILE_REQUIRED', 'Faylni tanlang');
    if (file.size > 10 * 1024 * 1024) return fail(413, 'FILE_TOO_LARGE', 'Fayl 10 MB dan katta');
    // Yuklanish foizi ko'rinishi uchun (haqiqiy tarmoqdagidek).
    await delay(700);
    const documentId = `doc-${documents.size + 1}`;
    documents.set(documentId, { owner: digitsOf(user.phone), name: file.name, type: file.type || 'application/pdf', bytes: await file.arrayBuffer() });
    return ok({ documentId, name: file.name }, 201);
  }),

  http.get(`${API}/affiliate/self-employed/document`, ({ request, cookies }) => {
    const { user, error } = sellerOnly(request, cookies);
    if (error) return error;
    const profile = profileOf(user);
    if (!profile.selfEmployed.documentName) return fail(404, 'NOT_FOUND', 'Hujjat yuklanmagan');
    const owner = digitsOf(user.phone);
    const stored = [...documents.values()].reverse().find((item) => item.owner === owner && item.name === profile.selfEmployed.documentName);
    const body = stored?.bytes ?? samplePdf(['Maqom haqida malumotnoma (namuna)', `JShShIR **** ${profile.selfEmployed.pinflLast4 ?? ''}`, 'Faoliyat turi: SMM va internet-marketing (34-band)']).buffer;
    return new HttpResponse(body as ArrayBuffer, {
      headers: { 'Content-Type': stored?.type ?? 'application/pdf', 'Content-Disposition': `inline; filename="${profile.selfEmployed.documentName}"` },
    });
  }),

  http.post(`${API}/affiliate/self-employed`, async ({ request, cookies }) => {
    const { user, error } = sellerOnly(request, cookies);
    if (error) return error;
    const body = (await request.json().catch(() => ({}))) as { pinfl?: unknown; documentId?: unknown };
    const pinfl = typeof body.pinfl === 'string' ? body.pinfl : '';
    if (!/^\d{14}$/.test(pinfl)) return fail(400, 'PINFL_INVALID', 'JShShIR 14 ta raqamdan iborat');
    const document = typeof body.documentId === 'string' ? documents.get(body.documentId) : undefined;
    if (body.documentId !== undefined && (!document || document.owner !== digitsOf(user.phone))) return fail(400, 'DOCUMENT_NOT_FOUND', 'Hujjat topilmadi — qayta yuklang');
    const current = profileOf(user);
    if (current.selfEmployed.status === 'PENDING') return fail(409, 'ALREADY_PENDING', 'Ma’lumot tekshirilmoqda');
    const now = new Date().toISOString();
    const rejected = pinfl.endsWith('0000');
    const selfEmployed: SelfEmployedInfo = {
      status: rejected ? 'REJECTED' : 'PENDING',
      pinflLast4: pinfl.slice(-4),
      activity: 'SMM va internet-marketing',
      submittedAt: now,
      checkedAt: rejected ? now : null,
      reason: rejected ? 'Faoliyat turi 34-band emas' : null,
      comment: rejected ? 'Hujjatda boshqa faoliyat turi.' : null,
      documentName: document?.name ?? null,
    };
    profiles.set(digitsOf(user.phone), { ...current, selfEmployed });
    return ok(selfEmployed, 201);
  }),

  // Ofertaning yangi versiyasini qabul qilish: eski qator «joriy» emas, yangisi vaqt bilan saqlanadi.
  http.post(`${API}/affiliate/agreements`, async ({ request, cookies }) => {
    const { user, error } = sellerOnly(request, cookies);
    if (error) return error;
    const body = (await request.json().catch(() => ({}))) as { type?: unknown; version?: unknown };
    if ((body.type !== 'affiliate-offer' && body.type !== 'personal-data-consent') || typeof body.version !== 'string' || !body.version) {
      return fail(400, 'VALIDATION_ERROR', 'Hujjat turi va versiyasi kerak');
    }
    const type: AgreementAcceptance['type'] = body.type;
    const version = body.version;
    const current = profileOf(user);
    const agreements: AgreementAcceptance[] = [
      ...current.agreements.map((item) => (item.type === type ? { ...item, current: false } : item)),
      { type, version, acceptedAt: new Date().toISOString(), current: true },
    ];
    const next = { ...current, agreements };
    profiles.set(digitsOf(user.phone), next);
    return ok(next, 201);
  }),
];
