import { isAxiosError } from 'axios';
import { BookOpen, RotateCcw, Search, Tag } from 'lucide-react';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAffiliateStatsQuery, useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import {
  useAffiliateOffersQuery,
  useAllAffiliateOffersQuery,
  useCreateStreamMutation,
  type AffiliateOffer,
  type AffiliateStream,
} from '../../features/affiliate/api/offersApi';
import { feeAt } from '../../features/affiliate/lib/offerMath';
import { parsePeriod, periodRange } from '../../features/affiliate/lib/statsPeriod';
import { AdRulesDialog } from '../../features/affiliate/ui/AdRules';
import { PeriodPill } from '../../features/affiliate/ui/PeriodPill';
import { StreamReadyPanel } from '../../features/affiliate/ui/StreamReadyPanel';
import { usePublicCategoriesQuery } from '../../features/categories/api/categoryQueries';
import { useSellerProfileQuery } from '../../features/sellerProfile/api/sellerProfileApi';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { usePageStatus } from '../../shared/ui/PageHeader/pageTitle';
import { MyPagesPreview } from './components/MyPagesPreview';
import { OfferCard } from './components/OfferCard';
import { OffersSummary } from './components/OffersSummary';
import { OffersTable } from './components/OffersTable';
import { OffersToolbar, type OffersFilterValue } from './components/OffersToolbar';
import type { CreateState } from './model/createState';
import { APPROVE_THRESHOLD, DEFAULT_SORT, parseSort, readStoredView, storeView, type OffersView } from './model/offersView';
import styles from './AffiliateOffersPage.module.css';

const SKELETON_CARDS = 4;

/** Kartalar to'rining ustunlari soni (auto-fill) — «Sahifa tayyor» bosilgan karta qatoridan keyin chiqadi. */
function useGridColumns() {
  const [columns, setColumns] = useState(1);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return undefined;
    const measure = () => setColumns(Math.max(1, getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length));
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  return [ref, columns] as const;
}

/**
 * Sotuvchi «Offerlar» (FE-05, SOT-2/SOT-3; sotuvchi-offerlar): davr natijasi va balans, filtrlar,
 * offer kartalari yoki jadval, «Sahifa yaratish» bir bosishda (forma yo'q) va «Mening sahifalarim».
 * Filtr va davr URL'da; ko'rinish (karta/jadval) shu brauzerda eslab qolinadi.
 */
export default function AffiliateOffersPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [today] = useState(() => tashkentDate());
  const phone = useMediaQuery('(max-width: 767.98px)');

  const period = parsePeriod(params.get('period'));
  const { from, to } = periodRange(period, today);
  const stats = useAffiliateStatsQuery(from, to);
  const profile = useSellerProfileQuery();
  const asOf = stats.dataUpdatedAt ? tashkentClock(stats.dataUpdatedAt) : null;
  usePageStatus(t('sellerHome.statusLabel'), asOf);

  // Qidiruv matni — mahalliy holat (yozish paytida URL kutilmasin), qolgan filtrlar URL'da.
  const [searchText, setSearchText] = useState('');
  const value: OffersFilterValue = {
    search: searchText,
    categoryId: params.get('category') ?? '',
    approve50: params.get('approve') === String(APPROVE_THRESHOLD),
    sort: parseSort(params.get('sort')),
  };
  const search = useDebouncedValue(value.search, 300);
  const offers = useAffiliateOffersQuery({
    search,
    categoryId: value.categoryId || undefined,
    minApproveRate: value.approve50 ? APPROVE_THRESHOLD : undefined,
    sort: value.sort,
  });
  const allOffers = useAllAffiliateOffersQuery();
  const streams = useAffiliateStreamsQuery();
  const categories = usePublicCategoriesQuery();
  const create = useCreateStreamMutation();

  const [view, setView] = useState<OffersView>(readStoredView);
  const [states, setStates] = useState<Record<string, CreateState>>({});
  const [created, setCreated] = useState<{ stream: AffiliateStream; offer: AffiliateOffer } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [gridRef, columns] = useGridColumns();
  const catalogRef = useRef<HTMLElement>(null);

  const offersById = useMemo(() => new Map((allOffers.data?.items ?? []).map((offer) => [offer.productId, offer])), [allOffers.data]);
  const categoryOptions = useMemo(
    () => (categories.data ?? []).flatMap((category) => [category, ...category.children]).map((category) => ({ value: category.id, label: category.name })),
    [categories.data],
  );

  const update = (patch: Partial<OffersFilterValue> & { period?: string }) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        const set = (key: string, item: string | undefined) => (item ? next.set(key, item) : next.delete(key));
        if ('categoryId' in patch) set('category', patch.categoryId);
        if ('approve50' in patch) set('approve', patch.approve50 ? String(APPROVE_THRESHOLD) : undefined);
        if ('sort' in patch) set('sort', patch.sort === DEFAULT_SORT ? undefined : patch.sort);
        if ('period' in patch) set('period', patch.period);
        return next;
      },
      { replace: true },
    );
  const onFilter = (patch: Partial<OffersFilterValue>) => {
    if (patch.search !== undefined) setSearchText(patch.search);
    update(patch);
  };
  const reset = () => onFilter({ search: '', categoryId: '', approve50: false, sort: DEFAULT_SORT });

  const onCreate = (offer: AffiliateOffer) => {
    const id = offer.productId;
    setStates((current) => ({ ...current, [id]: { kind: 'creating' } }));
    create.mutate(id, {
      onSuccess: (stream) => {
        setStates((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setCreated({ stream, offer });
      },
      onError: (error) => {
        // 409 — shu payt qoldiq tugadi yoki offer yopildi: tugma yopiladi, ro'yxat yangilanadi.
        const noStock = isAxiosError(error) && error.response?.status === 409;
        setStates((current) => ({ ...current, [id]: { kind: noStock ? 'noStock' : 'failed' } }));
        if (noStock) void offers.refetch();
      },
    });
  };

  const list = offers.data?.items ?? [];
  const filtered = Boolean(search.trim() || value.categoryId || value.approve50);
  const firstOpen = list.find((offer) => offer.stock > 0)?.productId;
  const primaryId = created && list.some((offer) => offer.productId === created.offer.productId) ? created.offer.productId : firstOpen;
  const createdIndex = created ? list.findIndex((offer) => offer.productId === created.offer.productId) : -1;
  const readyAfter = createdIndex < 0 ? -1 : Math.min(list.length - 1, (Math.floor(createdIndex / columns) + 1) * columns - 1);

  const ready = (pointer?: { column: number; columns: number }) =>
    created ? (
      <StreamReadyPanel
        key={created.stream.id}
        stream={created.stream}
        variant="created"
        fee={feeAt(created.offer, created.stream.salePrice)}
        deliveryFee={created.offer.centerDeliveryFee}
        pointer={pointer}
      />
    ) : null;

  let catalog;
  if (offers.isError && !offers.data) {
    catalog = (
      <div className={styles.stateCard}>
        <LoadError variant="row" error={offers.error} onRetry={() => void offers.refetch()} title={t('offers.loadFailed')} note={t('offers.loadFailedNote')} />
      </div>
    );
  } else if (!offers.data) {
    catalog = (
      <div className={styles.grid} aria-busy="true" aria-label={t('offers.loading')}>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => <div key={index} className={styles.cardSkeleton} />)}
      </div>
    );
  } else if (!list.length && !filtered) {
    catalog = (
      <div className={`${styles.stateCard} ${styles.emptyCatalog}`}>
        <span className={styles.emptyIcon} aria-hidden><Tag /></span>
        <strong>{t('offers.emptyTitle')}</strong>
        <p>{t('offers.emptyText')}</p>
        <button type="button" className={styles.outlineButton} onClick={() => setRulesOpen(true)}>
          <BookOpen aria-hidden />
          {t('offers.emptyRules')}
        </button>
      </div>
    );
  } else if (!list.length) {
    catalog = (
      <div className={styles.stateCard}>
        <div className={styles.notFound} role="status">
          <span className={styles.emptyIcon} aria-hidden><Search /></span>
          <span className={styles.notFoundText}>
            <span>{search.trim() ? t('offers.notFound', { query: search.trim() }) : t('offers.notFoundFiltered')}</span>
            <span>{t('offers.notFoundText')}</span>
          </span>
          <button type="button" className={styles.smallButton} onClick={reset}>
            <RotateCcw aria-hidden />
            {t('offers.clearFilters')}
          </button>
        </div>
      </div>
    );
  } else if (view === 'table' && !phone) {
    catalog = (
      <>
        <OffersTable offers={list} sort={value.sort} onSort={(sort) => update({ sort })} states={states} onCreate={onCreate} asOf={asOf} />
        {ready()}
      </>
    );
  } else {
    catalog = (
      <>
        {created && createdIndex < 0 ? ready() : null}
        <div className={styles.grid} ref={gridRef}>
          {list.map((offer, index) => (
            <Fragment key={offer.productId}>
              <OfferCard offer={offer} primary={offer.productId === primaryId} state={states[offer.productId]} onCreate={() => onCreate(offer)} />
              {index === readyAfter ? <div className={styles.readyCell}>{ready({ column: createdIndex % columns, columns })}</div> : null}
            </Fragment>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <PeriodPill today={today} period={period} onChange={(next) => update({ period: next })} />
      <OffersSummary stats={stats} profile={profile.data} />
      <section className={styles.catalog} ref={catalogRef} aria-label={t('offers.catalog')}>
        <OffersToolbar
          value={value}
          onChange={onFilter}
          onReset={reset}
          categories={categoryOptions}
          count={offers.isError && !offers.data ? null : offers.data ? list.length : null}
          total={allOffers.data?.total ?? null}
          loading={offers.isPending}
          view={view}
          onView={(next) => {
            setView(next);
            storeView(next);
          }}
          onRules={() => setRulesOpen(true)}
          phone={phone}
        />
        {catalog}
      </section>
      <MyPagesPreview streams={streams} offers={offersById} onBrowse={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      <AdRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
