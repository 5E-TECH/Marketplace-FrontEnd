import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { server } from '../../../mocks/node';
import { httpClient } from '../../../shared/api/httpClient';
import { getAffiliateStats } from './affiliateApi';

const withToken = (role: Parameters<typeof mockUserByRole>[0]) => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole(role))}`;
};

describe('affiliate API + MSW (dev bilan bir xil mock)', () => {
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('kunlar bo‘yicha statistika va jami', async () => {
    withToken('AFFILIATE');
    const stats = await getAffiliateStats('2027-01-08', '2027-01-14');
    expect(stats.rows.map((row) => row.key)).toEqual(['2027-01-08', '2027-01-09', '2027-01-10', '2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14']);
    expect(stats.totals.clicks).toBe(stats.rows.reduce((sum, row) => sum + row.clicks, 0));
  });

  it('boshqa rol 403 oladi', async () => {
    withToken('OPERATOR_LEAD');
    await expect(getAffiliateStats('2027-01-08', '2027-01-14')).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('kutilmagan shakl — tushunarli xato, «undefined» bilan chizilmaydi', async () => {
    withToken('AFFILIATE');
    server.use(http.get('*/api/v1/affiliate/stats', () => HttpResponse.json({ data: { rows: [] } })));
    await expect(getAffiliateStats('2027-01-08', '2027-01-14')).rejects.toThrow('Server javobi kutilgan formatda emas');
  });
});
