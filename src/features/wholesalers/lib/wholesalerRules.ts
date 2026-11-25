import { formatLocalPhone, getUzLocalPhone } from '../../../shared/lib/phone';
import type { CabinetFilter, Wholesaler, WholesalerFilters, WholesalerInput, WholesalerTab } from '../model/wholesalerTypes';

/** OPT-1 (backend `hasContract`): komissiya shartnomasi kiritilgan — raqami va sanasi bor. */
export function hasContract(wholesaler: Pick<Wholesaler, 'contractNumber' | 'contractDate'>): boolean {
  return Boolean(wholesaler.contractNumber?.trim()) && Boolean(wholesaler.contractDate);
}

/** Kabinet holati: egasi bog'langan va ochilgan — faol; taklif yuborilgan — kutilmoqda; aks holda yo'q. */
export function cabinetState(wholesaler: Pick<Wholesaler, 'ownerUserId' | 'cabinet'>): CabinetFilter {
  if (wholesaler.cabinet) return wholesaler.cabinet.openedAt ? 'ACTIVE' : 'INVITED';
  return wholesaler.ownerUserId ? 'ACTIVE' : 'NONE';
}

export type ProductBlock = 'CONTRACT' | 'SUSPENDED' | 'PENDING' | null;

/**
 * Mahsulot va postavka qo'shish mumkinmi (OPT-1; backend: shartnomasiz — 409, to'xtatilgan optovik offerlari
 * sotuvdan olinadi). `null` — mumkin; aks holda sabab (tugma o'chiq, maslahatda shu sabab).
 */
export function productBlock(wholesaler: Pick<Wholesaler, 'status' | 'contractNumber' | 'contractDate'>): ProductBlock {
  if (wholesaler.status === 'SUSPENDED') return 'SUSPENDED';
  if (wholesaler.status === 'PENDING' || wholesaler.status === 'REJECTED') return 'PENDING';
  return hasContract(wholesaler) ? null : 'CONTRACT';
}

const TAB_STATUS: Record<Exclude<WholesalerTab, 'ALL'>, readonly Wholesaler['status'][]> = {
  ACTIVE: ['ACTIVE'],
  PENDING: ['PENDING'],
  SUSPENDED: ['SUSPENDED'],
};

export function inTab(wholesaler: Pick<Wholesaler, 'status'>, tab: WholesalerTab): boolean {
  return tab === 'ALL' ? wholesaler.status !== 'REJECTED' : TAB_STATUS[tab].includes(wholesaler.status);
}

/** Qidiruv backenddagidek: nom bo'yicha qism, STIR bo'yicha aniq. */
export function matchesSearch(wholesaler: Pick<Wholesaler, 'name' | 'tin'>, search: string): boolean {
  const query = search.trim().toLocaleLowerCase('uz');
  if (!query) return true;
  return wholesaler.name.toLocaleLowerCase('uz').includes(query) || wholesaler.tin === query;
}

export function matchesFilters(wholesaler: Wholesaler, filters: Omit<WholesalerFilters, 'tab'>): boolean {
  if (!matchesSearch(wholesaler, filters.search)) return false;
  if (filters.contract && (filters.contract === 'SIGNED') !== hasContract(wholesaler)) return false;
  return !filters.cabinet || cabinetState(wholesaler) === filters.cabinet;
}

export function tabCounts(list: readonly Wholesaler[]): Record<WholesalerTab, number> {
  return {
    ALL: list.filter((item) => inTab(item, 'ALL')).length,
    ACTIVE: list.filter((item) => inTab(item, 'ACTIVE')).length,
    PENDING: list.filter((item) => inTab(item, 'PENDING')).length,
    SUSPENDED: list.filter((item) => inTab(item, 'SUSPENDED')).length,
  };
}

export type WholesalerField = keyof WholesalerInput;

/** Formatlar backend `CreateWholesalerDto` dagidek: STIR 9, hisob 20, MFO 5 raqam; telefon +998 va 9 raqam. */
export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export function phoneDigits(value: string): string {
  const digits = digitsOnly(value);
  return digits.startsWith('998') ? digits.slice(3) : digits;
}

/** Maydon xatolari (tarjima kaliti qo'shimchasi): majburiy bo'sh — `required`, format — `format`. */
export function validateWholesaler(input: WholesalerInput): Partial<Record<WholesalerField, 'required' | 'format'>> {
  const errors: Partial<Record<WholesalerField, 'required' | 'format'>> = {};
  const required: WholesalerField[] = ['name', 'tin', 'phone', 'bankName', 'bankMfo', 'bankAccount'];
  required.forEach((field) => {
    if (!input[field].trim()) errors[field] = 'required';
  });
  if (input.tin.trim() && !/^\d{9}$/.test(digitsOnly(input.tin))) errors.tin = 'format';
  if (input.bankMfo.trim() && !/^\d{5}$/.test(digitsOnly(input.bankMfo))) errors.bankMfo = 'format';
  if (input.bankAccount.trim() && !/^\d{20}$/.test(digitsOnly(input.bankAccount))) errors.bankAccount = 'format';
  if (input.phone.trim() && !/^\d{9}$/.test(phoneDigits(input.phone))) errors.phone = 'format';
  // Shartnoma: raqami bilan sanasi birga kiritiladi (birini kiritib, ikkinchisini qoldirib bo'lmaydi).
  if (input.contractNumber.trim() && !input.contractDate) errors.contractDate = 'required';
  if (input.contractDate && !input.contractNumber.trim()) errors.contractNumber = 'required';
  return errors;
}

/** API tanasi: raqamli maydonlar faqat raqam, telefon `+998XXXXXXXXX`; bo'sh ixtiyoriy maydon yuborilmaydi. */
export function wholesalerBody(input: WholesalerInput) {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    legalType: input.legalType,
    name: input.name.trim(),
    tin: digitsOnly(input.tin),
    directorName: optional(input.directorName),
    address: optional(input.address),
    phone: `+998${phoneDigits(input.phone)}`,
    bankName: input.bankName.trim(),
    bankMfo: digitsOnly(input.bankMfo),
    bankAccount: digitsOnly(input.bankAccount),
    contractNumber: optional(input.contractNumber),
    contractDate: input.contractDate || undefined,
  };
}

export function wholesalerInput(wholesaler?: Wholesaler | null): WholesalerInput {
  return {
    legalType: wholesaler?.legalType ?? 'LEGAL_ENTITY',
    name: wholesaler?.name ?? '',
    tin: wholesaler?.tin ?? '',
    directorName: wholesaler?.directorName ?? '',
    address: wholesaler?.address ?? '',
    phone: wholesaler?.phone ?? '',
    bankName: wholesaler?.bankName ?? '',
    bankMfo: wholesaler?.bankMfo ?? '',
    bankAccount: wholesaler?.bankAccount ?? '',
    contractNumber: wholesaler?.contractNumber ?? '',
    contractDate: wholesaler?.contractDate ?? '',
  };
}

/** «+998 93 418 27 05» (kartadagi telefon, kabinet kirishi). */
export const displayPhone = (phone: string | null | undefined) => (phone ? `+998 ${formatLocalPhone(getUzLocalPhone(phone))}` : '—');

/** Shartnoma skani (taklif §3) — BE-30 hujjatlari bilan bir xil: PDF, JPEG yoki PNG, 10 MB gacha. */
const CONTRACT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const CONTRACT_MAX_BYTES = 10 * 1024 * 1024;

export type ContractFileError = 'type' | 'size' | 'required';

export function checkContractFile(file: Pick<File, 'type' | 'size'>): ContractFileError | null {
  if (!CONTRACT_TYPES.includes(file.type)) return 'type';
  return file.size > CONTRACT_MAX_BYTES ? 'size' : null;
}
