import { Skeleton } from 'antd';
import { CircleCheck, CircleDot, Info, type LucideIcon } from 'lucide-react';
import { useNotificationsQuery } from '../../../features/notifications/api/notificationQueries';
import type { AppNotification } from '../../../features/notifications/model/notificationTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import styles from '../AffiliateHomePage.module.css';

interface NewsTodayProps {
  today: string;
  /** «Bugun» raqamlari qaysi vaqt holatiga — statistika soatda bir yangilanadi. */
  asOf: string | null;
}

const MAX_ITEMS = 5;

/** Xabar turi → belgi (sotuvchi-bosh): yetkazildi — yashil, yangi sotuv — ko'k, qolgani — kulrang. */
const KIND: Record<string, { tone: 'success' | 'info'; icon: LucideIcon }> = {
  order_delivered: { tone: 'success', icon: CircleCheck },
  lead_confirmed: { tone: 'info', icon: CircleDot },
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function NewsItem({ item }: { item: AppNotification }) {
  const { t } = useTranslation();
  const kind = KIND[item.type];
  const Icon = kind?.icon;
  const product = text(item.data.productName);
  const stream = text(item.data.streamCode);
  const fee = amount(item.data.amount);
  return (
    <li>
      {item.isRead ? <span aria-hidden /> : <span className={styles.unreadDot} role="img" aria-label={t('sellerHome.unread')} />}
      <span className={styles.newsBody}>
        <span className={styles.newsHead}>
          <span className={styles.chip} data-tone={kind?.tone ?? 'neutral'}>
            {Icon ? <Icon size={14} aria-hidden /> : null}
            {item.title}
          </span>
          <time dateTime={item.createdAt} className={styles.newsTime}>{tashkentClock(new Date(item.createdAt))}</time>
        </span>
        {product ? (
          <span className={styles.newsProduct}>
            <span className={styles.newsProductName}>
              {product}
              {stream ? <span className={styles.newsStream}> · {stream}</span> : null}
            </span>
            {fee !== null ? <span className={styles.newsAmount}>+{t('affiliateHome.sum', { amount: formatMoney(fee) })}</span> : null}
          </span>
        ) : null}
        {item.body ? <span className={styles.newsText}>{item.body}</span> : null}
      </span>
    </li>
  );
}

/** «Bugungi xabarlar» (sotuvchi-bosh): bugungi bildirishnomalar — qo'ng'iroqcha bilan bir xil ro'yxat. */
export function NewsToday({ today, asOf }: NewsTodayProps) {
  const { t } = useTranslation();
  const query = useNotificationsQuery(true);
  const items = (query.data?.items ?? []).filter((item) => tashkentDate(new Date(item.createdAt)) === today);
  const unread = items.filter((item) => !item.isRead).length;
  const nextHour = asOf ? `${String((Number(asOf.slice(0, 2)) + 1) % 24).padStart(2, '0')}:00` : null;

  return (
    <section className={`${styles.card} ${styles.news}`} aria-labelledby="affiliate-news">
      <header className={styles.newsTop}>
        <h2 id="affiliate-news">{t('sellerHome.newsTitle')}</h2>
        {unread ? <span className={styles.muted}>{t('sellerHome.newsUnread', { count: unread })}</span> : null}
      </header>
      {query.isPending ? (
        <div className={styles.newsPad}><Skeleton active title={false} paragraph={{ rows: 3 }} /></div>
      ) : items.length === 0 ? (
        <div className={styles.newsPad}>
          <div className={styles.empty}>
            <strong>{t('sellerHome.newsEmptyTitle')}</strong>
            <span className={styles.muted}>{t('sellerHome.newsEmptyText')}</span>
          </div>
        </div>
      ) : (
        <ul className={styles.newsList}>
          {items.slice(0, MAX_ITEMS).map((item) => <NewsItem key={item.id} item={item} />)}
        </ul>
      )}
      {asOf && nextHour ? (
        <p className={styles.newsFoot}>
          <Info size={14} aria-hidden />
          <span>{t('sellerHome.newsFooter', { time: asOf, next: nextHour })}</span>
        </p>
      ) : null}
    </section>
  );
}
