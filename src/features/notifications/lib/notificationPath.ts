import type { UserRole } from '../../auth/model/authTypes';
import type { AppNotification } from '../model/notificationTypes';

/**
 * Bildirishnoma bosilganda ochiladigan sahifa. Lid-sotuv modelida bildirishnoma
 * turlari sahifalari hali qurilmagan (eski `return_*` → `/admin/returns` sahifasi
 * FE-01 da uzildi), shuning uchun bosilgan xabar faqat o'qilgan qilinadi.
 * Tur sahifasi qurilganda shu yerda `notification.type` va `role` bo'yicha yo'l qaytariladi.
 */
export function getNotificationPath(notification: AppNotification, role: UserRole | undefined): string | null {
  void notification;
  void role;
  return null;
}
