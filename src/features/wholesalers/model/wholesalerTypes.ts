import type { components } from '../../../generated/api-types';

type Schemas = components['schemas'];

/**
 * Optovik (FE-25, OPT-1): admin kiritadi — BE-07 `WholesalerDto`. Ixtiyoriy maydonlar — taklif
 * (docs/api-taklif/fe-25-admin-optovik.md). Alohida faylda: mock (`src/mocks`) ham ishlatadi.
 */
export type WholesalerStatus = Schemas['WholesalerDto']['status'];
export type WholesalerLegalType = NonNullable<Schemas['WholesalerDto']['legalType']>;
export type WholesalerDocument = Schemas['WholesalerDocumentDto'];

/** Taklif §1: ro'yxat va kartadagi yig'ma raqamlar — ombor (BE-17) va moliya (BE-33) hisobi bilan bir xil. */
export interface WholesalerStats {
  products: { total: number; onSale: number; noStock: number };
  stock: { onHand: number; available: number; reserved: number };
  shipments: { total: number; waiting: number; waitingQty: number; waitingCodes: string[]; lastDefect: { code: string; quantity: number } | null };
  payable: { amount: number; held: number };
  /** Taklif §6: «Tovar holati» — yo'lda (Elchi mijozga), sotilgan, qaytgan, brak; kartada. */
  goods?: WholesalerGoods | null;
  /** Taklif §7: «Pul va aktlar» — moliya (BE-33) hisobi bilan bir xil; kartada. */
  money?: WholesalerMoney | null;
}

export interface WholesalerGoods {
  inTransit: number;
  sold: number;
  soldAmount: number;
  returned: number;
  returnedSorting: number;
  returnedInElchi: number;
  defect: number;
  defectReceiving: number;
  defectReturns: number;
}

export type SettlementState = 'READY' | 'ACCEPTED' | 'DISPUTED' | 'PAID';

export interface WholesalerMoney {
  payable: number;
  payableQty: number;
  held: number;
  heldQty: number;
  paid: number;
  written: number;
  writtenQty: number;
  /** «141 × 140 000 + 46 × 60 000 = 22 500 000» — bazaviy narx × sotilgan dona. */
  formula: { quantity: number; basePrice: number }[];
  nextActAt: string | null;
  lastAct: {
    id: string;
    code: string;
    periodFrom: string;
    periodTo: string;
    status: SettlementState;
    preparedAt: string;
    counted: number;
    notCounted: number;
    transfer: number;
  } | null;
}

/** Taklif §5: optovikka yuboriladigan akt — brak akti, qabul (farq) akti yoki akt-sverka. */
export interface WholesalerAct {
  id: string;
  kind: 'DEFECT' | 'RECEIVING' | 'SETTLEMENT';
  code: string;
  title: string;
  at: string | null;
  sentAt: string | null;
}

/** Taklif §8: kabinetdan bank rekviziti o'zgarishi so'rovi (M2) — admin bank xati bilan solishtirib tasdiqlaydi. */
export interface BankChangeRequest {
  id: string;
  requestedAt: string;
  bankName: string;
  bankMfo: string;
  bankAccount: string;
  file: { id: string; fileName: string } | null;
}

/** Taklif §1: optovik kabineti (M2, BE-30) — taklif yuborilgan, ochilgan, oxirgi faollik. */
export interface WholesalerCabinet {
  phone: string;
  invitedAt: string;
  openedAt: string | null;
  lastActiveAt: string | null;
}

/** Taklif §3: komissiya shartnomasining qog'oz nusxasi (skan) — yopiq fayl. */
export interface WholesalerContractFile {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
}

export interface WholesalerExtras {
  directorName?: string | null;
  createdBy?: string | null;
  /** Taklif §1: holat o'zgargan vaqt — «To‘xtatilgan · 12.01.2027». */
  statusChangedAt?: string | null;
  /** Taklif §1: holatni o'zgartirgan admin va to'xtatish sababi. */
  statusChangedBy?: string | null;
  suspendReason?: string | null;
  bankChangeRequest?: BankChangeRequest | null;
  stats?: WholesalerStats | null;
  cabinet?: WholesalerCabinet | null;
  contractFile?: WholesalerContractFile | null;
}

export type Wholesaler = Schemas['WholesalerDto'] & WholesalerExtras;

/** Ro'yxat yorliqlari: «Tekshiruvda» — M2 da o'zi ro'yxatdan o'tgan (PENDING). */
export const WHOLESALER_TABS = ['ALL', 'ACTIVE', 'PENDING', 'SUSPENDED'] as const;
export type WholesalerTab = (typeof WHOLESALER_TABS)[number];

export type ContractFilter = 'SIGNED' | 'MISSING';
export type CabinetFilter = 'ACTIVE' | 'INVITED' | 'NONE';

export interface WholesalerFilters {
  tab: WholesalerTab;
  search: string;
  contract: ContractFilter | null;
  cabinet: CabinetFilter | null;
}

/**
 * Yangi optovik / rekvizitlarni tahrirlash. Shartnoma raqami va sanasi — ixtiyoriy (dizayn: «Shartnomasiz optovik
 * saqlanadi»); backend hozir majburiy qiladi — taklif §2.
 */
export interface WholesalerInput {
  legalType: WholesalerLegalType;
  name: string;
  tin: string;
  directorName: string;
  address: string;
  phone: string;
  bankName: string;
  bankMfo: string;
  bankAccount: string;
  contractNumber: string;
  contractDate: string;
}

/** Taklif §4: «Diqqat talab qiladi» — sabab turi va raqamlar; matnni UI tarjimadan yig'adi. */
export type WholesalerAttention =
  | { kind: 'SHIPMENT_DEFECT'; id: string; wholesalerId: string; wholesalerName: string; shipmentId: string; shipmentCode: string; productName: string; declared: number; received: number; defect: number }
  | { kind: 'OUT_OF_STOCK'; id: string; wholesalerId: string; wholesalerName: string; productId: string; productName: string; onHand: number; reserved: number; incomingCode: string | null; incomingQty: number }
  | { kind: 'DEFECT_NOT_RETURNED'; id: string; wholesalerId: string; wholesalerName: string; quantity: number; fromReceiving: number; receivingCodes: string[]; fromReturns: number; returnCodes: string[] }
  | { kind: 'SETTLEMENT_READY'; id: string; wholesalerId: string; wholesalerName: string; settlementId: string; code: string; periodFrom: string; periodTo: string; amount: number };

/** BE-33 akt-sverka (`WholesalerSettlementDto`) — «Pul va aktlar» yorlig'i. */
export type WholesalerSettlement = Omit<Schemas['WholesalerSettlementDto'], 'items'>;

/** Audit yozuvi (`GET /admin/audit?entityType=Wholesaler&entityId=`): kim, qachon, nima (`meta`). */
export interface WholesalerAuditEntry {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  meta: Record<string, unknown>;
}
