import { describe, expect, it } from 'vitest';
import type { StockLot } from '../../features/inbound/model/inboundTypes';
import { lotState, lotViews } from './lotView';

const lot = (id: string, expiryDate: string, blocked: boolean, batch: string | null = null): StockLot => ({
  id, variantId: '51101', sku: 'SKU-511', productName: 'Vitamin', batch, expiryDate, sellableUntil: expiryDate, quantity: 10, blocked,
});

describe('partiya holati (OMB-3)', () => {
  it('muddati o‘tgan → sotuvdan chiqarilgan (`blocked`) → sotuvda', () => {
    expect(lotState(lot('1', '2027-01-13', true), '2027-01-14')).toBe('EXPIRED');
    expect(lotState(lot('2', '2027-03-01', true), '2027-01-14')).toBe('BLOCKED');
    expect(lotState(lot('3', '2027-06-01', false), '2027-01-14')).toBe('ON_SALE');
  });

  it('raqam — partiya yoki ID; sotuvdan chiqqan partiya yonidagi sotuvdagi partiyani ko‘rsatadi', () => {
    const views = lotViews([lot('2', '2027-03-01', true), lot('3', '2027-06-01', false, 'P-0120-1')], [
      { variantId: '51101', productId: '511', name: 'Vitamin', wholesalerId: '8', wholesalerName: 'Namuna Farm', barcode: null, cell: 'C-03-2', onHand: 20, reserved: 0, available: 10, blocked: 10, defect: 0, reservedToday: 0, reservedTomorrow: 0 },
    ], '2027-01-14');
    expect(views.map((view) => [view.number, view.cell, view.wholesalerName, view.sharesCellWith])).toEqual([
      ['#2', 'C-03-2', 'Namuna Farm', 'P-0120-1'],
      ['P-0120-1', 'C-03-2', 'Namuna Farm', null],
    ]);
  });
});
