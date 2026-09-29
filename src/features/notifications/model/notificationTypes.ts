/** Kontrakt: NotificationDto. `title` va `body` backendda tayyorlanadi, `data` — turga xos qiymatlar. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}
