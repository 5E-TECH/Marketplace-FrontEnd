import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { staffTranslations } from '../../../shared/i18n/staffTranslations';
import type { OperatorLive } from '../model/operatorTypes';
import type { UserAccount } from '../model/staffTypes';
import { bookingsText, presenceLine, supervisorPresence } from './operatorFormat';

/** «Hozir» ustuni matni (admin-operatorlar-jamoasi): Toshkent vaqti 14:37 (09:37Z) da. */
const NOW = Date.parse('2027-01-14T09:37:00.000Z');
const t = (key: TranslationKey, params: Record<string, string | number> = {}) => Object.entries(params)
  .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), (staffTranslations.uz as Record<string, string>)[key] ?? key);
const user = (lastLoginAt: string | null): UserAccount => ({
  id: 'U-1', code: 'U-1', name: 'Marjona Ismoilova', firstName: 'Marjona', lastName: 'Ismoilova', phone: '+998901112233', role: 'OPERATOR_LEAD', roleRaw: 'OPERATOR_LEAD',
  isActive: true, isBlocked: false, totpEnabledAt: null, createdAt: '2026-11-01T08:00:00.000Z', lastLoginAt,
});
const live = (patch: Partial<OperatorLive>): OperatorLive => ({ operatorId: 'U-1', state: 'ONLINE', since: null, activeBookings: 1, maxBookings: 5, scheduledCalls: 3, activity: null, ...patch });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('operator holati matni', () => {
  it('onlayn — qachondan va suhbat; tanaffus — necha daqiqa; oflayn — qachondan yoki «bugun kirmagan»', () => {
    expect(presenceLine(user(null), live({ since: '2027-01-14T08:15:00.000Z', activity: { kind: 'IN_CALL', leadId: 'L-1284', since: '2027-01-14T09:35:48.000Z' } }), t, NOW))
      .toBe('13:15 dan · suhbatda 01:12 · L-1284');
    expect(presenceLine(user(null), live({ state: 'ONLINE', activity: { kind: 'RINGING', leadId: 'L-1254', since: null } }), t, NOW)).toBe('jiringlamoqda · L-1254');
    expect(presenceLine(user(null), live({ state: 'BREAK', since: '2027-01-14T09:15:00.000Z' }), t, NOW)).toBe('14:15 dan · 22 daq');
    expect(presenceLine(user('2027-01-14T04:00:00.000Z'), live({ state: 'OFFLINE', since: '2027-01-14T09:20:00.000Z' }), t, NOW)).toBe('14:20 dan');
    expect(presenceLine(user('2027-01-13T13:00:00.000Z'), null, t, NOW)).toBe('bugun kirmagan');
    expect(presenceLine(user('2027-01-14T04:00:00.000Z'), null, t, NOW)).toBeNull();
  });

  it('bronlar va nazoratchi', () => {
    expect(bookingsText(live({}))).toBe('1/5 · +3');
    expect(bookingsText(live({ scheduledCalls: 0 }))).toBe('1/5');
    expect(supervisorPresence(user('2027-01-14T03:55:00.000Z'), t)).toBe('bugun 08:55 dan tizimda');
    expect(supervisorPresence(user(null), t)).toBe('hali kirmagan');
  });
});
