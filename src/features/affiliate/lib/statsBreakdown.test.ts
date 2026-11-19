import { describe, expect, it } from 'vitest';
import { earningsPerClick, pageQuality, salesRate } from './statsBreakdown';

describe('salesRate / earningsPerClick (sotuvchi-statistika, «Kesim: Sahifa»)', () => {
  it('sotilish = yetkazilgan / (yetkazilgan + rad etilgan), butun foiz', () => {
    expect(salesRate({ delivered: 14, refused: 6 })).toBe(70);
    expect(salesRate({ delivered: 2, refused: 1 })).toBe(67);
    expect(salesRate({ delivered: 0, refused: 0 })).toBeNull();
  });

  it('EPC = daromad / kliklar (maketdagi 650 000 / 500 = 1 300; 995 000 / 700 = 1 421)', () => {
    expect(earningsPerClick({ clicks: 500, incomeHold: 650_000, incomeAvailable: 0 })).toBe(1300);
    expect(earningsPerClick({ clicks: 700, incomeHold: 302_500, incomeAvailable: 692_500 })).toBe(1421);
    expect(earningsPerClick({ clicks: 0, incomeHold: 0, incomeAvailable: 0 })).toBeNull();
  });
});

describe('pageQuality (TZ 7: 50 lid, yaroqli 60%, tasdiq 25%)', () => {
  it('lid yo‘q', () => {
    expect(pageQuality({ leads: 0, validLeads: 0, confirmed: 0 })).toMatchObject({ state: 'noLeads', validPercent: null, confirmPercent: null });
  });

  it('50 liddan kam — baholanmaydi, nechta qolgani; foizlar ko‘rinadi, lekin «past» deb belgilanmaydi', () => {
    expect(pageQuality({ leads: 40, validLeads: 34, confirmed: 17 })).toEqual({
      state: 'notRated', leads: 40, leadsToRate: 10, validPercent: 85, confirmPercent: 50, validBelow: false, confirmBelow: false,
    });
    expect(pageQuality({ leads: 20, validLeads: 5, confirmed: 0 })).toMatchObject({ state: 'notRated', validBelow: false, confirmBelow: false });
  });

  it('50 liddan keyin chegaradan past — «below», qaysi ko‘rsatkich pastligi bilan', () => {
    expect(pageQuality({ leads: 51, validLeads: 28, confirmed: 10 })).toMatchObject({
      state: 'below', validPercent: 55, confirmPercent: 36, validBelow: true, confirmBelow: false,
    });
    expect(pageQuality({ leads: 60, validLeads: 50, confirmed: 10 })).toMatchObject({ state: 'below', validBelow: false, confirmBelow: true });
  });

  it('chegaradan yuqori — «ok»; chegaraning o‘zi (60% / 25%) o‘tadi', () => {
    expect(pageQuality({ leads: 50, validLeads: 30, confirmed: 8 })).toMatchObject({ state: 'ok', validPercent: 60, confirmPercent: 27 });
    expect(pageQuality({ leads: 100, validLeads: 60, confirmed: 15 })).toMatchObject({ state: 'ok', confirmPercent: 25 });
  });
});
