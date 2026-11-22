import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readShipment } from '../api/inboundApi';
import { loadDraft } from './receivingDraft';
import { useReceiving } from './useReceiving';

const item = (id: string, barcode: string, declaredQty: number, expiryTracked = false) => ({
  id, productId: id, productName: `Mahsulot ${id}`, variantId: `${id}01`, sku: `SKU-${id}`, barcode, declaredQty,
  receivedQty: null, defectiveQty: null, batch: null, expiryDate: null, cell: null, expiryTracked,
});
const shipment = (id: string, items: ReturnType<typeof item>[]) => readShipment({
  id, number: `P-${id}`, wholesalerId: '7', status: 'DECLARED', expectedAt: '2027-01-14', note: null, declaredBy: '3',
  receivedBy: null, receivedAt: null, receiveComment: null, createdAt: '2027-01-12T10:00:00.000Z', items,
});

describe('useReceiving: sanoq brauzerda, yakunda bitta `receive`', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('TC3: bir xil kod 1 s ichida ikki marta — bitta; Brak faqat keyingi skanga; payload: kelgan = qabul + brak', () => {
    vi.useFakeTimers({ now: Date.parse('2027-01-14T09:00:00.000Z') });
    const current = shipment('114', [item('501', '111', 100), item('502', '222', 50)]);
    const { result } = renderHook(() => useReceiving(current, { others: [], onLotRequired: vi.fn() }));

    act(() => result.current.scan('111'));
    act(() => result.current.scan('111'));
    expect(result.current.counts).toMatchObject({ accepted: 1, defect: 0 });
    expect(result.current.duplicateNotice).toBe('111');
    expect(result.current.journal.map((entry) => entry.kind)).toEqual(['DUPLICATE', 'ACCEPTED']);

    vi.advanceTimersByTime(1_100);
    act(() => result.current.setMode('DEFECT'));
    act(() => result.current.scan('222'));
    expect(result.current.mode).toBe('ACCEPT');
    vi.advanceTimersByTime(1_100);
    act(() => result.current.scan('222'));
    expect(result.current.itemCounts(current.items[1])).toEqual({ declared: 50, accepted: 1, defect: 1 });

    act(() => result.current.setNote('  2 ta quti ezilgan '));
    expect(result.current.payload({ '50101': 'B-02-1', '50201': null })).toEqual({
      items: [
        { itemId: '501', receivedQty: 1, defectiveQty: 0, cell: 'B-02-1' },
        { itemId: '502', receivedQty: 2, defectiveQty: 1, cell: '' },
      ],
      comment: '2 ta quti ezilgan',
    });
  });

  it('TC2: noma’lum kod — son o‘zgarmaydi; boshqa kutilayotgan postavkaniki — qaysi postavka ekani aytiladi', () => {
    const current = shipment('114', [item('501', '111', 10)]);
    const other = shipment('113', [item('504', '444', 60)]);
    const { result } = renderHook(() => useReceiving(current, { others: [other], onLotRequired: vi.fn() }));
    act(() => result.current.scan('999'));
    expect(result.current.problem).toEqual({ code: '999', kind: 'UNKNOWN', productName: null, otherShipment: null });
    act(() => result.current.scan('444'));
    expect(result.current.problem).toEqual({ code: '444', kind: 'FOREIGN', productName: 'Mahsulot 504', otherShipment: 'P-113' });
    expect(result.current.counts.accepted).toBe(0);
    expect(result.current.journal.map((entry) => entry.kind)).toEqual(['FOREIGN', 'UNKNOWN']);
  });

  it('muddatli tovar: partiyasiz birinchi skan oynani ochadi, partiya saqlangach o‘sha kod hisoblanadi', () => {
    const current = shipment('115', [item('511', '714', 60, true)]);
    const onLotRequired = vi.fn();
    const { result } = renderHook(() => useReceiving(current, { others: [], onLotRequired }));
    act(() => result.current.scan('714'));
    expect(onLotRequired).toHaveBeenCalledWith(current.items[0], '714');
    expect(result.current.counts.accepted).toBe(0);
    act(() => result.current.lotSaved(current.items[0], { batch: 'P-115-1', expiryDate: '2027-03-05' }, '714'));
    expect(result.current.counts.accepted).toBe(1);
    expect(result.current.payload({}).items[0]).toMatchObject({ batch: 'P-115-1', expiryDate: '2027-03-05' });
  });

  it('oxirgi hisoblangan skanni bekor qilish; qoralama brauzerda saqlanadi', () => {
    const current = shipment('116', [item('501', '111', 10)]);
    const { result, unmount } = renderHook(() => useReceiving(current, { others: [], onLotRequired: vi.fn() }));
    act(() => result.current.countManual('501'));
    act(() => result.current.scan('999'));
    expect(result.current.lastCounted?.kind).toBe('ACCEPTED');
    act(() => result.current.undoLast());
    expect(result.current.counts.accepted).toBe(0);
    expect(result.current.lastCounted).toBeNull();
    act(() => result.current.countManual('501'));
    unmount();
    expect(loadDraft('116')?.counts).toEqual({ 501: { accepted: 1, defect: 0 } });
  });
});
