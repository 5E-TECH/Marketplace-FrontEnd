import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { httpClient } from '../../../shared/api/httpClient';
import { checkMarketPrice, decidePrice, getModerationSummary, getPriceQueue, getProductAudit, getProductPricing, previewMarketPrice, rejectProduct, setProductDeliveryMode } from './adminProductsApi';

const asAdmin = () => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole('ADMIN'))}`;
};

/** FE-13 (admin-narx) TC1–TC4 — BE-09 qoidalari mock orqali; 511 «Bolalar quloqchinlari»: 140 000, 0.3 kg, haq 65 000. */
describe('narx kalkulyatori va tasdiqlash + MSW', () => {
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('narx navbati: qaror kutayotganlar, eskisi oldin; soni summary bilan bir xil', async () => {
    asAdmin();
    const queue = await getPriceQueue();
    expect(queue.map((item) => [item.productId, item.basePrice, item.recommended])).toEqual([
      ['511', 140_000, 262_000], ['512', 100_000, 221_000], ['513', 60_000, 180_000], ['506', 100_000, 221_000],
    ]);
    expect((await getModerationSummary()).pricesPending).toBe(4);
  });

  it('TC1: 230 000 — qizil, saqlanmaydi (400, eng kam narx)', async () => {
    asAdmin();
    const pricing = await getProductPricing({ id: '511', price: 230_000 });
    expect(pricing.evaluation).toMatchObject({ status: 'RED', safeAffiliateFee: null, maxAffiliateFee: 44_226 });
    await expect(decidePrice({ id: '511', price: 230_000, reason: 'sinov' })).rejects.toMatchObject({
      response: { status: 400, data: { details: [{ field: 'price', error: 'Eng kam narx 235828' }] } },
    });
    expect(db.adminProducts.find((product) => product.id === '511')?.approvedPrice).toBeNull();
  });

  it('TC2: 245 000 — to‘q sariq: sababsiz 400, zararsiz haq 58 936; sabab bilan saqlanadi', async () => {
    asAdmin();
    const pricing = await getProductPricing({ id: '511', price: 245_000 });
    expect(pricing.evaluation).toMatchObject({ status: 'ORANGE', safeAffiliateFee: 58_936, platformResult70: -5_821 });
    await expect(decidePrice({ id: '511', price: 245_000 })).rejects.toMatchObject({ response: { status: 400 } });
    // Zararsiz haq bilan — sariq.
    expect((await getProductPricing({ id: '511', price: 245_000, affiliateFee: 58_936 })).evaluation?.status).toBe('YELLOW');
    const saved = await decidePrice({ id: '511', price: 245_000, reason: 'Raqobatchi narxiga moslash' });
    expect(saved).toMatchObject({ approvedPrice: 245_000, priceStatus: 'ORANGE', approvalCurrent: true });
    expect((await getPriceQueue()).map((item) => item.productId)).not.toContain('511');
  });

  it('TC3: 262 000 — yashil, bir so‘rov bilan tasdiq; audit va navbat', async () => {
    asAdmin();
    const pricing = await getProductPricing({ id: '511' });
    expect(pricing.calculation).toMatchObject({ recommended: 262_000, orangeFrom: 235_828, yellowFrom: 251_183 });
    expect(pricing.evaluation).toMatchObject({ status: 'GREEN', price: 262_000, platformResult70: 10_185 });
    expect(pricing.modes?.map((row) => row.customerTotal)).toEqual([291_000, 292_000, 294_000]);
    const saved = await decidePrice({ id: '511', price: 262_000 });
    expect(saved).toMatchObject({ approvedPrice: 262_000, priceStatus: 'GREEN', maxSalePrice: 287_000 });
    const audit = await getProductAudit('511');
    expect(audit.map((entry) => entry.action)).toEqual(['product.create', 'product.basePrice', 'price.recommended', 'price.decision']);
    expect((await getModerationSummary()).pricesPending).toBe(3);
  });

  it('TC4: bozor narxi — oldindan ko‘rish saqlamaydi; 285 000 qimmat (134 369), 299 000 mos (148 099), manba bilan', async () => {
    asAdmin();
    expect(await previewMarketPrice({ id: '511', competitorTotal: 285_000 })).toMatchObject({ verdict: 'QIMMAT', ourTotal: 292_000, maxBasePrice: 134_369 });
    expect((await getProductPricing({ id: '511' })).market).toBeNull();
    const result = await checkMarketPrice({ id: '511', competitorTotal: 299_000, source: 'uzum.uz' });
    expect(result).toMatchObject({ verdict: 'MOS', maxBasePrice: 148_099, source: 'uzum.uz' });
    expect((await getProductPricing({ id: '511' })).market).toMatchObject({ competitorTotal: 299_000, verdict: 'MOS', source: 'uzum.uz' });
  });

  it('yetkazish rejimi mahsulot uchun: alohida — tavsiya 251 000, manba PRODUCT; rad etish navbatdan chiqaradi', async () => {
    asAdmin();
    await setProductDeliveryMode({ id: '511', deliveryMode: 'SEPARATE' });
    const pricing = await getProductPricing({ id: '511' });
    expect(pricing.params).toMatchObject({ deliveryMode: 'SEPARATE', deliveryModeSource: 'PRODUCT' });
    expect(pricing.calculation.recommended).toBe(251_000);
    await rejectProduct({ id: '512', reason: 'Bozor narxidan qimmat' });
    expect((await getPriceQueue()).map((item) => item.productId)).not.toContain('512');
  });
});
