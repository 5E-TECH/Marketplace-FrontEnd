import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { server } from '../../../mocks/node';
import { httpClient } from '../../../shared/api/httpClient';
import { addDays, tashkentDate } from '../../../shared/lib/tashkentTime';
import { createHandoverAct, fetchLabel, getHandoverAct, getPickList, packTask, scanTask } from './fulfillmentApi';

const withToken = (role: Parameters<typeof mockUserByRole>[0]) => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole(role))}`;
};

describe('BE-19 yig‘ish va topshirish + MSW', () => {
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('TC1: boshqa tovar — 409 WRONG_ITEM, posilka o‘zgarmaydi; to‘g‘ri tovar — PICKED, keyin qadoq', async () => {
    withToken('WAREHOUSE');
    // L-1276: Simsiz quloqchinlar (4780012345677); Elektr choynak — boshqa tovar.
    await expect(scanTask({ taskId: '376', code: '4780012345691' })).rejects.toMatchObject({
      response: { status: 409, data: { errorCode: 'WRONG_ITEM', message: 'Boshqa tovar: «4780012345691» bu buyurtmaga tegishli emas' } },
    });
    // Yig'ilmagan posilkani qadoqlab bo'lmaydi.
    await expect(packTask('376')).rejects.toMatchObject({ response: { status: 409 } });
    const before = (await getPickList(tashkentDate())).items.find((item) => item.taskId === '376');
    expect(before).toMatchObject({ status: 'TO_PICK', pickedQty: 0 });

    expect(await scanTask({ taskId: '376', code: '4780012345677' })).toMatchObject({ status: 'PICKED', pickedQty: 1, quantity: 1 });
    await packTask('376');
    const after = (await getPickList(tashkentDate())).items.find((item) => item.taskId === '376');
    expect(after?.status).toBe('PACKED');
  });

  it('TC2: yorliq — PDF (trek va QR), fayl nomi serverdan; Elchi posilkasi yo‘q — 409', async () => {
    withToken('WAREHOUSE');
    const label = await fetchLabel('1188', 'yorliq.pdf');
    expect(label.fileName).toBe('yorliq-L-1188.pdf');
    expect(label.blob.type).toBe('application/pdf');
    server.use(http.get('*/api/v1/warehouse/orders/:id/label', () => HttpResponse.json({ statusCode: 409, message: 'Elchi posilkasi hali yaratilmagan', errorCode: 'CONFLICT' }, { status: 409 })));
    await expect(fetchLabel('1188', 'yorliq.pdf')).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('TC3: akt — skanerlangan QR lar soni; qadoqlanmagan bo‘lsa butun akt 409; takror — o‘sha akt', async () => {
    withToken('WAREHOUSE');
    await expect(createHandoverAct(['QR-1188', 'QR-1276'])).rejects.toMatchObject({ response: { status: 409 } });
    const tokens = ['QR-1188', 'QR-1209', 'QR-1217'];
    const act = await createHandoverAct(tokens);
    expect(act.parcelCount).toBe(tokens.length);
    expect(act.items.map((item) => item.orderNumber)).toEqual(['L-1188', 'L-1209', 'L-1217']);
    expect((await createHandoverAct(tokens)).id).toBe(act.id);
    expect((await getHandoverAct(act.id)).parcelCount).toBe(3);
    // Topshirilganlar ro'yxatdan chiqadi.
    const list = await getPickList(tashkentDate());
    expect(list.items.some((item) => ['1188', '1209', '1217'].includes(item.orderId))).toBe(false);
  });

  it('TC4: 14:00 dan keyin tasdiqlangan — bugungi ro‘yxatda yo‘q, ertangisida bor', async () => {
    withToken('WAREHOUSE');
    const today = tashkentDate();
    const todayList = await getPickList(today);
    expect(todayList.items.map((item) => item.orderNumber)).not.toContain('L-1245');
    const tomorrow = await getPickList(addDays(today, 1));
    expect(tomorrow.items.filter((item) => item.pickDate === addDays(today, 1)).map((item) => item.orderNumber)).toEqual(['L-1232', 'L-1245', 'L-1284']);
  });

  it('eski javob (`lines` yo‘q) — birinchi qator ildiz maydonlaridan; noma’lum holat — xato', async () => {
    withToken('WAREHOUSE');
    const base = { taskId: '1', orderId: '9', orderNumber: 'L-9', pickDate: '2027-01-14', overdue: false, productName: 'Choynak', sku: 'C-1', barcode: '478', quantity: 2, pickedQty: 1, parcel: {} };
    server.use(http.get('*/api/v1/warehouse/pick-list', () => HttpResponse.json({ statusCode: 200, message: 'OK', data: { date: '2027-01-14', items: [{ ...base, status: 'TO_PICK' }], counts: {}, truncated: false } })));
    const list = await getPickList('2027-01-14');
    expect(list.items[0].lines).toEqual([{ productName: 'Choynak', sku: 'C-1', barcode: '478', quantity: 2, pickedQty: 1, cell: null, weightKg: null }]);
    expect(list.items[0].parcel).toEqual({ elchiState: null, shipmentId: null, labelReady: false, error: null, qrCodeToken: null });

    server.use(http.get('*/api/v1/warehouse/pick-list', () => HttpResponse.json({ statusCode: 200, message: 'OK', data: { date: '2027-01-14', items: [{ ...base, status: 'LOST' }], counts: {}, truncated: false } })));
    await expect(getPickList('2027-01-14')).rejects.toThrow('Yig‘ish vazifasi noto‘g‘ri formatda');
  });
});
