import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readNumber, readText } from '../../../shared/api/responseFields';
import type { AppNotification, NotificationsPage } from '../model/notificationTypes';

function parseNotification(value: unknown): AppNotification[] {
  const row = asRecord(value);
  const id = readText(row, 'id');
  const createdAt = readText(row, 'createdAt');
  // Buzuq yozuv butun ro'yxatni yiqitmasin — faqat o'zi tushib qoladi.
  if (!id || !createdAt) return [];
  return [{ id, type: readText(row, 'type'), title: readText(row, 'title'), body: readText(row, 'body'), isRead: row.isRead === true, data: asRecord(row.data), createdAt }];
}

export async function getNotifications(params: { page: number; limit: number }, signal?: AbortSignal): Promise<NotificationsPage> {
  const { data } = await httpClient.get<unknown>('/notifications', { params, signal });
  const value = unwrapApiData(data);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Bildirishnomalar noto‘g‘ri formatda keldi');
  const record = asRecord(value);
  const items = rawItems.flatMap(parseNotification);
  return {
    items,
    total: readNumber(record, ['total'], items.length),
    unreadCount: readNumber(record, ['unreadCount'], items.filter(({ isRead }) => !isRead).length),
    page: readNumber(record, ['page'], params.page),
    limit: readNumber(record, ['limit'], params.limit),
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await httpClient.patch(`/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await httpClient.patch('/notifications/read-all');
}
