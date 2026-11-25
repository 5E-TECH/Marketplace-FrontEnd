import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMockDb } from '../../../mocks/db';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { mockStock } from '../../../mocks/handlers/operator';
import { getApiErrorCode, getApiErrorFields } from '../../../shared/api/apiError';
import { httpClient } from '../../../shared/api/httpClient';
import { getAdminLead, getAdminLeads, getLeadFilterOptions, getTransferOperators, reopenLead, transferLead } from '../../adminLeads/api/adminLeadsApi';
import { confirmLeadAddress, submitLeadResult } from '../../operator/api/operatorApi';
import { cancelOrder, getCustomerRequests, getOrder, getOrders, logLabelReprint, recordReturn } from './ordersApi';

/** FE-26: lidlar, buyurtmalar va bekor qilish (BE-18, BE-42) — mock orqali TC1–TC5. */
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

describe('FE-26 lidlar va buyurtmalar + MSW', () => {
  beforeEach(() => resetMockDb());
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('TC1: «Yo‘lda» buyurtmani bekor qilib bo‘lmaydi — 409 INVALID_STATE', async () => {
    as('ADMIN');
    const transit = (await getOrders('ADMIN', { status: 'IN_TRANSIT' })).items[0];
    expect(transit.status).toBe('IN_TRANSIT');
    const error = await rejected(cancelOrder({ role: 'ADMIN', id: transit.id, reason: 'Mijoz kerak emas dedi' }));
    expect(getApiErrorCode(error)).toBe('INVALID_STATE');
  });

  it('TC2: «Tasdiqlandi» — sabab bilan bekor → «Bekor qilindi», band tovar bo‘shadi', async () => {
    as('SUPERVISOR');
    const before = mockStock('501');
    const result = await cancelOrder({ role: 'SUPERVISOR', id: 'O-1266', reason: 'Mijoz qo‘ng‘iroqda bekor qildi' });
    expect(result).toMatchObject({ status: 'CANCELLED', idempotent: false });
    expect(mockStock('501')).toBe(before + 1);
    const order = await getOrder('SUPERVISOR', 'O-1266');
    expect(order.status).toBe('CANCELLED');
    expect(order.cancel).toMatchObject({ by: 'Rustam Q.', reason: 'Mijoz qo‘ng‘iroqda bekor qildi' });
    expect(order.lead?.statusHistory.at(-1)).toMatchObject({ fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', reason: 'Mijoz qo‘ng‘iroqda bekor qildi' });
  });

  it('TC3: sababsiz bekor qilish — 400 `reason`', async () => {
    as('ADMIN');
    expect(getApiErrorFields(await rejected(cancelOrder({ role: 'ADMIN', id: 'O-1266', reason: ' ' })))).toEqual(['reason']);
  });

  it('TC4: sotuvchi va sana filtri — faqat shu sotuvchi lidlari, raqam niqoblangan', async () => {
    as('ADMIN');
    const today = new Date().toISOString().slice(0, 10);
    const page = await getAdminLeads({ affiliateId: 'U-0101', from: today, to: today, limit: 100 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((lead) => lead.affiliateName === 'Sherzod A.')).toBe(true);
    expect(page.items.every((lead) => /\*\*\*/.test(lead.phoneMasked))).toBe(true);
  });

  it('TC5: operator tuzatgan manzil buyurtma kartasida — kim va qachon, mijoz yozgani', async () => {
    as('OPERATOR_LEAD');
    await confirmLeadAddress('L-1284', { regionSoato: '1730', districtSoato: '1730401', addressLine: 'Turkiston ko‘chasi, 27-uy', whereDeliver: 'CENTER' });
    await submitLeadResult('L-1284', { outcome: 'CONFIRMED', quantity: 1 });
    as('ADMIN');
    const lead = await getAdminLead('L-1284');
    expect(lead.status).toBe('CONFIRMED');
    expect(lead.orderId).toBe('O-1284');
    const order = await getOrder('ADMIN', 'O-1284');
    expect(order.customer).toMatchObject({ districtName: 'Farg‘ona shahri', original: { districtName: 'Qo‘qon shahri' }, addressEditedBy: { name: 'Dilnoza R.' } });
    expect(order.customer?.addressConfirmedBy?.name).toBe('Dilnoza R.');
    expect(order.lead?.customerPhone).toBeTruthy();
    as('SUPERVISOR');
    expect((await getOrder('SUPERVISOR', 'O-1284')).lead?.customerPhone).toBeNull();
  });

  it('lidlar: tablar sonlari, «Tekshiruvda» faqat adminga; qayta ochish va o‘tkazish', async () => {
    as('ADMIN');
    const admin = await getAdminLeads({ tab: 'ALL', limit: 100 });
    expect(admin.counts?.REVIEW).toBe(7);
    expect(admin.review).toMatchObject({ count: 7, streamCode: 'h2q7vz' });
    // BE-35: faqat «Rad etildi»; lid «Yangi» bo'lib qaytadi (urinishlar 0, operatorsiz).
    await reopenLead({ id: 'L-1270', reason: 'Mijoz qayta qo‘ng‘iroq qildi' });
    const reopened = (await getAdminLeads({ search: 'L-1270' })).items[0];
    expect(reopened).toMatchObject({ status: 'NEW', attemptsCount: 0, operatorName: null });
    expect(getApiErrorCode(await rejected(reopenLead({ id: 'L-1268', reason: 'Yaroqsiz edi' })))).toBe('LEAD_NOT_REJECTED');
    expect(getApiErrorFields(await rejected(reopenLead({ id: 'L-1019', reason: ' ' })))).toEqual(['reason']);
    as('SUPERVISOR');
    const supervisor = await getAdminLeads({ tab: 'REVIEW', limit: 100 });
    expect(supervisor.items).toHaveLength(0);
    // BE-42: faqat «Ishda» operatorga; vaqti kelmagan qo'ng'iroq yangi operatorda shu vaqt bilan qoladi (taklif).
    expect(getApiErrorFields(await rejected(transferLead({ id: 'L-1279', operatorId: '' })))).toEqual(['operatorId']);
    expect(getApiErrorCode(await rejected(transferLead({ id: 'L-1279', operatorId: 'U-0031' })))).toBe('OPERATOR_ON_BREAK');
    expect(getApiErrorCode(await rejected(transferLead({ id: 'L-1279', operatorId: 'U-0034' })))).toBe('OPERATOR_OFFLINE');
    expect(getApiErrorCode(await rejected(transferLead({ id: 'L-1268', operatorId: 'U-0033' })))).toBe('LEAD_NOT_TRANSFERABLE');
    await transferLead({ id: 'L-1279', operatorId: 'U-0033' });
    expect((await getAdminLeads({ search: 'L-1279' })).items[0]).toMatchObject({ operatorName: 'Umida S.', status: 'CALLBACK' });
    const umida = (await getTransferOperators()).find((item) => item.id === 'U-0033');
    expect(umida).toMatchObject({ state: 'ONLINE', activeBookings: 1, scheduledCalls: 2, maxBookings: 5 });
  });

  it('lidlar: filtr variantlari (nazoratchiga ham), bitta holatli tab backend `status` bilan', async () => {
    as('SUPERVISOR');
    const options = await getLeadFilterOptions(false);
    expect(options.operators.map((item) => item.name)).toContain('Umida S.');
    expect(options.affiliates.map((item) => item.name)).toContain('Sherzod A.');
    as('ADMIN');
    const rejectedTab = await getAdminLeads({ tab: 'REJECTED', limit: 100 });
    expect(rejectedTab.items.length).toBeGreaterThan(0);
    expect(rejectedTab.items.every((lead) => lead.status === 'REJECTED')).toBe(true);
  });

  it('operator — faqat o‘zi tasdiqlagan buyurtmalar; nazoratchi — mijoz so‘rovlari', async () => {
    as('OPERATOR_LEAD');
    const mine = await getOrders('OPERATOR', {});
    expect(mine.items.every((order) => order.confirmedBy?.name === 'Dilnoza R.')).toBe(true);
    expect(mine.items.some((order) => order.leadId === 'L-1250')).toBe(false);
    as('SUPERVISOR');
    const requests = await getCustomerRequests('OPEN');
    expect(requests.map((item) => item.kind)).toEqual(['CANCEL', 'CHANGE_ADDRESS', 'CANCEL']);
  });
  it('yorliqni qayta chop etish: sababsiz — maydon xatosi; sabab bilan — karta «chop etilgan» yangilanadi', async () => {
    as('ADMIN');
    expect(getApiErrorFields(await rejected(logLabelReprint({ id: 'O-1235', reason: ' ' })))).toContain('reason');
    await logLabelReprint({ id: 'O-1235', reason: 'Yorliq qadoqda yirtilgan' });
    const card = await getOrder('ADMIN', 'O-1235');
    expect(card.parcel?.label?.count).toBe(2);
    expect(getApiErrorCode(await rejected(logLabelReprint({ id: 'O-1266', reason: 'Qayta' })))).toBe('INVALID_STATE');
  });

  it('qaytarish so‘rovi: faqat «Yetkazildi»; OTHER sababida izoh majburiy; holat — «Qaytarish so‘raldi»', async () => {
    as('ADMIN');
    const items = [{ productId: '1', quantity: 1 }];
    expect(getApiErrorFields(await rejected(recordReturn({ id: 'O-1183', reason: 'OTHER', items })))).toContain('comment');
    expect(getApiErrorCode(await rejected(recordReturn({ id: 'O-1266', reason: 'OTHER', comment: 'Rangi', items })))).toBe('INVALID_STATE');
    await recordReturn({ id: 'O-1183', reason: 'OTHER', comment: 'Rangi yoqmadi', items });
    const card = await getOrder('ADMIN', 'O-1183');
    expect(card.status).toBe('RETURN_REQUESTED');
    expect(card.returnRequest?.reason).toBe('Rangi yoqmadi');
  });
});
