import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readPagination, readText, type UnknownRecord } from '../../../shared/api/responseFields';
import type { Broadcast, BroadcastAudience, BroadcastChannel, BroadcastMessage, BroadcastPreview, BroadcastsPage, BroadcastStatus, NotificationTemplate } from '../model/adminNotificationTypes';

const AUDIENCES: BroadcastAudience[] = ['all', 'sellers', 'buyers'];
const STATUSES: BroadcastStatus[] = ['QUEUED', 'SENDING', 'DONE', 'FAILED'];
const nullableText = (row: UnknownRecord, key: string) => readText(row, key) || null;
const channels = (value: unknown): BroadcastChannel[] =>
  Array.isArray(value) ? value.filter((item): item is BroadcastChannel => item === 'sms' || item === 'email') : [];
const audience = (row: UnknownRecord): BroadcastAudience => {
  const value = readText(row, 'audience');
  return AUDIENCES.includes(value as BroadcastAudience) ? (value as BroadcastAudience) : 'all';
};

function parseTemplate(value: unknown): NotificationTemplate {
  const row = asRecord(value);
  const key = readText(row, 'key');
  if (!key) throw new Error('Shablon noto‘g‘ri formatda');
  const variables = asRecord(row.variables);
  return {
    key,
    name: readText(row, 'name') || key,
    description: readText(row, 'description'),
    variables: Object.fromEntries(Object.entries(variables).map(([name, text]) => [name, String(text)])),
    title: readText(row, 'title'),
    body: readText(row, 'body'),
    customized: row.customized === true,
    defaultTitle: readText(row, 'defaultTitle'),
    defaultBody: readText(row, 'defaultBody'),
    updatedAt: nullableText(row, 'updatedAt'),
  };
}

function parseBroadcast(value: unknown): Broadcast {
  const row = asRecord(value);
  const id = readText(row, 'id');
  if (!id) throw new Error('Ommaviy xabar noto‘g‘ri formatda');
  const status = readText(row, 'status');
  return {
    id,
    audience: audience(row),
    channels: channels(row.channels),
    title: readText(row, 'title'),
    body: readText(row, 'body'),
    recipientsCount: readNumber(row, ['recipientsCount']),
    sentCount: readNumber(row, ['sentCount']),
    status: STATUSES.includes(status as BroadcastStatus) ? (status as BroadcastStatus) : 'QUEUED',
    createdAt: readText(row, 'createdAt'),
    finishedAt: nullableText(row, 'finishedAt'),
    lastError: nullableText(row, 'lastError'),
    idempotent: row.idempotent === true,
  };
}

export async function getNotificationTemplates(signal?: AbortSignal): Promise<NotificationTemplate[]> {
  const { data } = await httpClient.get<unknown>('/admin/notifications/templates', { signal });
  const items = readItems(unwrapApiData(data), 'items');
  if (!items) throw new Error('Shablonlar ro‘yxati noto‘g‘ri formatda');
  return items.map(parseTemplate);
}

export async function updateNotificationTemplate({ key, title, body }: { key: string; title: string; body: string }): Promise<NotificationTemplate> {
  const { data } = await httpClient.patch<unknown>(`/admin/notifications/templates/${encodeURIComponent(key)}`, { title, body });
  return parseTemplate(unwrapApiData(data));
}

export async function resetNotificationTemplate(key: string): Promise<NotificationTemplate> {
  const { data } = await httpClient.post<unknown>(`/admin/notifications/templates/${encodeURIComponent(key)}/reset`);
  return parseTemplate(unwrapApiData(data));
}

export async function previewBroadcast(message: BroadcastMessage): Promise<BroadcastPreview> {
  const { data } = await httpClient.post<unknown>('/admin/broadcast/preview', message);
  const row = asRecord(unwrapApiData(data));
  const previewToken = readText(row, 'previewToken');
  if (!previewToken) throw new Error('Oldindan ko‘rish javobi noto‘g‘ri formatda');
  return {
    audience: audience(row),
    channels: channels(row.channels),
    title: readText(row, 'title'),
    body: readText(row, 'body'),
    recipientsCount: readNumber(row, ['recipientsCount']),
    previewToken,
  };
}

/** Faqat preview’dagi aynan shu xabar (token bilan) yuboriladi. */
export async function sendBroadcast(preview: BroadcastPreview): Promise<Broadcast> {
  const { audience: target, channels: selected, title, body, previewToken } = preview;
  const { data } = await httpClient.post<unknown>('/admin/broadcast', { audience: target, channels: selected, title, body, previewToken });
  return parseBroadcast(unwrapApiData(data));
}

export async function getBroadcasts(params: { page: number; limit: number }, signal?: AbortSignal): Promise<BroadcastsPage> {
  const { data } = await httpClient.get<unknown>('/admin/broadcasts', { params, signal });
  const value = unwrapApiData(data);
  const items = readItems(value, 'items');
  if (!items) throw new Error('Ommaviy xabarlar ro‘yxati noto‘g‘ri formatda');
  const parsed = items.map(parseBroadcast);
  return { items: parsed, ...readPagination(asRecord(value), { page: params.page, limit: params.limit, itemCount: parsed.length }) };
}
