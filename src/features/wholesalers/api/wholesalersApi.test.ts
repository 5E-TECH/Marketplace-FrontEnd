import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMockDb } from '../../../mocks/db';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { getApiErrorFields } from '../../../shared/api/apiError';
import { httpClient } from '../../../shared/api/httpClient';
import { cabinetState, hasContract, productBlock, validateWholesaler, wholesalerInput } from '../lib/wholesalerRules';
import type { WholesalerInput } from '../model/wholesalerTypes';
import { createWholesaler, getAllWholesalers, getWholesaler, getWholesalerAttention, updateWholesaler, uploadWholesalerContract } from './wholesalersApi';

/** FE-25: optovik (BE-07, OPT-1) — mock orqali TC3, TC4 va forma qoidalari. */
const as = (role: string) => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole(role as never))}`;
};

async function rejected(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('So‘rov rad etilishi kerak edi');
}

const input = (overrides: Partial<WholesalerInput> = {}): WholesalerInput => ({
  ...wholesalerInput(),
  name: 'Gadget Trade MChJ',
  tin: '305 123 456',
  directorName: 'Karimov Akmal',
  phone: '+998 90 123 45 67',
  bankName: 'Kapitalbank',
  bankMfo: '01158',
  bankAccount: '2020 8000 9001 2345 6001',
  ...overrides,
});

describe('FE-25 optoviklar + MSW', () => {
  beforeEach(() => resetMockDb());
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('TC4: optovik saqlangach karta qayta ochilsa STIR va bank rekvizitlari saqlangan', async () => {
    as('ADMIN');
    const created = await createWholesaler(input({ contractNumber: 'K-2027/030', contractDate: '2027-01-12' }));
    expect(created.status).toBe('ACTIVE');
    const reopened = await getWholesaler(created.id);
    expect(reopened).toMatchObject({ tin: '305123456', bankName: 'Kapitalbank', bankMfo: '01158', bankAccount: '20208000900123456001', phone: '+998901234567', directorName: 'Karimov Akmal' });
    expect(hasContract(reopened)).toBe(true);
  });

  it('TC3: shartnomasiz optovik saqlanadi, lekin mahsulot qo‘shish yopiq; skan yuklangach ochiladi', async () => {
    as('ADMIN');
    const created = await createWholesaler(input());
    expect(productBlock(created)).toBe('CONTRACT');
    const signed = await uploadWholesalerContract({ id: created.id, file: new File(['%PDF'], 'shartnoma.pdf', { type: 'application/pdf' }), contractNumber: 'K-2027/031', contractDate: '2027-01-12' });
    expect(productBlock(signed)).toBeNull();
    // Fayl nomi jsdom → node yo'lida «blob» bo'ladi; brauzerdagi nomni e2e tekshiradi.
    expect(signed.contractFile).toMatchObject({ uploadedBy: expect.any(String) as string });
  });

  it('STIR takror — 409; noto‘g‘ri format — maydon ostida', async () => {
    as('ADMIN');
    const duplicate = await rejected(createWholesaler(input({ tin: '307418562' })));
    expect((duplicate as { response?: { status?: number } }).response?.status).toBe(409);
    const invalid = await rejected(createWholesaler(input({ bankAccount: '123' })));
    expect(getApiErrorFields(invalid)).toContain('bankAccount');
  });

  it('ro‘yxat: yig‘ma raqamlar ombor bilan bir xil; to‘xtatilgan optovikka mahsulot yopiq', async () => {
    as('ADMIN');
    const list = await getAllWholesalers();
    const namuna = list.find((item) => item.id === '7');
    expect(namuna?.stats?.stock).toEqual({ onHand: 206, available: 191, reserved: 15 });
    expect(namuna && cabinetState(namuna)).toBe('ACTIVE');
    const suspended = await updateWholesaler({ id: '7', changes: { status: 'SUSPENDED' } });
    expect(productBlock(suspended)).toBe('SUSPENDED');
    expect((await getWholesalerAttention()).map((item) => item.kind)).toEqual(expect.arrayContaining(['SHIPMENT_DEFECT', 'OUT_OF_STOCK', 'DEFECT_NOT_RETURNED', 'SETTLEMENT_READY']));
  });

  it('forma: majburiy maydonlar, formatlar va shartnoma raqami bilan sanasi birga', () => {
    expect(validateWholesaler(wholesalerInput())).toMatchObject({ name: 'required', tin: 'required', phone: 'required', bankAccount: 'required' });
    expect(validateWholesaler(input({ tin: '12345' }))).toEqual({ tin: 'format' });
    expect(validateWholesaler(input({ contractNumber: 'K-1' }))).toEqual({ contractDate: 'required' });
    expect(validateWholesaler(input())).toEqual({});
  });
});
