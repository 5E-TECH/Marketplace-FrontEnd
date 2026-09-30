import { Badge, Button, Popover } from 'antd';
import { BellRing } from 'lucide-react';
import { useState } from 'react';
import type { UserRole } from '../../../auth/model/authTypes';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { formatDateTime } from '../../../../shared/lib/date';
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from '../../api/notificationQueries';
import { getNotificationPath } from '../../lib/notificationPath';
import type { AppNotification } from '../../model/notificationTypes';
import styles from './NotificationBell.module.css';

interface NotificationBellProps {
  role: UserRole | undefined;
  onNavigate: (path: string) => void;
  badgeClassName?: string;
  buttonClassName?: string;
}

/** Header'dagi bildirishnomalar: o'qilmaganlar soni, oxirgi xabarlar va tegishli sahifaga o'tish. */
export function NotificationBell({ role, onNavigate, badgeClassName, buttonClassName }: NotificationBellProps) {
  const { locale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const query = useNotificationsQuery(Boolean(role));
  const markRead = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();
  const unread = query.data?.unreadCount ?? 0;

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const path = getNotificationPath(notification, role);
    if (path) { setOpen(false); onNavigate(path); }
  };

  const content = <div className={styles.panel}>
    <header className={styles.head}>
      <strong>{t('notifications.title')}</strong>
      <Button type="link" size="small" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate(undefined)}>{t('notifications.markAll')}</Button>
    </header>
    {query.isError && !query.data ? <p className={styles.state} role="alert">{t('notifications.loadError')} <Button type="link" size="small" onClick={() => void query.refetch()}>{t('common.retry')}</Button></p>
      : !query.data ? <p className={styles.state}>{t('notifications.loading')}</p>
      : !query.data.items.length ? <p className={styles.state}>{t('notifications.empty')}</p>
      : <ul className={styles.list}>{query.data.items.map((notification) => <li key={notification.id}>
        <button type="button" className={notification.isRead ? styles.item : `${styles.item} ${styles.unread}`} onClick={() => openNotification(notification)}>
          <strong>{notification.title}</strong>
          {notification.body ? <span>{notification.body}</span> : null}
          <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt, locale)}</time>
        </button>
      </li>)}</ul>}
  </div>;

  return <Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomRight" content={content} arrow={false}>
    <Badge className={badgeClassName} count={unread} overflowCount={99} size="small" offset={[-7, 7]}>
      <Button
        type="text"
        className={buttonClassName}
        icon={<BellRing />}
        aria-label={unread ? t('notifications.bellUnread', { count: unread }) : t('header.notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
    </Badge>
  </Popover>;
}
