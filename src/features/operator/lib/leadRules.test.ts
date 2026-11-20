import { describe, expect, it } from 'vitest';
import {
  clampToCallWindow,
  closesAsNoContact,
  duplicateCandidate,
  isOutsideCallWindow,
  leadKind,
  nextRetryAt,
  noContactDeadline,
  scriptSteps,
  tashkentMoment,
  tashkentParts,
} from './leadRules';

const at = (date: string, time: string) => tashkentMoment(date, time);
const parts = (value: number) => tashkentParts(value);

describe('lid qoidalari (TZ 5-bo‘lim)', () => {
  it('3-qoida: 09:00 gacha — shu kuni 09:00, 21:00 va keyin — ertasi kuni 09:00', () => {
    expect(parts(clampToCallWindow(at('2027-01-14', '07:30')))).toEqual({ date: '2027-01-14', time: '09:00' });
    expect(parts(clampToCallWindow(at('2027-01-14', '21:00')))).toEqual({ date: '2027-01-15', time: '09:00' });
    expect(parts(clampToCallWindow(at('2027-01-14', '22:00')))).toEqual({ date: '2027-01-15', time: '09:00' });
    expect(clampToCallWindow(at('2027-01-14', '14:37'))).toBe(at('2027-01-14', '14:37'));
    expect(isOutsideCallWindow(at('2027-01-14', '20:59'))).toBe(false);
    expect(isOutsideCallWindow(at('2027-01-14', '21:05'))).toBe(true);
  });

  it('1-qoida: 15 daq → 1 soat → 3 soat → ertasi kuni 10:00 → kuniga bir', () => {
    const now = at('2027-01-14', '14:37');
    expect(parts(nextRetryAt(1, now))).toEqual({ date: '2027-01-14', time: '14:52' });
    expect(parts(nextRetryAt(2, now))).toEqual({ date: '2027-01-14', time: '15:37' });
    expect(parts(nextRetryAt(3, now))).toEqual({ date: '2027-01-14', time: '17:37' });
    expect(parts(nextRetryAt(4, now))).toEqual({ date: '2027-01-15', time: '10:00' });
    expect(parts(nextRetryAt(5, now))).toEqual({ date: '2027-01-15', time: '10:00' });
  });

  it('1 + 3-qoida: 20:50 dagi javobsiz qo‘ng‘iroq → ertasi kuni 09:00 (BE-13 TC3)', () => {
    expect(parts(nextRetryAt(1, at('2027-01-14', '20:50')))).toEqual({ date: '2027-01-15', time: '09:00' });
    expect(parts(nextRetryAt(3, at('2027-01-14', '19:00')))).toEqual({ date: '2027-01-15', time: '09:00' });
  });

  it('2-qoida: 6 urinish yoki lid kelganidan 3 kun — «Aloqa bo‘lmadi»', () => {
    const created = at('2027-01-14', '14:32');
    expect(closesAsNoContact(5, created, at('2027-01-15', '10:00'))).toBe(false);
    expect(closesAsNoContact(6, created, at('2027-01-15', '10:00'))).toBe(true);
    expect(closesAsNoContact(2, created, at('2027-01-17', '14:31'))).toBe(false);
    expect(closesAsNoContact(2, created, at('2027-01-17', '14:32'))).toBe(true);
    expect(parts(noContactDeadline(created))).toEqual({ date: '2027-01-17', time: '14:32' });
  });

  it('lid turi: yangi, rejalashtirilgan, qayta urinish, oxirgi urinish', () => {
    expect(leadKind({ status: 'BOOKED', attemptsCount: 0, nextAttemptAt: null })).toBe('new');
    expect(leadKind({ status: 'CALLBACK', attemptsCount: 1, nextAttemptAt: '2027-01-14T10:20:00.000Z' })).toBe('scheduled');
    expect(leadKind({ status: 'BOOKED', attemptsCount: 2, nextAttemptAt: null })).toBe('retry');
    expect(leadKind({ status: 'BOOKED', attemptsCount: 5, nextAttemptAt: null })).toBe('last');
  });

  it('9-qoida: dublikat — shu mahsulot, 30 kun ichida; boshqa mahsulot dublikat emas', () => {
    const card = {
      id: 'L-1287',
      product: { id: '501', name: 'Simsiz quloqchinlar', salePrice: 262_000 },
      createdAt: '2027-01-14T09:36:00.000Z',
      previousLeads: [
        { id: 'L-0736', createdAt: '2027-01-05T06:00:00.000Z', productName: 'Elektr choynak', status: 'REJECTED' as const, orderId: null, orderStatus: null, rejectReason: 'TOO_EXPENSIVE' as const },
        { id: 'L-1203', createdAt: '2027-01-12T06:00:00.000Z', productName: 'Simsiz quloqchinlar', status: 'CALLBACK' as const, orderId: null, orderStatus: null, rejectReason: null },
      ],
    };
    expect(duplicateCandidate(card)?.id).toBe('L-1203');
    expect(duplicateCandidate({ ...card, previousLeads: [card.previousLeads[0]] })).toBeNull();
    const old = { ...card.previousLeads[1], createdAt: '2026-12-01T06:00:00.000Z' };
    expect(duplicateCandidate({ ...card, previousLeads: [old] })).toBeNull();
  });

  it('suhbat skripti qatorlari raqamsiz qadamlarga bo‘linadi', () => {
    expect(scriptSteps('1. Salom!\n2) Buyurtma?\n\n  Narx 262 000 so‘m  ')).toEqual(['Salom!', 'Buyurtma?', 'Narx 262 000 so‘m']);
    expect(scriptSteps(null)).toEqual([]);
  });
});
