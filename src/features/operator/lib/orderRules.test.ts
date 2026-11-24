import { describe, expect, it } from 'vitest';
import { EMPTY_ADDRESS } from '../../address/lib/addressValue';
import { tashkentMoment } from './leadRules';
import { kgLabel, orderBlock, shipDay } from './orderRules';

const address = { regionSoato: '1730', districtSoato: '1730412', street: 'Turkiston ko‘chasi, 27-uy', apartment: '' };

describe('orderRules (FE-09)', () => {
  it('OMB-4: 14:00 gacha — bugun, 14:00 dan — ertaga (Toshkent vaqti)', () => {
    expect(shipDay(tashkentMoment('2027-01-14', '13:40'))).toEqual({ date: '2027-01-14', today: true });
    expect(shipDay(tashkentMoment('2027-01-14', '14:00'))).toEqual({ date: '2027-01-15', today: false });
    expect(shipDay(tashkentMoment('2027-01-31', '14:37'))).toEqual({ date: '2027-02-01', today: false });
  });

  it('TC4: manzil to‘liq bo‘lmaguncha tasdiqlash yopiq — tuman va manzil sabablari alohida', () => {
    expect(orderBlock({ address: { ...address, districtSoato: null }, quantity: 1, available: 120, quote: 'ready' })).toBe('district');
    expect(orderBlock({ address: { ...address, street: '  ' }, quantity: 1, available: 120, quote: 'ready' })).toBe('address');
    expect(orderBlock({ address: EMPTY_ADDRESS, quantity: 1, available: 120, quote: 'ready' })).toBe('address');
  });

  it('qoldiq va summa: miqdor > qoldiq, qoldiq 0, summa hisoblanmagan; hammasi joyida — yopiq emas', () => {
    expect(orderBlock({ address, quantity: 2, available: 1, quote: 'ready' })).toBe('stock');
    expect(orderBlock({ address, quantity: 1, available: 0, quote: 'ready' })).toBe('outOfStock');
    expect(orderBlock({ address, quantity: 1, available: 120, quote: 'failed' })).toBe('quote');
    expect(orderBlock({ address, quantity: 1, available: 120, quote: 'pending' })).toBe('quote');
    expect(orderBlock({ address, quantity: 1, available: null, quote: 'ready' })).toBeNull();
    expect(orderBlock({ address, quantity: 14, available: 120, quote: 'ready' })).toBeNull();
  });

  it('og‘irlik bir kasr belgisigacha: 300 → 0.3 kg, 4 200 → 4.2 kg, 11 200 → 11.2 kg, 3 000 → 3 kg', () => {
    expect(kgLabel(300)).toBe('0.3 kg');
    expect(kgLabel(4_200)).toBe('4.2 kg');
    expect(kgLabel(11_200)).toBe('11.2 kg');
    expect(kgLabel(3_000)).toBe('3 kg');
  });
});
