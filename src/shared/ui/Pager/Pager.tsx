import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { PAGE_SIZES, pageItems } from './pagerItems';
import styles from './Pager.module.css';

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  /** Jami matni oralig'idan keyin: «/ 240 ta lid». */
  totalLabel: string;
  sizes?: readonly number[];
}

/**
 * Jadval sahifalash (admin-lidlar, admin-buyurtmalar): chapda «1–10 / 240 ta lid», o'ngda «Qatorlar: 10 ta» va
 * sahifa raqamlari. Planshetda tugmalar 44 px (container `content`).
 */
export function Pager({ page, pageSize, total, onPage, onPageSize, totalLabel, sizes = PAGE_SIZES }: PagerProps) {
  const { t } = useTranslation();
  const sizeId = useId();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const from = total ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(total, current * pageSize);

  return (
    <div className={styles.pager}>
      <span className={styles.range}><strong>{from}–{to}</strong> {totalLabel}</span>
      <div className={styles.controls}>
        {onPageSize ? (
          <div className={styles.size}>
            <label htmlFor={sizeId}>{t('pager.rows')}</label>
            <span className={styles.select}>
              <select id={sizeId} value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
                {sizes.map((size) => <option key={size} value={size}>{t('pager.size', { count: size })}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </span>
          </div>
        ) : null}
        {pages > 1 ? (
          <nav className={styles.nav} aria-label={t('pager.nav')}>
            <button type="button" className={styles.button} aria-label={t('pager.prev')} disabled={current <= 1} onClick={() => onPage(current - 1)}>
              <ChevronLeft aria-hidden />
            </button>
            {pageItems(current, pages).map((item, index) => (item === 'gap' ? (
              <span key={`gap-${index}`} className={styles.gap} aria-hidden>…</span>
            ) : (
              <button
                key={item}
                type="button"
                className={styles.button}
                aria-label={t('pager.page', { page: item })}
                aria-current={item === current ? 'page' : undefined}
                onClick={() => onPage(item)}
              >
                {item}
              </button>
            )))}
            <button type="button" className={styles.button} aria-label={t('pager.next')} disabled={current >= pages} onClick={() => onPage(current + 1)}>
              <ChevronRight aria-hidden />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
