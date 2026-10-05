import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import type { UnknownRecord } from '../../../shared/api/responseFields';
import type { CodReconciliation, FinancePage, LedgerEntry, LedgerEntryType, PayoutFrequency, PayoutSchedule, SellerFinanceRange, SellerFinanceSummary, SellerLedgerParams, SellerPayout, SellerPayoutParams, SellerPayoutStatus } from '../model/sellerFinanceTypes';

const frequencies: PayoutFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
const payoutStatuses: SellerPayoutStatus[] = ['PENDING', 'APPROVED', 'HELD', 'PAID'];
const entryTypes: LedgerEntryType[] = ['SALE', 'COD_SALE', 'COD_SETTLEMENT', 'COMMISSION', 'PAYOUT', 'REFUND', 'ADJUST'];

function objectOf(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} noto‘g‘ri formatda keldi`);
  return value as UnknownRecord;
}

/** Pul summasi: Postgres `numeric` satr bo'lib kelishi ham mumkin — soxta 0 ko'rsatmaslik uchun noto'g'ri qiymatda xato. */
function amountField(record: UnknownRecord, key: string, label: string): number {
  const value = record[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`${label}: ${key} maydoni noto‘g‘ri`);
  return parsed;
}

function idField(record: UnknownRecord, key: string, label: string): string {
  const value = record[key];
  if ((typeof value !== 'string' || !value) && typeof value !== 'number') throw new Error(`${label}: ${key} maydoni yo‘q`);
  return String(value);
}

function textField(record: UnknownRecord, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value) throw new Error(`${label}: ${key} maydoni yo‘q`);
  return value;
}

const nullableText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

function enumField<T extends string>(record: UnknownRecord, key: string, allowed: readonly T[], label: string): T {
  const value = record[key];
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${label}: ${key} qiymati noma’lum`);
  return value as T;
}

function parsePage<T>(data: unknown, parseItem: (value: unknown) => T, label: string): FinancePage<T> {
  const page = objectOf(unwrapApiData(data), label);
  if (!Array.isArray(page.items)) throw new Error(`${label} noto‘g‘ri formatda keldi`);
  return {
    items: page.items.map(parseItem),
    total: amountField(page, 'total', label),
    page: amountField(page, 'page', label),
    limit: amountField(page, 'limit', label),
    totalPages: amountField(page, 'totalPages', label),
  };
}

function parseLedgerEntry(value: unknown): LedgerEntry {
  const label = 'Hisob yozuvi';
  const entry = objectOf(value, label);
  return {
    id: idField(entry, 'id', label),
    shopId: idField(entry, 'shopId', label),
    entryType: enumField(entry, 'entryType', entryTypes, label),
    amount: amountField(entry, 'amount', label),
    balanceAfter: amountField(entry, 'balanceAfter', label),
    referenceType: textField(entry, 'referenceType', label),
    referenceId: idField(entry, 'referenceId', label),
    createdAt: textField(entry, 'createdAt', label),
  };
}

function parsePayout(value: unknown): SellerPayout {
  const label = 'To‘lov';
  const payout = objectOf(value, label);
  return {
    id: idField(payout, 'id', label),
    shopId: idField(payout, 'shopId', label),
    amount: amountField(payout, 'amount', label),
    status: enumField(payout, 'status', payoutStatuses, label),
    method: nullableText(payout.method),
    referenceId: idField(payout, 'referenceId', label),
    paidAt: nullableText(payout.paidAt),
    createdAt: textField(payout, 'createdAt', label),
    updatedAt: textField(payout, 'updatedAt', label),
  };
}

function parseCodReconciliation(value: unknown): CodReconciliation {
  const label = 'COD hisob-kitobi';
  const cod = objectOf(value, label);
  return {
    settlementsCount: amountField(cod, 'settlementsCount', label),
    expectedCodAmount: amountField(cod, 'expectedCodAmount', label),
    collectedCodAmount: amountField(cod, 'collectedCodAmount', label),
    difference: amountField(cod, 'difference', label),
    expectedCommission: amountField(cod, 'expectedCommission', label),
    nettedCommission: amountField(cod, 'nettedCommission', label),
    outstandingCommission: amountField(cod, 'outstandingCommission', label),
  };
}

function parseSummary(data: unknown): SellerFinanceSummary {
  const label = 'Moliya jamlanmasi';
  const summary = objectOf(unwrapApiData(data), label);
  return {
    shopId: idField(summary, 'shopId', label),
    balance: amountField(summary, 'balance', label),
    pendingPayoutAmount: amountField(summary, 'pendingPayoutAmount', label),
    heldPayoutAmount: amountField(summary, 'heldPayoutAmount', label),
    paidPayoutAmount: amountField(summary, 'paidPayoutAmount', label),
    cod: parseCodReconciliation(summary.cod),
    payoutSchedule: enumField(summary, 'payoutSchedule', frequencies, label),
    nextPayoutDate: textField(summary, 'nextPayoutDate', label),
  };
}

function parseSchedule(data: unknown): PayoutSchedule {
  const label = 'To‘lov jadvali';
  const schedule = objectOf(unwrapApiData(data), label);
  return {
    frequency: enumField(schedule, 'frequency', frequencies, label),
    isDefault: schedule.isDefault === true,
    nextPayoutDate: textField(schedule, 'nextPayoutDate', label),
    updatedAt: nullableText(schedule.updatedAt),
  };
}

export async function getSellerFinanceSummary(range: SellerFinanceRange, signal?: AbortSignal): Promise<SellerFinanceSummary> {
  const { data } = await httpClient.get<unknown>('/seller/finance/summary', { params: range, signal });
  return parseSummary(data);
}

export async function getSellerLedger(params: SellerLedgerParams, signal?: AbortSignal): Promise<FinancePage<LedgerEntry>> {
  const { data } = await httpClient.get<unknown>('/seller/finance/ledger', { params, signal });
  return parsePage(data, parseLedgerEntry, 'Hisob yozuvlari');
}

export async function getSellerPayouts(params: SellerPayoutParams, signal?: AbortSignal): Promise<FinancePage<SellerPayout>> {
  const { data } = await httpClient.get<unknown>('/seller/finance/payouts', { params, signal });
  return parsePage(data, parsePayout, 'To‘lovlar ro‘yxati');
}

export async function getPayoutSchedule(signal?: AbortSignal): Promise<PayoutSchedule> {
  const { data } = await httpClient.get<unknown>('/seller/finance/payout-schedule', { signal });
  return parseSchedule(data);
}

export async function updatePayoutSchedule(frequency: PayoutFrequency): Promise<PayoutSchedule> {
  const { data } = await httpClient.put<unknown>('/seller/finance/payout-schedule', { frequency });
  return parseSchedule(data);
}
