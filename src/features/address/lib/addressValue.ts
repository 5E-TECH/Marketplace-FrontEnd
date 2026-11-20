/** Manzil maydonlari: viloyat va tuman — SOATO, ko'cha/uy va xonadon/mo'ljal — matn. */
export interface AddressValue {
  regionSoato: string | null;
  districtSoato: string | null;
  street: string;
  apartment: string;
}

export const EMPTY_ADDRESS: AddressValue = { regionSoato: null, districtSoato: null, street: '', apartment: '' };

/** Serverga bitta qator (`addressLine`): «Navoiy ko‘chasi, 12-uy, 3-xonadon». */
export function addressLine({ street, apartment }: Pick<AddressValue, 'street' | 'apartment'>): string {
  return [street.trim(), apartment.trim()].filter(Boolean).join(', ');
}

/** Lid manzilidan maydonlar: mijoz bitta qator yozgan — hammasi «Ko‘cha, uy» ga. */
export function addressFromLead(address: { regionSoato: string; districtSoato: string; addressLine: string } | null | undefined): AddressValue {
  if (!address) return EMPTY_ADDRESS;
  return { regionSoato: address.regionSoato, districtSoato: address.districtSoato, street: address.addressLine, apartment: '' };
}

/** Operator mijoz yozganini o'zgartirdimi: tuman yoki manzil qatori boshqa. */
export function addressChanged(value: AddressValue, original: AddressValue): boolean {
  return value.regionSoato !== original.regionSoato || value.districtSoato !== original.districtSoato || addressLine(value) !== addressLine(original);
}

export type AddressField = 'region' | 'district' | 'street';

/** To'ldirilmagan majburiy maydonlar: viloyat, tuman, eshikkacha — ko'cha va uy. */
export function missingAddressFields(value: AddressValue, withStreet: boolean): AddressField[] {
  return [
    ...(value.regionSoato ? [] : ['region' as const]),
    ...(value.districtSoato ? [] : ['district' as const]),
    ...(withStreet && !value.street.trim() ? ['street' as const] : []),
  ];
}
