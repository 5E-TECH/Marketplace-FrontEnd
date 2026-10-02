const uz = {
  'notifications.title': 'Bildirishnomalar',
  'notifications.markAll': 'Barchasini o‘qilgan qilish',
  'notifications.empty': 'Bildirishnomalar yo‘q',
  'notifications.loading': 'Yuklanmoqda…',
  'notifications.loadError': 'Bildirishnomalarni yuklab bo‘lmadi.',
  'notifications.bellUnread': 'Bildirishnomalar: {count} ta o‘qilmagan',
} as const;

type NotificationTranslationKey = keyof typeof uz;

const ru: Record<NotificationTranslationKey, string> = {
  'notifications.title': 'Уведомления',
  'notifications.markAll': 'Отметить все прочитанными',
  'notifications.empty': 'Уведомлений нет',
  'notifications.loading': 'Загрузка…',
  'notifications.loadError': 'Не удалось загрузить уведомления.',
  'notifications.bellUnread': 'Уведомления: непрочитанных {count}',
};

const en: Record<NotificationTranslationKey, string> = {
  'notifications.title': 'Notifications',
  'notifications.markAll': 'Mark all as read',
  'notifications.empty': 'No notifications',
  'notifications.loading': 'Loading…',
  'notifications.loadError': 'Could not load notifications.',
  'notifications.bellUnread': 'Notifications: {count} unread',
};

export const notificationTranslations = { uz, ru, en };
