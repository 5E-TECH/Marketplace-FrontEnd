import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMockDb } from '../../../mocks/db';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { bookMockLead } from '../../../mocks/handlers/operator';
import { getApiErrorCode, getApiErrorFields } from '../../../shared/api/apiError';
import { httpClient } from '../../../shared/api/httpClient';
import { confirmLeadAddress, getLeadCard, getLeadProduct, quoteLeadPrice, submitLeadResult } from './operatorApi';

/**
 * FE-09: buyurtma formasi API si (BE-13, BE-38, BE-09) — mock backend formulasi bilan. Aziza (L-1284):
 * Simsiz quloqchinlar 262 000, 0.3 kg, qisman rejim, Farg‘ona — Qo‘qon shahri.
 */
const AZIZA = 'L-1284';
const fergana = { regionSoato: '1730', districtSoato: '1730412', addressLine: 'Turkiston ko‘chasi, 27-uy' };

async function rejected(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('So‘rov rad etilishi kerak edi');
}

describe('FE-09 buyurtma formasi + MSW', () => {
  beforeEach(() => {
    resetMockDb();
    httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole('OPERATOR_LEAD'))}`;
  });
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('TC1: qisman rejim — 262 000 + 30 000 = 292 000, ikkala yetkazish narxi', async () => {
    const card = await getLeadCard(AZIZA);
    expect(card.price).toMatchObject({ subtotal: 262_000, deliveryFee: 30_000, totalAmount: 292_000, deliveryMode: 'PARTIAL', weightGrams: 300, deliveryOptions: { CENTER: 30_000, ADDRESS: 50_000 } });
  });

  it('TC2: eshikkacha — yetkazish 50 000, jami 312 000', async () => {
    expect(await quoteLeadPrice(AZIZA, 1, 'ADDRESS')).toMatchObject({ deliveryFee: 50_000, totalAmount: 312_000 });
  });

  it('TC3: 14 dona = 4.2 kg — yetkazish qayta hisoblandi: 30 000 + 2 × 4 000 = 38 000', async () => {
    const price = await quoteLeadPrice(AZIZA, 14, 'CENTER');
    expect(price).toMatchObject({ weightGrams: 4_200, deliveryFee: 38_000, subtotal: 3_668_000, deliveryFormula: { base: 30_000, extraKg: 2, perExtraKg: 4_000, baseWeightGrams: 3_000 } });
  });

  it('alohida rejim, og‘ir tovar: 5.6 kg → 40 000 + 3 × 4 000 = 52 000; 2 dona 11.2 kg → 76 000', async () => {
    bookMockLead('L-1244');
    expect((await getLeadCard('L-1244')).price).toMatchObject({ deliveryMode: 'SEPARATE', deliveryFee: 52_000, deliveryFormula: { base: 40_000, extraKg: 3 } });
    expect(await quoteLeadPrice('L-1244', 2, 'CENTER')).toMatchObject({ weightGrams: 11_200, deliveryFee: 76_000, totalAmount: 904_000, deliveryFormula: { base: 40_000, extraKg: 9 } });
  });

  it('bepul rejim — yetkazish 0; og‘irligi yo‘q tovar — summa hisoblanmaydi (400)', async () => {
    bookMockLead('L-1246');
    expect(await quoteLeadPrice('L-1246', 1, 'ADDRESS')).toMatchObject({ deliveryFee: 0, totalAmount: 294_000, deliveryFormula: null });
    bookMockLead('L-1248');
    expect((await getLeadCard('L-1248')).price).toBeNull();
    expect(getApiErrorCode(await rejected(quoteLeadPrice('L-1248', 1, 'CENTER')))).toBe('VALIDATION_ERROR');
  });

  it('TC4: manzil tasdiqlanmagan — natija 400 ADDRESS_NOT_CONFIRMED', async () => {
    const error = await rejected(submitLeadResult(AZIZA, { outcome: 'CONFIRMED', quantity: 1 }));
    expect(getApiErrorCode(error)).toBe('ADDRESS_NOT_CONFIRMED');
  });

  it('TC5: operator tumanni tuzatdi — tarixda eski va yangi tuman, «Operator tuzatdi»; keyin tasdiq', async () => {
    const card = await confirmLeadAddress(AZIZA, { ...fergana, districtSoato: '1730401', whereDeliver: 'CENTER' });
    expect(card.address).toMatchObject({ districtName: 'Farg‘ona shahri', editedByOperator: true });
    expect(card.address?.confirmedAt).toBeTruthy();
    const edit = card.history.find((entry) => entry.changes?.length);
    expect(edit?.changes).toEqual([{ field: 'district', from: 'Qo‘qon shahri', to: 'Farg‘ona shahri' }]);
    expect(card.callScript).toContain('Manzilni tasdiqlaymiz: Farg‘ona viloyati, Farg‘ona shahri, Turkiston ko‘chasi, 27-uy, yetkazish markazgacha');
    expect(await submitLeadResult(AZIZA, { outcome: 'CONFIRMED', quantity: 1 })).toMatchObject({ status: 'CONFIRMED', stockAvailable: 119 });
  });

  it('o‘zgarishsiz tasdiq — tuzatish yozuvi yo‘q, «Operator tuzatdi» belgisi yo‘q', async () => {
    const card = await confirmLeadAddress(AZIZA, { ...fergana, whereDeliver: 'CENTER' });
    expect(card.address?.editedByOperator).toBe(false);
    expect(card.history.filter((entry) => entry.changes?.length)).toHaveLength(0);
  });

  it('maydon xatolari: tuman boshqa viloyatniki, ko‘cha bo‘sh, eshikkacha bormaydigan tuman — 400 `details[].field`', async () => {
    expect(getApiErrorFields(await rejected(confirmLeadAddress(AZIZA, { ...fergana, districtSoato: '1726266', whereDeliver: 'CENTER' })))).toEqual(['districtSoato']);
    expect(getApiErrorFields(await rejected(confirmLeadAddress(AZIZA, { ...fergana, addressLine: '  ', whereDeliver: 'CENTER' })))).toEqual(['addressLine']);
    expect(getApiErrorFields(await rejected(confirmLeadAddress(AZIZA, { ...fergana, districtSoato: '1730209', whereDeliver: 'ADDRESS' })))).toEqual(['whereDeliver']);
  });

  it('qoldiq: 2 dona so‘ralgan, 1 bor — 409; 1 dona — oxirgi dona boshqa buyurtmaga band bo‘ldi (409), qoldiq 0', async () => {
    bookMockLead('L-1233');
    const card = await getLeadCard('L-1233');
    expect(card.quantity).toBe(2);
    expect((await getLeadProduct('L-1233')).available).toBe(1);
    await confirmLeadAddress('L-1233', { regionSoato: '1718', districtSoato: '1718401', addressLine: 'Registon ko‘chasi, 5-uy', whereDeliver: 'CENTER' });
    expect(getApiErrorCode(await rejected(submitLeadResult('L-1233', { outcome: 'CONFIRMED', quantity: 2 })))).toBe('OUT_OF_STOCK');
    expect(getApiErrorCode(await rejected(submitLeadResult('L-1233', { outcome: 'CONFIRMED', quantity: 1 })))).toBe('OUT_OF_STOCK');
    expect((await getLeadProduct('L-1233')).available).toBe(0);
    expect((await getLeadCard('L-1233')).status).toBe('BOOKED');
  });

  it('qora ro‘yxat — yetkazish puli oldindan (summa serverdan)', async () => {
    bookMockLead('L-1241');
    const card = await getLeadCard('L-1241');
    expect(card.blacklistRejections).toBe(2);
    expect(card.price?.prepayment).toMatchObject({ amount: 30_000 });
  });
});
