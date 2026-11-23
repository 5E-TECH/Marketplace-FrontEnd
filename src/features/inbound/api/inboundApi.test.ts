import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { mockTokenFor, mockUserByRole } from '../../../mocks/fixtures/users';
import { httpClient } from '../../../shared/api/httpClient';
import { addDays, tashkentDate } from '../../../shared/lib/tashkentTime';
import { declareShipment, getLots, getShipments, getWarehouseStock, readShipment, receiveShipment } from './inboundApi';

const withToken = (role: Parameters<typeof mockUserByRole>[0]) => {
  httpClient.defaults.headers.common.Authorization = `Bearer ${mockTokenFor(mockUserByRole(role))}`;
};

describe('BE-17 postavka: o‘qish', () => {
  it('kelgan (brak bilan) → qabul (yaroqli) va brak; jami — qatorlar yig‘indisi; nomlar ixtiyoriy', () => {
    const shipment = readShipment({
      id: '7', number: 'P-0007', wholesalerId: '15', status: 'DISCREPANCY', expectedAt: '2027-01-14', note: null, declaredBy: '3',
      receivedBy: '5', receivedAt: '2027-01-14T09:40:00.000Z', receiveComment: null, createdAt: '2027-01-12T10:00:00.000Z',
      items: [
        { id: '71', productId: '42', productName: 'Quloqchin', variantId: '420', sku: 'Q-1', barcode: null, declaredQty: 100, receivedQty: 100, defectiveQty: 2, batch: null, expiryDate: null, cell: 'B-02-1' },
        { id: '72', productId: '43', productName: 'Choynak', variantId: '430', sku: 'C-1', barcode: '478', declaredQty: 20, receivedQty: 18, defectiveQty: 0, batch: null, expiryDate: null, cell: 'B-02-2' },
      ],
    });
    expect(shipment.items.map((item) => [item.accepted, item.defect])).toEqual([[98, 2], [18, 0]]);
    expect([shipment.declared, shipment.accepted, shipment.defect]).toEqual([120, 116, 2]);
    expect(shipment.wholesaler).toEqual({ id: '15', name: null });
    expect(shipment.declaredBy).toEqual({ id: '3', name: null, role: null });
  });
});

describe('BE-17 postavka + MSW', () => {
  afterEach(() => {
    delete httpClient.defaults.headers.common.Authorization;
  });

  it('TC1: admin 100 dona e’lon qiladi → omborchi 98 + 2 brak qabul qiladi → «Farq bor», qoldiqqa 98', async () => {
    withToken('ADMIN');
    const created = await declareShipment({ wholesalerId: '7', expectedAt: tashkentDate(), items: [{ productId: '501', quantity: 100 }] });
    expect(created).toMatchObject({ status: 'DECLARED', declared: 100, wholesaler: { id: '7', name: 'Namuna Savdo MChJ' } });
    // Qabul — faqat omborchi va superadmin.
    await expect(receiveShipment({ id: created.id, items: [{ itemId: created.items[0].id, receivedQty: 100, defectiveQty: 2, cell: 'B-02-1' }] }))
      .rejects.toMatchObject({ response: { status: 403 } });

    withToken('WAREHOUSE');
    const before = (await getWarehouseStock()).find((row) => row.variantId === '50101');
    const received = await receiveShipment({ id: created.id, items: [{ itemId: created.items[0].id, receivedQty: 100, defectiveQty: 2, cell: 'B-02-1' }], comment: 'qopqog‘i singan' });
    expect(received).toMatchObject({ status: 'DISCREPANCY', declared: 100, accepted: 98, defect: 2, receiveComment: 'qopqog‘i singan' });
    const after = (await getWarehouseStock()).find((row) => row.variantId === '50101');
    expect((after?.onHand ?? 0) - (before?.onHand ?? 0)).toBe(98);
    // Takroriy yuborish — o'sha natija, qoldiq ikki marta qo'shilmaydi.
    await receiveShipment({ id: created.id, items: [{ itemId: created.items[0].id, receivedQty: 100, defectiveQty: 2, cell: 'B-02-1' }] });
    expect((await getWarehouseStock()).find((row) => row.variantId === '50101')?.onHand).toBe(after?.onHand);
  });

  it('TC4: muddatiga 50 kun qolgan partiya — omborda, lekin «mavjud»ga kirmaydi; 90 kunligi sotuvda', async () => {
    withToken('WAREHOUSE');
    const today = tashkentDate();
    const near = await declareShipment({ wholesalerId: '8', expectedAt: today, items: [{ productId: '511', quantity: 60 }] });
    expect(near.items[0].expiryTracked).toBe(true);
    await receiveShipment({ id: near.id, items: [{ itemId: near.items[0].id, receivedQty: 60, defectiveQty: 0, expiryDate: addDays(today, 50), cell: 'C-03-2' }] });
    const far = await declareShipment({ wholesalerId: '8', expectedAt: today, items: [{ productId: '511', quantity: 140 }] });
    await receiveShipment({ id: far.id, items: [{ itemId: far.items[0].id, receivedQty: 140, defectiveQty: 0, expiryDate: addDays(today, 90), cell: 'C-03-2' }] });

    const vitamin = (await getWarehouseStock()).find((row) => row.variantId === '51101');
    expect(vitamin).toMatchObject({ onHand: 200, blocked: 60, available: 140, cell: 'C-03-2' });
    const lots = await getLots();
    expect(lots.map((lot) => [lot.quantity, lot.blocked, lot.sellableUntil])).toEqual([[60, true, addDays(today, -10)], [140, false, addDays(today, 30)]]);
  });

  it('e’lon qoidalari: boshqa optovik mahsuloti, takror mahsulot; ro‘yxat bitta holat bo‘yicha', async () => {
    withToken('ADMIN');
    await expect(declareShipment({ wholesalerId: '8', expectedAt: tashkentDate(), items: [{ productId: '501', quantity: 1 }] }))
      .rejects.toMatchObject({ response: { status: 400 } });
    await expect(declareShipment({ wholesalerId: '7', expectedAt: tashkentDate(), items: [{ productId: '501', quantity: 1 }, { productId: '501', quantity: 2 }] }))
      .rejects.toMatchObject({ response: { status: 400 } });
    const declared = await getShipments({ page: 1, limit: 100, status: 'DECLARED' });
    expect(declared.items.every((item) => item.status === 'DECLARED')).toBe(true);
    expect(declared.total).toBe(db.inbound.shipments.filter((item) => item.status === 'DECLARED').length);
  });
});
