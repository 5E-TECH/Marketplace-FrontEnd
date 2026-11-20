import type { components } from '../../../generated/api-types';
import { addDays } from '../../../shared/lib/tashkentTime';

/**
 * Lid qoidalari (TZ 5-bo'lim, operator-yordam «Lid qoidalari»). Server ham shu qoidalar bilan
 * ishlaydi — ekran faqat oldindan ko'rsatadi («Keyingi urinish 14:36»), yakuniy vaqt javobdan.
 * Bu fayl `httpClient` ni import qilmaydi: mock (src/mocks) ham undan foydalanadi.
 */
type LeadCard = components['schemas']['LeadCardDto'];

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MINUTE = 60_000;

/** 3-qoida: qo'ng'iroq vaqti 09:00–21:00 (Toshkent). */
export const CALL_WINDOW = { start: '09:00', end: '21:00' } as const;
/** 5-qoida: bron 10 daqiqa. */
export const BOOKING_MINUTES = 10;
/** 4-qoida: rejalashtirilgan qo'ng'iroqdan 15 daqiqa o'tsa — lid navbatga qaytadi. */
export const CALLBACK_GRACE_MINUTES = 15;
/** 8-qoida: eslatma 5 daqiqa oldin. */
export const REMINDER_MINUTES = 5;
/** 2-qoida: 6 urinish yoki 3 kun — «Aloqa bo'lmadi». */
export const MAX_ATTEMPTS = 6;
export const MAX_DAYS = 3;
/** 9-qoida: dublikat — shu raqam va shu mahsulot, 30 kun ichida. */
export const DUPLICATE_WINDOW_DAYS = 30;

/** Toshkent sanasi va soati («2027-01-15», «11:00») → vaqt belgisi (ms). */
export function tashkentMoment(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00+05:00`);
}

/** Toshkent bo'yicha sana va «HH:mm». */
export function tashkentParts(value: number): { date: string; time: string } {
  const iso = new Date(value + TASHKENT_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** 09:00 gacha — shu kuni 09:00; 21:00 dan keyin — ertasi kuni 09:00 (3-qoida). */
export function clampToCallWindow(value: number): number {
  const { date, time } = tashkentParts(value);
  if (time < CALL_WINDOW.start) return tashkentMoment(date, CALL_WINDOW.start);
  if (time >= CALL_WINDOW.end) return tashkentMoment(addDays(date, 1), CALL_WINDOW.start);
  return value;
}

/** Vaqt qo'ng'iroq oynasidan tashqaridami (ekranda «ertasi kuni 09:00 ga suriladi»). */
export const isOutsideCallWindow = (value: number) => clampToCallWindow(value) !== value;

/**
 * 1-qoida: javob bermasa — 15 daq → 1 soat → 3 soat → ertasi kuni 10:00 → keyin kuniga bir marta.
 * `failedAttempts` — shu urinish bilan birga javobsiz urinishlar soni (1 dan).
 */
export function nextRetryAt(failedAttempts: number, now: number = Date.now()): number {
  if (failedAttempts <= 1) return clampToCallWindow(now + 15 * MINUTE);
  if (failedAttempts === 2) return clampToCallWindow(now + 60 * MINUTE);
  if (failedAttempts === 3) return clampToCallWindow(now + 180 * MINUTE);
  return tashkentMoment(addDays(tashkentParts(now).date, 1), '10:00');
}

/** «Javob bermadi», «Band», «O'chiq» — jadval bo'yicha qayta urinish (1-qoida). */
export const isNoAnswer = (outcome: LeadCard['attempts'][number]['outcome']) => outcome === 'NO_ANSWER' || outcome === 'BUSY' || outcome === 'PHONE_OFF';

/** 2-qoida tugash vaqti: lid kelganidan 3 kun [taklif: hisob boshi — operator-natija izohi]. */
export const noContactDeadline = (createdAt: number) => createdAt + MAX_DAYS * 24 * 60 * MINUTE;

/** 2-qoida: 6-urinish yoki lid kelganidan 3 kun o'tgan bo'lsa — lid «Aloqa bo'lmadi». */
export function closesAsNoContact(failedAttempts: number, createdAt: number | null, now: number = Date.now()): boolean {
  return failedAttempts >= MAX_ATTEMPTS || (createdAt !== null && now >= noContactDeadline(createdAt));
}

/** Lid turi — sarlavhadagi belgi (operator-lid-kartasi 2-bo'lim). */
export type LeadKind = 'new' | 'scheduled' | 'retry' | 'last';

export function leadKind(card: Pick<LeadCard, 'status' | 'attemptsCount' | 'nextAttemptAt'>): LeadKind {
  if (card.attemptsCount >= MAX_ATTEMPTS - 1) return 'last';
  if (card.status === 'CALLBACK' && card.nextAttemptAt) return 'scheduled';
  if (card.attemptsCount > 0) return 'retry';
  return 'new';
}

/** «Oldin ham ariza bergan»: shu mahsulot bo'yicha 30 kun ichidagi avvalgi lid (9-qoida). */
export function duplicateCandidate(card: Pick<LeadCard, 'id' | 'product' | 'previousLeads' | 'createdAt'>) {
  const created = Date.parse(card.createdAt);
  return card.previousLeads.find((lead) =>
    lead.id !== card.id
    && lead.productName === card.product.name
    && created - Date.parse(lead.createdAt) <= DUPLICATE_WINDOW_DAYS * 24 * 60 * MINUTE) ?? null;
}

/** Suhbat skripti offer sozlamasidan bitta matn bo'lib keladi — qatorlar raqamsiz qadamlar. */
export function scriptSteps(script: string | null): string[] {
  if (!script) return [];
  return script
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}
