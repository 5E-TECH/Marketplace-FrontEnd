/**
 * Sotuvchi profili tiplari (taklif — docs/api-taklif/fe-04-sotuvchi.md). Alohida faylda:
 * mock (`src/mocks`) ham ishlatadi, u esa `httpClient` ni import qilmasligi kerak.
 */
/** NOT_SUBMITTED → PENDING → VERIFIED | REJECTED; VERIFIED → REVOKED (soliq ro'yxatida faol emas). */
export type SelfEmployedStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';

export interface SelfEmployedInfo {
  status: SelfEmployedStatus;
  /** To'liq JShShIR qaytmaydi — oxirgi 4 raqam («···· 4018»). */
  pinflLast4: string | null;
  /** O'zini o'zi band qilganlar ro'yxatidagi faoliyat turi, masalan «SMM va internet-marketing» (34-band). */
  activity: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  /** Rad etish yoki bekor qilish sababi va tekshiruvchi izohi. */
  reason: string | null;
  comment: string | null;
  /** Yopiq fayl nomi (ma'lumotnoma) — faqat sotuvchi va tekshiruvchi ko'radi. */
  documentName: string | null;
}

export interface AgreementAcceptance {
  type: 'affiliate-offer' | 'personal-data-consent';
  version: string;
  acceptedAt: string;
  /** Joriy versiyami (yangi versiya chiqsa — eski qatorlar `false`). */
  current: boolean;
}

export interface SellerProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  registeredAt: string;
  lastLoginAt: string | null;
  agreements: AgreementAcceptance[];
  selfEmployed: SelfEmployedInfo;
  /** To'liq raqam saqlanmaydi — provayder belgisi va oxirgi 4 raqam (FE-07 da qo'shiladi). */
  card: { brand: 'UZCARD' | 'HUMO'; last4: string; addedAt: string } | null;
}
