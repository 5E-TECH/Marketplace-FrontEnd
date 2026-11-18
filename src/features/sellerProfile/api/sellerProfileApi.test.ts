import { afterEach, describe, expect, it } from 'vitest';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { httpClient } from '../../../shared/api/httpClient';
import { getSellerProfile, updateSellerName } from './sellerProfileApi';

const signInAs = (role: Parameters<typeof mockUserByRole>[0]) => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole(role))}`;
};

describe('sotuvchi profili (FE-04 taklifi) — mock bilan', () => {
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('tayyor sotuvchi: JShShIR tasdiqlangan, karta, oferta 1.0 qabul qilingan', async () => {
    signInAs('AFFILIATE');
    const profile = await getSellerProfile();
    expect(profile).toMatchObject({ firstName: 'Jasur', lastName: 'Toshmatov', selfEmployed: { status: 'VERIFIED', pinflLast4: '4018' }, card: { last4: '7731' } });
    expect(profile.agreements.map((item) => [item.type, item.version, item.current])).toEqual([['affiliate-offer', '1.0', true], ['personal-data-consent', '1.0', true]]);
  });

  it('ism o‘zgarsa tasdiqlangan maqom qayta tekshiruvga tushadi', async () => {
    signInAs('AFFILIATE');
    const profile = await updateSellerName({ firstName: 'Jasur', lastName: 'Tursunov' });
    expect(profile.lastName).toBe('Tursunov');
    expect(profile.selfEmployed.status).toBe('PENDING');
    await expect(updateSellerName({ firstName: ' ', lastName: 'X' })).rejects.toMatchObject({ response: { status: 400 } });
  });

  // JShShIR yuborish (multipart) — jsdom'da FormData tanasi MSW'ga yetmaydi; e2e da tekshiriladi
  // (tests/e2e/seller-auth.spec.ts «profil: … JShShIR tekshiruvga yuboriladi»).

  it('xodim (operator) sotuvchi profilini ocholmaydi', async () => {
    signInAs('OPERATOR_LEAD');
    await expect(getSellerProfile()).rejects.toMatchObject({ response: { status: 403 } });
  });
});
