import { describe, expect, it } from 'vitest';
import type { PickLine, PickTask } from '../model/fulfillmentTypes';
import { currentPickTask, goodsOf, lineByCode, neededLine, pickSheet, taskBadge, waveStats, weightOf } from './pickRules';

const line = (barcode: string, cell: string | null, quantity = 1, pickedQty = 0, extra: Partial<PickLine> = {}): PickLine => ({
  productName: `Tovar ${barcode}`, sku: null, barcode, quantity, pickedQty, cell, weightKg: 0.5, ...extra,
});
const task = (order: number, status: PickTask['status'], lines: PickLine[], extra: Partial<PickTask> = {}): PickTask => ({
  taskId: String(order - 900), orderId: String(order), orderNumber: `L-${order}`, status, pickDate: '2027-01-14', overdue: false,
  quantity: lines.reduce((sum, item) => sum + item.quantity, 0), pickedQty: lines.reduce((sum, item) => sum + item.pickedQty, 0), lines,
  parcel: { elchiState: 'CREATED', shipmentId: null, labelReady: false, error: null, qrCodeToken: null },
  customerName: null, regionName: null, districtName: null, deliveryMode: null, codAmount: null, confirmedAt: null, packedAt: null, ...extra,
});

describe('yig‘ish qoidalari', () => {
  it('holat: boshlangan TO_PICK — «Yig‘ilmoqda»; joriy — yig‘ilayotgani, bo‘lmasa navbatdagi birinchisi', () => {
    const queued = task(1240, 'TO_PICK', [line('111', 'B-02-1')]);
    const started = task(1244, 'TO_PICK', [line('222', 'B-02-2', 2, 1)]);
    expect(taskBadge(queued)).toBe('TO_PICK');
    expect(taskBadge(started)).toBe('PICKING');
    expect(currentPickTask([queued, started])).toBe(started);
    expect(currentPickTask([queued])).toBe(queued);
    expect(neededLine(started)?.barcode).toBe('222');
  });

  it('to‘lqin: qadoqlangan / jami; joriy va qadoq kutayotgan — «yig‘ilmoqda»', () => {
    const items = [
      task(1188, 'PACKED', [line('111', 'A-01-3', 1, 1)]),
      task(1209, 'PICKED', [line('111', 'A-01-3', 1, 1)]),
      task(1240, 'TO_PICK', [line('111', 'A-01-3')]),
      task(1244, 'TO_PICK', [line('222', 'B-02-2')]),
    ];
    expect(waveStats(items)).toMatchObject({ total: 4, packed: 1, picking: 2, queued: 1, current: items[2] });
    // Ertangi to'lqin: joriy posilka yo'q, hammasi navbatda.
    expect(waveStats(items.slice(2), { active: false })).toMatchObject({ total: 2, packed: 0, picking: 0, queued: 2, current: null });
  });

  it('kod bo‘yicha tovar, og‘irlik va qisqa tarkib', () => {
    const items = [task(1240, 'TO_PICK', [line('111', 'B-02-1', 2), line('222', 'B-02-2', 1, 0, { weightKg: 1.2 })])];
    expect(lineByCode(items, '222')?.cell).toBe('B-02-2');
    expect(lineByCode(items, '999')).toBeNull();
    expect(weightOf(items[0])).toBe(2.2);
    expect(weightOf(task(1, 'TO_PICK', [line('1', null, 1, 0, { weightKg: null })]))).toBeNull();
    expect(goodsOf(items[0])).toBe('Tovar 111 +1');
  });
});

describe('yig‘ish varaqasi', () => {
  it('faqat hali yig‘ilmagan dona; yacheyka tartibida (A-01-3 < B-02-1 < B-02-10), raqamlar davomli', () => {
    const items = [
      task(1188, 'PACKED', [line('111', 'B-02-1', 1, 1)]),
      task(1209, 'PICKED', [line('111', 'B-02-1', 1, 1)]),
      task(1240, 'TO_PICK', [line('111', 'B-02-1')], { customerName: 'Dilfuza', confirmedAt: '2027-01-14T05:47:00.000Z' }),
      task(1244, 'TO_PICK', [line('333', 'B-02-10'), line('111', 'B-02-1', 3, 1)], { confirmedAt: '2027-01-14T08:55:00.000Z' }),
      task(1248, 'TO_PICK', [line('222', 'A-01-3')]),
      task(1250, 'TO_PICK', [line('444', null)]),
    ];
    const sheet = pickSheet(items, '2027-01-14', '2027-01-14');
    expect(sheet.groups.map((group) => [group.cell, group.quantity])).toEqual([['A-01-3', 1], ['B-02-1', 3], ['B-02-10', 1], [null, 1]]);
    expect(sheet.groups[1].orders).toEqual([
      { no: 2, taskId: '340', orderNumber: 'L-1240', customerName: 'Dilfuza', quantity: 1 },
      { no: 3, taskId: '344', orderNumber: 'L-1244', customerName: null, quantity: 2 },
    ]);
    expect(sheet).toMatchObject({ parcels: 4, pieces: 6, cells: 4 });
    expect(sheet.lastConfirmed?.orderNumber).toBe('L-1244');
  });

  it('TC4: ertangi varaqda faqat ertangi kun vazifalari; bugungida kechikkanlari ham', () => {
    const items = [
      task(1201, 'TO_PICK', [line('111', 'A-01-1')], { pickDate: '2027-01-13', overdue: true }),
      task(1240, 'TO_PICK', [line('111', 'A-01-1')]),
      task(1245, 'TO_PICK', [line('111', 'A-01-1')], { pickDate: '2027-01-15' }),
    ];
    expect(pickSheet(items, '2027-01-14', '2027-01-14').groups[0].orders.map((order) => order.orderNumber)).toEqual(['L-1201', 'L-1240']);
    expect(pickSheet(items, '2027-01-15', '2027-01-14').groups[0].orders.map((order) => order.orderNumber)).toEqual(['L-1245']);
    expect(pickSheet([], '2027-01-14', '2027-01-14')).toMatchObject({ groups: [], parcels: 0, pieces: 0, lastConfirmed: null });
  });
});
