import { ChevronRight, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AffiliateLeadStatus } from '../../../features/affiliate/api/affiliateApi';
import { useAffiliateLeadsQuery } from '../../../features/affiliate/api/affiliateApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../AffiliateStatsPage.module.css';

/** Holat chipi rangi — bosh sahifadagidek (sotuvchi-bosh). */
const LEAD_TONE: Record<AffiliateLeadStatus, 'warning' | 'neutral' | 'success' | 'danger' | 'info'> = {
  NEW: 'info',
  BOOKED: 'info',
  CALLBACK: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  INVALID: 'danger',
  MERGED: 'neutral',
  NO_CONTACT: 'neutral',
};

/**
 * «Har lidning taqdiri — «Lidlar» bo'limida» (sotuvchi-statistika, oxirgi blok): bugungi lidlar holati
 * va «Lidlarni ochish». Raqam, ism va manzil bu yerda yo'q — faqat holatlar soni.
 */
export function LeadsFooter({ today, asOf }: { today: string; asOf: string | null }) {
  const { t } = useTranslation();
  const leads = useAffiliateLeadsQuery(today, today);
  // Holatlar faqat ro'yxat to'liq kelganda (100 tadan ko'p bo'lsa — faqat havola).
  const items = leads.data && leads.data.items.length === leads.data.total ? leads.data.items : null;
  const counts = items
    ? [...items.reduce((map, lead) => map.set(lead.status, (map.get(lead.status) ?? 0) + 1), new Map<AffiliateLeadStatus, number>())]
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <section className={`${styles.card} ${styles.leadsFooter}`} aria-labelledby="stats-leads-footer">
      <span className={styles.leadsIcon} aria-hidden>
        <Inbox size={20} />
      </span>
      <div className={styles.leadsText}>
        <strong id="stats-leads-footer">{t('sellerStats.leadsFooter.title')}</strong>
        <span className={styles.muted}>
          {t('sellerStats.leadsFooter.caption')}
          {items && asOf ? ` ${t('sellerStats.leadsFooter.today', { count: items.length, time: asOf })}` : ''}
        </span>
      </div>
      {counts.length ? (
        <ul className={styles.chips} aria-label={t('sellerHome.todayLeads', { count: items?.length ?? 0 })}>
          {counts.map(([status, count]) => (
            <li key={status} className={styles.chip} data-tone={LEAD_TONE[status]}>
              {t(`sellerHome.lead.${status}` as TranslationKey)} · {count}
            </li>
          ))}
        </ul>
      ) : null}
      <Link className={styles.linkButton} to="/affiliate/leads">
        {t('sellerStats.leadsFooter.open')}
        <ChevronRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
