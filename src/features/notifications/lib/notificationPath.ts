import { asRecord, readText } from '../../../shared/api/responseFields';
import type { UserRole } from '../../auth/model/authTypes';
import type { AppNotification } from '../model/notificationTypes';

/**
 * Bildirishnoma bosilganda ochiladigan sahifa. Qaytarish (C4.2): `return_*` turlari,
 * `data.returnId` — sotuvchi/operator o'z ro'yxatida, admin admin ro'yxatida ochadi.
 * Sahifasi yo'q turlar faqat o'qilgan qilinadi.
 */
export function getNotificationPath(notification: AppNotification, role: UserRole | undefined): string | null {
  if (!notification.type.startsWith('return_')) return null;
  const returnId = readText(asRecord(notification.data), 'returnId');
  if (!returnId) return null;
  if (role === 'ADMIN' || role === 'SUPERADMIN') return `/admin/returns?id=${encodeURIComponent(returnId)}`;
  if (role === 'SELLER' || role === 'OPERATOR') return `/returns?id=${encodeURIComponent(returnId)}`;
  return null;
}
