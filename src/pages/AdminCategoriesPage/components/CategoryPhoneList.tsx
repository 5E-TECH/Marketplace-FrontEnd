import { ArrowDown, ArrowUp, ChevronRight, CornerDownRight, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PolicyLayer } from '../../../features/categories/api/categoryPolicyApi';
import type { Category } from '../../../features/categories/model/categoryTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { deliverySource, flagChip, modeLabel, plainMoney, productSummary } from '../model/categoryLabels';
import type { CategoryRow, Resolved } from '../model/categoryRows';
import { DeliveryValue } from './CategoryTable';
import styles from '../AdminCategoriesPage.module.css';

const chipTone = (resolved: Resolved<boolean>) => (resolved.source === 'own' ? 'own' : resolved.value ? 'on' : undefined);

/** Telefon (admin-kategoriyalar.mobil): kartalar — yetkazish ko'rinishi, BAD va muddat chiplari; bosilsa — tafsilot sahifasi. */
export function CategoryPhoneList({ rows, global, hrefOf }: { rows: readonly CategoryRow[]; global: PolicyLayer | undefined; hrefOf: (category: Category) => string }) {
  const { t } = useTranslation();
  const bad = t('acat.col.bad');
  const expiry = t('acat.col.expiry');
  return (
    <section className={styles.phoneCard} aria-label={t('acat.back')}>
      <ul className={styles.phoneList} data-testid="category-table">
        {global ? (
          <li className={styles.phoneGlobal}>
            <Link to="/admin/settings" aria-label={t('acat.globalSettings')}>
              <span className={styles.phoneTop}><span className={styles.phoneName}>{t('acat.global')}</span><Settings aria-hidden /></span>
              <span className={styles.phoneSub}>{`${t('acat.globalHint')} · ${t('acat.globalMarkup', { value: global.markupCapPercent ?? '—' })}`}</span>
              <span className={styles.phoneDelivery}>
                <span>{t('acat.deliveryLabel')} <strong>{modeLabel(t, global.deliveryMode)} · {plainMoney(global.visibleCenter)} / {plainMoney(global.visibleAddress)}</strong></span>
                <span className={styles.phoneSrc}>{global.updatedAt ? t('acat.since', { date: tashkentDay(global.updatedAt) }) : t('acat.src.default')}</span>
              </span>
              <span className={styles.chips}>
                <span className={styles.chip}>{`${bad}: ${t('acat.chipNo')}`}</span>
                <span className={styles.chip}>{`${expiry}: ${t('acat.chipNo')}`}</span>
              </span>
            </Link>
          </li>
        ) : null}
        {rows.map((row) => (
          <li key={row.category.id} data-category-id={row.category.id} data-inactive={!row.category.isActive || undefined}>
            <Link to={hrefOf(row.category)} aria-label={t('acat.openDetail', { name: row.category.name })} style={{ paddingLeft: row.depth ? 36 : undefined }}>
              <span className={styles.phoneTop}>
                <span className={styles.phoneName}>{row.depth ? <CornerDownRight aria-hidden /> : null}<span>{row.category.name}</span></span>
                <ChevronRight aria-hidden />
              </span>
              <span className={styles.phoneSub}>{productSummary(t, row.products)}{row.category.isActive ? '' : ` · ${t('status.inactive')}`}</span>
              <span className={styles.phoneDelivery}>
                <span>{t('acat.deliveryLabel')} <DeliveryValue row={row} /></span>
                <span className={styles.phoneSrc}>{deliverySource(t, row)}</span>
              </span>
              <span className={styles.chips}>
                <span className={styles.chip} data-tone={chipTone(row.bad)}>{flagChip(t, bad, row.bad)}</span>
                <span className={styles.chip} data-tone={chipTone(row.expiry)}>{flagChip(t, expiry, row.expiry)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Telefonda tartib (holatlar Ph3): sudrash yo'q — ↑ ↓ 44 px; ko'chirilgani ajratiladi («2-o'rin, avval 3-o'rin»). */
export function CategoryPhoneReorder({ rows, moved, onMove }: {
  rows: readonly CategoryRow[];
  moved: { id: string; from: number } | null;
  onMove: (category: Category, to: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.phoneCard} aria-label={t('acat.reorderList')}>
      <ul className={styles.phoneReorder} aria-label={t('acat.reorderList')} data-testid="category-table">
        {rows.map((row) => {
          const { category } = row;
          const isMoved = moved?.id === category.id && moved.from !== row.position;
          return (
            <li key={category.id} data-category-id={category.id} data-moved={isMoved || undefined} style={{ paddingLeft: row.depth ? 36 : undefined }}>
              <span className={styles.phoneReorderText}>
                <span className={styles.phoneName}>{row.depth ? <CornerDownRight aria-hidden /> : null}<span>{category.name}</span></span>
                <span className={styles.phoneSub}>
                  {productSummary(t, row.products)}
                  {isMoved ? ` · ${t('acat.movedFrom', { to: row.position + 1, from: (moved?.from ?? 0) + 1 })}` : ''}
                </span>
              </span>
              <button type="button" className={styles.moveBig} aria-label={t('acat.moveUp', { name: category.name })} title={t('acat.moveUp', { name: category.name })} disabled={row.position <= 0} onClick={() => onMove(category, row.position - 1)}><ArrowUp aria-hidden /></button>
              <button type="button" className={styles.moveBig} aria-label={t('acat.moveDown', { name: category.name })} title={t('acat.moveDown', { name: category.name })} disabled={row.position >= row.siblings - 1} onClick={() => onMove(category, row.position + 1)}><ArrowDown aria-hidden /></button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
