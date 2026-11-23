import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PickTask } from './fulfillmentTypes';
import { loadHandoverDraft } from './handoverDraft';
import { useHandover } from './useHandover';

const task = (order: number, status: PickTask['status'], qrCodeToken: string | null): PickTask => ({
  taskId: String(order - 900), orderId: String(order), orderNumber: `L-${order}`, status, pickDate: '2027-01-14', overdue: false, quantity: 1, pickedQty: 1,
  lines: [{ productName: 'Elektr choynak', sku: null, barcode: '4780012345691', quantity: 1, pickedQty: 1, cell: 'B-02-2', weightKg: 1.2 }],
  parcel: { elchiState: 'CREATED', shipmentId: String(order + 5000), labelReady: true, error: null, qrCodeToken },
  customerName: null, regionName: null, districtName: null, deliveryMode: null, codAmount: null, confirmedAt: null, packedAt: null,
});

describe('useHandover: ochiq akt brauzerda, yakunda bitta so‘rov', () => {
  afterEach(() => window.localStorage.clear());

  it('TC3: QR — aktga; takror, qadoqlanmagan, tovar shtrix-kodi va begona QR aktga kirmaydi; akt soni = qo‘shilganlar', () => {
    const items = [task(1188, 'PACKED', 'QR-1188'), task(1209, 'PACKED', 'QR-1209'), task(1240, 'PICKED', 'QR-1240')];
    const { result } = renderHook(() => useHandover(items));

    act(() => result.current.scan('QR-1188'));
    expect(result.current.notice?.kind).toBe('ADDED');
    act(() => result.current.scan('QR-1188'));
    expect(result.current.notice).toMatchObject({ kind: 'DUPLICATE', scan: { orderNumber: 'L-1188' } });
    act(() => result.current.scan('QR-1240'));
    expect(result.current.notice?.kind).toBe('NOT_PACKED');
    act(() => result.current.scan('4780012345691'));
    expect(result.current.notice).toMatchObject({ kind: 'PRODUCT_CODE', scan: { productName: 'Elektr choynak' } });
    act(() => result.current.scan('QR-9999'));
    expect(result.current.notice?.kind).toBe('UNKNOWN');
    // Buyurtma raqamini qo'lda kiritish ham o'sha posilka.
    act(() => result.current.scan('l-1209'));

    expect(result.current.tokens).toEqual(['QR-1188', 'QR-1209']);
    expect([...result.current.scannedIds]).toEqual(['1188', '1209']);
    expect(result.current.draft.journalTotal).toBe(6);
    // Sahifa yangilansa ham akt saqlanadi.
    expect(loadHandoverDraft()?.tokens.map((item) => item.token)).toEqual(['QR-1188', 'QR-1209']);

    act(() => result.current.undoLast());
    expect(result.current.tokens).toEqual(['QR-1188']);
    expect(result.current.draft.journal.filter((item) => item.kind === 'ADDED')).toHaveLength(1);

    act(() => result.current.reset());
    expect(result.current.tokens).toEqual([]);
    expect(loadHandoverDraft()?.tokens ?? []).toEqual([]);
  });

  it('backend QR tokenini bermasa — kod aktga qo‘shiladi, tekshiruv yakunda serverda', () => {
    const { result } = renderHook(() => useHandover([task(1188, 'PACKED', null)]));
    act(() => result.current.scan('ELCHI-QR-77'));
    act(() => result.current.scan('ELCHI-QR-77'));
    expect(result.current.tokens).toEqual(['ELCHI-QR-77']);
    expect(result.current.notice?.kind).toBe('DUPLICATE');
    expect(result.current.lastAdded).toBeNull();
  });
});
