import axios from 'axios';
import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { withOptionalBody } from '../../../shared/api/optionalParams';
import { readDto, readDtoList } from '../../../shared/api/readDto';
import { REQUEST_TIMEOUT } from '../../../shared/api/requestOptions';
import { wholesalerBody } from '../lib/wholesalerRules';
import type { Wholesaler, WholesalerAct, WholesalerAttention, WholesalerAuditEntry, WholesalerDocument, WholesalerInput, WholesalerSettlement } from '../model/wholesalerTypes';

interface WholesalerPage {
  items: Wholesaler[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_LIMIT = 100;
const REQUIRED = ['id', 'name', 'status', 'tin', 'contractNumber', 'contractDate'] as const;

/**
 * Hamma optoviklar (BE-07 `GET /admin/wholesalers`, 100 tadan sahifalab). Pilotda optovik o'nlab — holat, shartnoma
 * va kabinet filtrlari hamda yorliq sonlari brauzerda hisoblanadi (backendda faqat `search`; taklif §1).
 */
export async function getAllWholesalers(signal?: AbortSignal): Promise<Wholesaler[]> {
  const items: Wholesaler[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await httpClient.get<unknown>('/admin/wholesalers', { params: { page, limit: PAGE_LIMIT }, signal });
    const result = readDto<WholesalerPage>(data, ['items', 'total']);
    items.push(...result.items.map((item) => readDto<Wholesaler>(item, REQUIRED)));
    if (items.length >= result.total || result.items.length < PAGE_LIMIT) return items;
  }
}

export async function getWholesaler(id: string, signal?: AbortSignal): Promise<Wholesaler> {
  const { data } = await httpClient.get<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}`, { signal });
  return readDto<Wholesaler>(data, REQUIRED);
}

/** Taklif maydonlari: rahbar F.I.Sh. (§1). Backend rad etsa ularsiz saqlanadi. */
const OPTIONAL_FIELDS = ['directorName'] as const;

/**
 * Optovikni kiritish (BE-07, OPT-1): foydalanuvchisiz, holat darhol «Faol». STIR takror — 409; shartnomasiz saqlash —
 * taklif §2 (backend hozir raqam va sanani majburiy qiladi — 400 maydon ostida chiqadi).
 */
export async function createWholesaler(input: WholesalerInput): Promise<Wholesaler> {
  const { data } = await withOptionalBody(
    async (body) => (await httpClient.post<unknown>('/admin/wholesalers', body, { timeout: REQUEST_TIMEOUT.action })).data,
    wholesalerBody(input),
    OPTIONAL_FIELDS,
  );
  return readDto<Wholesaler>(data, REQUIRED);
}

/** Rekvizitlar va shartnomani tahrirlash (BE-07 PATCH): faqat o'zgargan maydonlar yuboriladi. */
export async function updateWholesaler({ id, changes }: { id: string; changes: Partial<ReturnType<typeof wholesalerBody>> & { status?: 'ACTIVE' | 'SUSPENDED'; reason?: string } }): Promise<Wholesaler> {
  const { data } = await withOptionalBody(
    async (body) => (await httpClient.patch<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}`, body, { timeout: REQUEST_TIMEOUT.action })).data,
    changes,
    ['directorName', 'reason'],
  );
  return readDto<Wholesaler>(data, REQUIRED);
}

/** M2 (BE-30): o'zi ro'yxatdan o'tgan optovik arizasi — tasdiq yoki rad (sabab majburiy). */
export async function reviewWholesaler({ id, decision, note }: { id: string; decision: 'APPROVE' | 'REJECT'; note?: string }): Promise<Wholesaler> {
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/review`, { decision, note }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<Wholesaler>(data, REQUIRED);
}

/** M2 (BE-30): admin kiritgan optovikka kabinet — shu raqamga foydalanuvchi, SMS kod bilan kiradi. */
export async function inviteWholesalerOwner({ id, phone, fullName }: { id: string; phone: string; fullName: string }): Promise<Wholesaler> {
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/owner`, { phone, fullName }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<Wholesaler>(data, REQUIRED);
}

export async function getWholesalerDocuments(id: string, signal?: AbortSignal): Promise<WholesalerDocument[]> {
  const { data } = await httpClient.get<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/documents`, { signal });
  return readDtoList<WholesalerDocument>(data, ['id', 'kind', 'fileName', 'createdAt']);
}

/** Yopiq hujjatga 10 daqiqalik imzolangan havola (BE-30). */
export async function getWholesalerDocumentLink({ id, documentId }: { id: string; documentId: string }): Promise<string> {
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/link`, {}, { timeout: REQUEST_TIMEOUT.action });
  return readDto<{ url: string }>(data, ['url']).url;
}

/** Elektron komissiya shartnomasi PDF (kabinetda imzolangan, BE-30) — imzolangan havola. */
export async function getWholesalerContractLink(id: string): Promise<string> {
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/contract/link`, {}, { timeout: REQUEST_TIMEOUT.action });
  return readDto<{ url: string }>(data, ['url']).url;
}

/**
 * Taklif §3: komissiya shartnomasining qog'oz nusxasi (skan) — raqami va sanasi bilan. Fayl yopiq joyga, faqat
 * imzolangan havola bilan ochiladi. Yuklangach shartnoma «Imzolangan», mahsulot va postavka qo'shish ochiladi.
 */
export async function uploadWholesalerContract({ id, file, contractNumber, contractDate }: { id: string; file: File | null; contractNumber: string; contractDate: string }): Promise<Wholesaler> {
  const form = new FormData();
  if (file) form.append('file', file);
  form.append('contractNumber', contractNumber.trim());
  form.append('contractDate', contractDate);
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/contract`, form, { timeout: REQUEST_TIMEOUT.file });
  return readDto<Wholesaler>(data, REQUIRED);
}

/** Taklif §4: «Diqqat talab qiladi» — brakli qabul, qoldiq tugagan, qaytarilmagan brak, tayyor akt. */
export async function getWholesalerAttention(signal?: AbortSignal): Promise<WholesalerAttention[]> {
  try {
    const { data } = await httpClient.get<unknown>('/admin/wholesalers/attention', { signal });
    return readDtoList<WholesalerAttention>(data, ['kind', 'id', 'wholesalerId']);
  } catch (error) {
    // Backend hali bermasa (yo'l `:id` ga tushib 404) — blok bo'sh ko'rinadi.
    if (axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status ?? 0)) return [];
    throw error;
  }
}

/** Taklif §5: optovikka yuboriladigan aktlar — brak, qabul farqi va akt-sverka (yangisi tepada). */
export async function getWholesalerActs(id: string, signal?: AbortSignal): Promise<WholesalerAct[]> {
  const { data } = await httpClient.get<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/acts`, { signal });
  return readDtoList<WholesalerAct>(data, ['id', 'kind', 'code', 'title']);
}

export type ActChannel = 'CABINET' | 'PRINT';

/** Taklif §5: aktni optovikka yuborish — kabinetga va/yoki chop etib (tovar bilan birga beriladi). */
export async function sendWholesalerAct({ id, actId, channels }: { id: string; actId: string; channels: ActChannel[] }) {
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/acts/${encodeURIComponent(actId)}/send`, { channels }, { timeout: REQUEST_TIMEOUT.action });
  return unwrapApiData(data);
}

/** Taklif §8: kabinetdan so'ralgan bank rekviziti o'zgarishini tasdiqlash yoki rad etish. */
export async function reviewBankChange({ id, requestId, decision }: { id: string; requestId: string; decision: 'APPROVE' | 'REJECT' }): Promise<Wholesaler> {
  const { data } = await httpClient.post<unknown>(`/admin/wholesalers/${encodeURIComponent(id)}/bank-change/${encodeURIComponent(requestId)}/review`, { decision }, { timeout: REQUEST_TIMEOUT.action });
  return readDto<Wholesaler>(data, REQUIRED);
}

/** BE-33: optovik akt-sverkalari (yangisi tepada). */
export async function getWholesalerSettlements(id: string, signal?: AbortSignal): Promise<WholesalerSettlement[]> {
  const { data } = await httpClient.get<unknown>('/admin/finance/settlements', { params: { wholesalerId: id, page: 1, limit: 100 }, signal });
  return readDto<{ items: WholesalerSettlement[] }>(data, ['items']).items;
}

/** Optovik tarixi — audit jurnali (BE-07 har amalni yozadi: `wholesaler.create`, `.update`, `.review`, `.owner.link`). */
export async function getWholesalerAudit(id: string, signal?: AbortSignal): Promise<WholesalerAuditEntry[]> {
  const { data } = await httpClient.get<unknown>('/admin/audit', { params: { entityType: 'Wholesaler', entityId: id, page: 1, limit: 100 }, signal });
  const items = readDto<{ items: Record<string, unknown>[] }>(data, ['items']).items;
  return items.map((row) => ({
    id: String(row.id),
    at: typeof row.createdAt === 'string' ? row.createdAt : '',
    actorName: typeof row.actorName === 'string' && row.actorName ? row.actorName : null,
    action: typeof row.action === 'string' ? row.action : '',
    meta: row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>) : {},
  })).sort((a, b) => b.at.localeCompare(a.at));
}
