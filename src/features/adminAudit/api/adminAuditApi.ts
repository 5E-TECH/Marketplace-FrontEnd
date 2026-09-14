import { unwrapApiData } from '../../../shared/api/apiResponse';
import { httpClient } from '../../../shared/api/httpClient';
import { asRecord, readItems, readPagination, readText } from '../../../shared/api/responseFields';
import type { AdminAuditListParams, AdminAuditLog, AdminAuditPage } from '../model/adminAuditTypes';

function parseAuditLog(value: unknown): AdminAuditLog {
  if (!value || typeof value !== 'object') throw new Error('Audit yozuvi noto‘g‘ri formatda');

  const row = asRecord(value);
  const actor = asRecord(row.actor ?? row.user);
  const object = asRecord(row.object ?? row.target ?? row.resource);
  const id = readText(row, 'id');
  const action = readText(row, 'action', 'event', 'eventType');
  const createdAt = readText(row, 'createdAt', 'timestamp', 'occurredAt');

  if (!id || !action || !createdAt) {
    throw new Error('Audit yozuvining majburiy maydonlari mavjud emas');
  }

  return {
    id,
    actorId: readText(row, 'actorId', 'userId') || readText(actor, 'id'),
    actorName: readText(row, 'actorName', 'userName') || readText(actor, 'name', 'fullName', 'email', 'phone'),
    action,
    objectType: readText(row, 'entityType', 'objectType', 'targetType', 'resourceType') || readText(object, 'type', 'name'),
    objectId: readText(row, 'entityId', 'objectId', 'targetId', 'resourceId') || readText(object, 'id'),
    createdAt,
  };
}

export async function getAdminAuditLogs(
  params: AdminAuditListParams,
  signal?: AbortSignal,
): Promise<AdminAuditPage> {
  const { data } = await httpClient.get<unknown>('/admin/audit', { params, signal });
  const value = unwrapApiData(data);
  const record = asRecord(value);
  const rawItems = readItems(value, 'items');
  if (!rawItems) throw new Error('Audit jurnali ro‘yxati noto‘g‘ri formatda');

  const items = rawItems.map(parseAuditLog);
  return {
    items,
    ...readPagination(record, {
      page: params.page,
      limit: params.limit,
      itemCount: items.length,
    }),
  };
}
