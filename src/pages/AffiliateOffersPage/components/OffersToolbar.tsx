import { ChevronDown, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { OfferSort } from '../../../features/affiliate/api/offersApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { ChartSegment } from '../../../shared/ui/Chart/ChartSegment';
import { DialogCancel, Dialog } from '../../../shared/ui/Dialog/Dialog';
import { PillSelect, type PillOption } from '../../../shared/ui/PillSelect/PillSelect';
import { OFFER_SORTS, type OffersView } from '../model/offersView';
import styles from '../AffiliateOffersPage.module.css';

export interface OffersFilterValue {
  search: string;
  categoryId: string;
  approve50: boolean;
  sort: OfferSort;
}

interface OffersToolbarProps {
  value: OffersFilterValue;
  onChange: (patch: Partial<OffersFilterValue>) => void;
  onReset: () => void;
  categories: readonly PillOption[];
  /** Filtr bo'yicha soni; `null` — yuklanmoqda yoki xato. */
  count: number | null;
  /** Filtrsiz jami — «2 ta offer · 4 tadan». */
  total: number | null;
  loading: boolean;
  view: OffersView;
  onView: (view: OffersView) => void;
  onRules: () => void;
  phone: boolean;
}

/**
 * Filtrlar (sotuvchi-offerlar): «Kategoriya», «Saralash», «Tasdiq ≥ 50%» va qidiruv; ostida soni,
 * «Reklama qoidalari» va «Kartalar / Jadval». Telefonda — qidiruv + «Filtrlar» varag'i, faol filtr chipi.
 */
export function OffersToolbar({ value, onChange, onReset, categories, count, total, loading, view, onView, onRules, phone }: OffersToolbarProps) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState(false);
  const all = t('offers.all');
  const categoryOptions = [{ value: '', label: all }, ...categories];
  const sortOptions = OFFER_SORTS.map((sort) => ({ value: sort, label: t(`offers.sort.${sort}` as TranslationKey) }));
  const active = Number(Boolean(value.categoryId)) + Number(value.approve50);
  const filtered = Boolean(value.search.trim() || value.categoryId || value.approve50);
  const countText = loading && count === null
    ? t('offers.loading')
    : count === null
      ? '—'
      : filtered && total !== null && total !== count
        ? t('offers.countOf', { count, total })
        : t('offers.count', { count });

  const search = (
    <span className={styles.search}>
      <Search aria-hidden />
      <input type="search" aria-label={t('offers.search')} placeholder={t('offers.search')} value={value.search} onChange={(event) => onChange({ search: event.target.value })} />
    </span>
  );
  const approve = (
    <label className={styles.checkPill} data-checked={value.approve50 || undefined}>
      <input type="checkbox" checked={value.approve50} onChange={(event) => onChange({ approve50: event.target.checked })} />
      {t('offers.approve50')}
    </label>
  );
  const rules = (
    <button type="button" className={styles.rulesLink} onClick={onRules}>
      {t('offers.rules')}
      <ChevronRight aria-hidden />
    </button>
  );

  if (phone) {
    const category = categories.find((item) => item.value === value.categoryId);
    return (
      <>
        <div className={styles.phoneSearch} role="search" aria-label={t('offers.filters')}>
          {search}
          <button type="button" className={styles.filtersButton} onClick={() => setSheet(true)} aria-haspopup="dialog">
            <SlidersHorizontal aria-hidden />
            {t('offers.filtersButton')}
            {active ? <span className={styles.filtersCount}>{active}</span> : null}
          </button>
        </div>
        {active ? (
          <div className={styles.chips}>
            {category ? (
              <button type="button" className={styles.filterChip} onClick={() => onChange({ categoryId: '' })} aria-label={t('offers.removeFilter', { name: category.label })}>
                {category.label}
                <X aria-hidden />
              </button>
            ) : null}
            {value.approve50 ? (
              <button type="button" className={styles.filterChip} onClick={() => onChange({ approve50: false })} aria-label={t('offers.removeFilter', { name: t('offers.approve50') })}>
                {t('offers.approve50')}
                <X aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={styles.countLine}>
          <div className={styles.countRow}>
            <p className={styles.count}>{countText}</p>
            {rules}
          </div>
          <p className={styles.countHint}>{t('offers.countHint')}</p>
        </div>
        <FiltersSheet open={sheet} onClose={() => setSheet(false)} value={value} onChange={onChange} onReset={onReset} categoryOptions={categoryOptions} sortOptions={sortOptions} count={count} />
      </>
    );
  }

  return (
    <>
      <div className={styles.filters} role="search" aria-label={t('offers.filters')}>
        <PillSelect label={t('offers.category')} value={value.categoryId} onChange={(categoryId) => onChange({ categoryId })} options={categoryOptions} />
        <PillSelect label={t('offers.sort')} value={value.sort} onChange={(sort) => onChange({ sort: sort as OfferSort })} options={sortOptions} />
        {approve}
        {search}
      </div>
      <div className={styles.countLine} data-desktop>
        <div className={styles.countText}>
          <p className={styles.count} data-testid="offers-count">{countText}</p>
          <span className={styles.countHint}>{t('offers.countHint')}</span>
        </div>
        <div className={styles.countActions}>
          {rules}
          <ChartSegment
            label={t('offers.view')}
            value={view}
            onChange={onView}
            showLabels
            options={[
              { value: 'cards', label: t('offers.view.cards'), icon: <LayoutGrid aria-hidden /> },
              { value: 'table', label: t('offers.view.table'), icon: <List aria-hidden /> },
            ]}
          />
        </div>
      </div>
    </>
  );
}

/** Telefon: «Filtrlar» varag'i (komponentlar-E §R4) — tanlov darhol qo'llanadi; pastda «Tozalash» va «N ta offerni ko‘rsatish». */
function FiltersSheet({ open, onClose, value, onChange, onReset, categoryOptions, sortOptions, count }: {
  open: boolean;
  onClose: () => void;
  value: OffersFilterValue;
  onChange: (patch: Partial<OffersFilterValue>) => void;
  onReset: () => void;
  categoryOptions: readonly PillOption[];
  sortOptions: readonly PillOption[];
  count: number | null;
}) {
  const { t } = useTranslation();
  const categoryId = useId();
  const sortId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('offers.filtersTitle')}
      description={t('offers.filtersText')}
      icon={<SlidersHorizontal />}
      footer={
        <>
          <DialogCancel onClick={onReset}>{t('common.clear')}</DialogCancel>
          <button type="button" className={styles.sheetApply} onClick={onClose}>
            {count === null ? t('offers.filtersShow') : t('offers.showCount', { count })}
          </button>
        </>
      }
    >
      <div className={styles.sheetField}>
        <label htmlFor={categoryId}>{t('offers.category')}</label>
        <span className={styles.sheetSelect}>
          <select id={categoryId} value={value.categoryId} onChange={(event) => onChange({ categoryId: event.target.value })}>
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown aria-hidden />
        </span>
      </div>
      <div className={styles.sheetField}>
        <label htmlFor={sortId}>{t('offers.sort')}</label>
        <span className={styles.sheetSelect}>
          <select id={sortId} value={value.sort} onChange={(event) => onChange({ sort: event.target.value as OfferSort })}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown aria-hidden />
        </span>
      </div>
      <label className={styles.sheetCheck}>
        <input type="checkbox" checked={value.approve50} onChange={(event) => onChange({ approve50: event.target.checked })} />
        <span>
          <span>{t('offers.approve50')}</span>
          <span>{t('offers.approve50Hint')}</span>
        </span>
      </label>
    </Dialog>
  );
}
