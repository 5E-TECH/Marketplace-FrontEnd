import { ChevronRight, CircleCheck, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from './SideCard.module.css';

/**
 * Kartaning yon bloki (admin-mahsulot-karta «Holat», «Narx», «Qoldiq»; admin-offer «Sotuvchi haqi»):
 * sarlavha, izoh va o'ngda havola; ichida qatorlar yoki shartlar ro'yxati.
 */
export function SideCard({ title, hint, link, gap = 10, children, testId }: {
  title: string;
  hint?: string;
  link?: { to: string; label: string };
  gap?: number;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className={styles.card} style={{ gap }} data-testid={testId}>
      <div className={styles.head}>
        <div>
          <h2>{title}</h2>
          {hint ? <p>{hint}</p> : null}
        </div>
        {link ? <Link to={link.to} className={styles.link}>{link.label}<ChevronRight aria-hidden /></Link> : null}
      </div>
      {children}
    </section>
  );
}

export interface InfoRow {
  label: string;
  value: ReactNode;
  sub?: string | null;
}

/** «Nomi — qiymat (izoh)» qatorlari, oralarida chiziq. */
export function InfoRows({ rows }: { rows: readonly InfoRow[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>
            {row.value}
            {row.sub ? <span>{row.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface Condition {
  ok: boolean;
  title: string;
  hint?: string | null;
}

/** Bajarilgan / bajarilmagan shartlar (yashil yoki qizil belgi, ekran o'quvchiga matn bilan). */
export function ConditionList({ items, caption }: { items: readonly Condition[]; caption?: string }) {
  const { t } = useTranslation();
  return (
    <div>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
      <ul className={styles.conditions}>
        {items.map((item) => (
          <li key={item.title}>
            {item.ok ? <CircleCheck aria-hidden data-ok /> : <CircleX aria-hidden />}
            <span>
              <span><span className={styles.visuallyHidden}>{t(item.ok ? 'sellerView.done' : 'sellerView.notDone')} </span>{item.title}</span>
              {item.hint ? <span>{item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
