import axios from 'axios';
import { isUserRole, type AuthUser, type UserRole } from '../model/authTypes';

/** Karkassiz «Hisobingiz bloklangan» sahifasi (oynadagi «Batafsil», sotuvchi SMS bilan kirganda). */
export const ACCOUNT_BLOCKED_PATH = '/account-blocked';

/** Hisob yopildi: admin blokladi yoki nazoratchi nofaol qildi (umumiy-sessiya 6–8, umumiy-kirish 12). */
export type AccountLockKind = 'BLOCKED' | 'INACTIVE';

export interface AccountLock {
  kind: AccountLockKind;
  /** Kim: sessiya egasi yoki kirish formasidagi telefon (backend `account` bermasa). */
  account: { id: string | null; name: string | null; role: UserRole | null; phone: string | null };
  /** Quyidagilar — taklif (docs/api-taklif/fe-15 §15): backend bermasa `null`, qator ko'rsatilmaydi. */
  at: string | null;
  by: { name: string; role: UserRole | null } | null;
  reason: string | null;
  evidence: string | null;
  /** Qaror asosi — sotuvchida «oferta». */
  basis: string | null;
  supervisorName: string | null;
  /** Sotuvchi: sahifalari, ushlab turilgan haq va balans. */
  seller: { pagesStopped: boolean | null; heldBonus: { amount: number; cancelled: boolean } | null; balance: number | null } | null;
}

const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Kirish formasi yoki sessiyadagi foydalanuvchi — backend hisob ma'lumotini bermasa ham «Hisob» qatori bo'ladi. */
export const lockAccountOf = (user: Pick<AuthUser, 'id' | 'name' | 'role' | 'phone'> | null, phone?: string): AccountLock['account'] => ({
  id: user?.id ?? null,
  name: user?.name.trim() || null,
  role: user?.role ?? null,
  phone: user?.phone ?? phone ?? null,
});

function sellerOf(value: unknown): AccountLock['seller'] {
  if (typeof value !== 'object' || value === null) return null;
  const seller = record(value);
  const held = record(seller.heldBonus);
  const heldAmount = amount(held.amount);
  return {
    pagesStopped: typeof seller.pagesStopped === 'boolean' ? seller.pagesStopped : null,
    heldBonus: heldAmount === null ? null : { amount: heldAmount, cancelled: held.cancelled === true },
    balance: amount(seller.balance),
  };
}

/**
 * 401 — hisob yopilganmi. Taklif: `errorCode` `ACCOUNT_BLOCKED` | `ACCOUNT_INACTIVE` va `account` tafsiloti
 * (login, refresh, SMS kod). Backend hozir faqat matn beradi: login — «Hisobingiz bloklangan» (bu ham blok);
 * refresh — «Hisob faol emas» (blok yoki nofaol — ajratib bo'lmaydi, oddiy «Sessiya tugadi» qoladi).
 */
export function readAccountLock(error: unknown, fallback: AccountLock['account']): AccountLock | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return null;
  const body = record(error.response.data);
  const kind: AccountLockKind | null = body.errorCode === 'ACCOUNT_BLOCKED' ? 'BLOCKED'
    : body.errorCode === 'ACCOUNT_INACTIVE' ? 'INACTIVE'
      : /bloklangan/i.test(text(body.message) ?? '') ? 'BLOCKED' : null;
  if (!kind) return null;
  const account = record(body.account);
  const by = record(account.by);
  const role = isUserRole(account.role) ? account.role : null;
  return {
    kind,
    account: {
      id: text(account.id) ?? fallback.id,
      name: text(account.name) ?? fallback.name,
      role: role ?? fallback.role,
      phone: fallback.phone,
    },
    at: text(account.at),
    by: text(by.name) ? { name: text(by.name) as string, role: isUserRole(by.role) ? by.role : null } : null,
    reason: text(account.reason),
    evidence: text(account.evidence),
    basis: text(account.basis),
    supervisorName: text(account.supervisorName),
    seller: sellerOf(account.seller),
  };
}

/** Sotuvchi va optovik — o'z sahifalari va puli bor (dizayndagi sotuvchi varianti). */
export const isSellerLock = (lock: AccountLock) => lock.account.role === 'AFFILIATE' || lock.account.role === 'WHOLESALER' || lock.seller !== null;
