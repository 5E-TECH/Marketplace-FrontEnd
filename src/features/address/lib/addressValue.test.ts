import { describe, expect, it } from 'vitest';
import { addressChanged, addressFromLead, addressLine, EMPTY_ADDRESS, missingAddressFields } from './addressValue';

const lead = { regionSoato: '1730', districtSoato: '1730412', addressLine: 'Navoiy ko‘chasi, 12-uy' };

describe('addressValue', () => {
  it('ko‘cha va xonadonni bitta qatorga yig‘adi, bo‘shini tashlaydi', () => {
    expect(addressLine({ street: ' Navoiy ko‘chasi, 12-uy ', apartment: '' })).toBe('Navoiy ko‘chasi, 12-uy');
    expect(addressLine({ street: 'Navoiy ko‘chasi, 12-uy', apartment: '3-xonadon' })).toBe('Navoiy ko‘chasi, 12-uy, 3-xonadon');
  });

  it('mijoz yozganidan farqni topadi (TC5)', () => {
    const original = addressFromLead(lead);
    expect(addressChanged({ ...original, street: 'Navoiy ko‘chasi, 12-uy ' }, original)).toBe(false);
    expect(addressChanged({ ...original, apartment: '3-xonadon' }, original)).toBe(true);
    expect(addressChanged({ ...original, districtSoato: '1730401' }, original)).toBe(true);
  });

  it('majburiy maydonlarni sanaydi: ko‘cha faqat eshikkacha', () => {
    expect(missingAddressFields(EMPTY_ADDRESS, false)).toEqual(['region', 'district']);
    expect(missingAddressFields({ ...addressFromLead(lead), street: ' ' }, true)).toEqual(['street']);
    expect(missingAddressFields(addressFromLead(lead), true)).toEqual([]);
  });
});
