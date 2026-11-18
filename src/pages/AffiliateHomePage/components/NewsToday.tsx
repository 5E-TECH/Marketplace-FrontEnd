import { Skeleton } from 'antd';
import { useNotificationsQuery } from '../../../features/notifications/api/notificationQueries';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import styles from '../AffiliateHomePage.module.css';

interface NewsTodayProps {
  today: string;
  /** «Bugun» raqamlari qaysi vaqt holatiga — statistika soatda bir yangilanadi. */
  asOf: string | null;
}

const MAX_ITEMS = 5;

/** «Bugungi xabarlar» (sotuvchi-bosh): bugungi bildirishnomalar — qo'ng'iroqcha bilan bir xil ro'yxat. */
export function NewsToday({ today, asOf }: NewsTodayProps) {
  const { t } = useTranslation();
  const query = useNotificationsQuery(true);
  const items = (query.data?.items ?? []).filter((item) => tashkentDate(new Date(item.createdAt)) === today);
  const unread = items.filter((item) => !item.isRead).length;
  const nextHour = asOf ? `${String((Number(asOf.slice(0, 2)) + 1) % 24).padStart(2, '0')}:00` : null;

  return (
    <section className={`${styles.card} ${styles.news}`} aria-labelledby="affiliate-news">
      <header className={styles.head}>
        <h2 id="affiliate-news">{t('sellerHome.newsTitle')}</h2>
        {unread ? <span className={styles.badge}>{t('sellerHome.newsUnread', { count: unread })}</span> : null}
      </header>
      {query.isPending ? (
        <Skeleton active title={false} paragraph={{ rows: 3 }} />
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <strong>{t('sellerHome.newsEmptyTitle')}</strong>
          <span className={styles.muted}>{t('sellerHome.newsEmptyText')}</span>
        </div>
      ) : (
        <ul className={styles.newsList}>
          {items.slice(0, MAX_ITEMS).map((item) => (
            <li key={item.id}>
              <span className={styles.newsHead}>
                {item.isRead ? null : <span className={styles.unreadDot} role="img" aria-label={t('sellerHome.unread')} />}
                <strong>{item.title}</strong>
                <time dateTime={item.createdAt} className={styles.muted}>{tashkentClock(new Date(item.createdAt))}</time>
              </span>
              {item.body ? <span className={styles.muted}>{item.body}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {asOf && nextHour ? <p className={styles.note}>{t('sellerHome.newsFooter', { time: asOf, next: nextHour })}</p> : null}
    </section>
  );
}
