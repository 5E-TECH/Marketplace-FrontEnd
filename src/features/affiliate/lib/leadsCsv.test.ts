import { describe, expect, it } from 'vitest';
import { translations } from '../../../shared/i18n/translations';
import type { TranslationKey } from '../../../shared/i18n/translations';
import type { AffiliateLead } from '../api/affiliateApi';
import { buildLeadsCsv, DEFAULT_LEAD_CSV_COLUMNS, LEAD_CSV_COLUMNS, maskPhone } from './leadsCsv';

const t = (key: TranslationKey) => translations.uz[key];
const lead = (patch: Partial<AffiliateLead>): AffiliateLead => ({
  id: 'L-1272', createdAt: '2027-01-14T08:20:00.000Z', streamCode: 'k7m2qa', sub1: 'fb-reels-2', sub2: null, sub3: null, sub4: null, sub5: null,
  phoneLast4: '****2087', status: 'CALLBACK', orderStatus: null, commission: null, commissionState: null, ...patch,
} as AffiliateLead);
const period = { from: '2027-01-08', to: '2027-01-14' };
const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n');

describe('buildLeadsCsv (hujjat-statistika-csv, 2-fayl; FE-06 TC2)', () => {
  it('ustunlar va qatorlar maketdagidek: Keldi (Toshkent vaqti), mijoz ****4567, bo‘sh maydon — bo‘sh katak', () => {
    const { csv, fileName, rows } = buildLeadsCsv(
      [
        lead({ id: 'L-1183', createdAt: '2027-01-13T07:25:00.000Z', streamCode: 'k7m2qa', sub1: 'fb-reels-1', phoneLast4: '****6619', status: 'CONFIRMED', orderStatus: 'DELIVERED', commission: 65000, commissionState: 'HOLD' }),
        lead({}),
        lead({ id: 'L-1265', createdAt: '2027-01-14T07:10:00.000Z', sub1: null, phoneLast4: '****7708', status: 'MERGED', commissionState: 'NONE' }),
      ],
      DEFAULT_LEAD_CSV_COLUMNS,
      period,
      t,
    );
    const out = lines(csv);
    expect(out[0]).toBe('Keldi;Lid;Sahifa;sub1;Mijoz;Lid holati;Buyurtma;Haq;Haq holati');
    expect(out[1]).toBe('14.01.2027 13:20;L-1272;k7m2qa;fb-reels-2;****2087;Qayta qo‘ng‘iroq;;;');
    expect(out[2]).toBe('14.01.2027 12:10;L-1265;k7m2qa;;****7708;Dublikat;;;Yozilmaydi');
    expect(out[3]).toBe('13.01.2027 12:25;L-1183;k7m2qa;fb-reels-1;****6619;Tasdiqlangan;Yetkazildi;65000;Ushlab turilgan');
    expect(fileName).toBe('lidlar_08.01-14.01.2027.csv');
    expect(rows).toBe(3);
  });

  it('TC2: to‘liq raqam kelib qolsa ham faylga faqat oxirgi 4 raqam tushadi', () => {
    const { csv } = buildLeadsCsv([lead({ phoneLast4: '+998 90 123 45 67' })], LEAD_CSV_COLUMNS, period, t);
    expect(csv).toContain('****4567');
    expect(csv).not.toMatch(/998|90 ?123|1234567/);
    expect(maskPhone('****4567')).toBe('****4567');
    expect(maskPhone(null)).toBe('');
  });

  it('tanlangan ustunlargina; sub2–sub5 to‘rt ustun, «Haq» — ikki ustun; noma’lum buyurtma holati o‘zicha', () => {
    const { csv } = buildLeadsCsv([lead({ sub2: 'b', orderStatus: 'SOMETHING_NEW', commission: 1000, commissionState: 'AVAILABLE' })], ['lead', 'sub25', 'order', 'commission'], period, t);
    const out = lines(csv);
    expect(out[0]).toBe('Lid;sub2;sub3;sub4;sub5;Buyurtma;Haq;Haq holati');
    expect(out[1]).toBe('L-1272;b;;;;SOMETHING_NEW;1000;Mavjud');
  });
});
