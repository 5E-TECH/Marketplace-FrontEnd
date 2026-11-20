import { ChevronLeft, ChevronRight, CirclePause, Link2, Package, Plus, RefreshCw, RotateCcw, Search, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAffiliateStatsQuery, useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import { useAllAffiliateOffersQuery } from '../../features/affiliate/api/offersApi';
import { AdRulesDialog } from '../../features/affiliate/ui/AdRules';
import { CopyLinkButton } from '../../features/affiliate/ui/StreamLink';
import { StreamStatusBadges } from '../../features/affiliate/ui/StreamStatusBadges';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { CodeBadge } from '../../shared/ui/Badge/Badge';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { PillSelect } from '../../shared/ui/PillSelect/PillSelect';
import { SelectedStream, WhenNotAccepting } from './components/SelectedStream';
import { StreamMenu, StreamsTable } from './components/StreamsTable';
import { allTimeFrom, inTab, matchesSearch, STREAM_TABS, streamRows, streamTotals, type StreamRow, type StreamTab } from './model/streamRows';
import styles from './AffiliatePagesPage.module.css';

const parseTab = (value: string | null): StreamTab => (STREAM_TABS as readonly string[]).includes(value ?? '') ? (value as StreamTab) : 'all';

/**
 * «Mening sahifalarim» (FE-05, SOT-3; sotuvchi-sahifalarim): holat bo'yicha tablar, qidiruv va mahsulot
 * filtri, sahifalar jadvali (hamma vaqt: kliklar, lidlar, sotuvlar, daromad) va tanlangan sahifa.
 * Bitta mahsulotga bir nechta sahifa (FE-05 TC2). Telefonda — kartalar, bosilgan karta alohida ko'rinishda.
 */
export default function AffiliatePagesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [today] = useState(() => tashkentDate());
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [rulesOpen, setRulesOpen] = useState(false);
  const streams = useAffiliateStreamsQuery();
  const offers = useAllAffiliateOffersQuery();
  const items = streams.data?.items;
  const from = allTimeFrom(items ?? [], today);
  const byStream = useAffiliateStatsQuery(from, today, 'STREAM');
  const asOf = byStream.dataUpdatedAt ? tashkentClock(byStream.dataUpdatedAt) : null;

  const offersById = useMemo(() => new Map((offers.data?.items ?? []).map((offer) => [offer.productId, offer])), [offers.data]);
  const rows = useMemo(() => streamRows(items ?? [], offersById, byStream.data, today), [items, offersById, byStream.data, today]);

  const tab = parseTab(params.get('tab'));
  const [search, setSearch] = useState('');
  const productId = params.get('product') ?? '';
  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );

  const products = [...new Map(rows.map((row) => [row.stream.productId, row.stream.productName])).entries()];
  const visible = rows.filter((row) => inTab(row, tab) && matchesSearch(row, search) && (!productId || row.stream.productId === productId));
  const selectedId = params.get('id') ?? undefined;
  const selected = visible.find((row) => row.stream.id === selectedId) ?? (phone ? undefined : visible[0]);
  const phoneDetail = phone && selected ? selected : undefined;
  usePageTitle(phoneDetail ? phoneDetail.stream.code : null);

  const counts: Record<StreamTab, number> = { all: rows.length, active: rows.filter((row) => row.status === 'ACTIVE').length, stopped: rows.filter((row) => row.status !== 'ACTIVE').length };
  const outOfStock = [...new Map(rows.filter((row) => row.status === 'OUT_OF_STOCK').map((row) => [row.stream.productId, row])).values()];
  const stopped = rows.filter((row) => row.status === 'STOPPED');
  const empty = streams.data && streams.data.total === 0;
  const filtering = Boolean(search.trim() || productId);

  if (phoneDetail) {
    return (
      <div className={styles.page}>
        <button type="button" className={styles.back} onClick={() => update({ id: undefined })}>
          <ChevronLeft aria-hidden />
          {t('nav.myPages')}
        </button>
        <SelectedStream row={phoneDetail} phone />
        <PageActionBar>
          <Link to={`/affiliate/pages/${phoneDetail.stream.id}`} className={styles.barSecondary}>{t('pages.menu.settings')}</Link>
          <CopyLinkButton link={phoneDetail.stream.link} block />
        </PageActionBar>
      </div>
    );
  }

  let list;
  if (streams.isError && !streams.data) {
    list = <LoadError variant="row" error={streams.error} onRetry={() => void streams.refetch()} />;
  } else if (!streams.data) {
    list = <div className={styles.skeleton} aria-busy="true" aria-label={t('offers.loading')} />;
  } else if (empty) {
    list = (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden><Link2 /></span>
        <strong>{t('offers.myPagesEmpty')}</strong>
        <p>{t('pages.emptyText')}</p>
        <Link to="/affiliate/offers" className={styles.primaryLink}>
          <Tag aria-hidden />
          {t('pages.openOffers')}
        </Link>
      </div>
    );
  } else if (!visible.length) {
    list = (
      <div className={styles.notFound} role="status">
        <span className={styles.emptyIcon} aria-hidden><Search /></span>
        <span className={styles.notFoundText}>
          <span>{search.trim() ? t('pages.notFound', { query: search.trim() }) : t('pages.notFoundTab')}</span>
          <span>{t('pages.notFoundText', { products: products.map(([, name]) => `«${name}»`).join(', ') })}</span>
        </span>
        <span className={styles.notFoundActions}>
          {filtering ? (
            <button type="button" className={styles.smallButton} onClick={() => {
              setSearch('');
              update({ product: undefined });
            }}>
              <RotateCcw aria-hidden />
              {t('common.clear')}
            </button>
          ) : null}
          <Link to="/affiliate/offers" className={styles.smallButton}>{t('pages.openOffers')}</Link>
        </span>
      </div>
    );
  } else if (phone) {
    list = <PhoneCards rows={visible} onSelect={(id) => update({ id })} asOf={asOf} />;
  } else {
    list = (
      <div className={styles.tableScroll}>
        <StreamsTable rows={visible} selectedId={selected?.stream.id} onSelect={(id) => update({ id })} totals={streamTotals(visible)} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {outOfStock.map((row) => (
        <div key={row.stream.productId} className={styles.banner} data-tone="neutral" role="status">
          <Package aria-hidden />
          <span>
            <strong>{t('pages.stockBanner', { product: row.stream.productName })}</strong>
            <span>{t('pages.stockBannerText', { codes: rows.filter((item) => item.stream.productId === row.stream.productId).map((item) => item.stream.code).join(', ') })}</span>
          </span>
          <Link to="/affiliate/offers" className={styles.bannerAction}>
            {t('pages.otherOffers')}
            <ChevronRight aria-hidden />
          </Link>
        </div>
      ))}
      {stopped.map((row) => (
        <div key={row.stream.id} className={styles.banner} data-tone="warning" role="status">
          <CirclePause aria-hidden />
          <span>
            <strong>{t('pages.stoppedBanner', { code: row.stream.code })}</strong>
            <span>{t('pages.stoppedBannerText')}</span>
          </span>
          <button type="button" className={styles.bannerAction} onClick={() => setRulesOpen(true)}>
            {t('offers.rules')}
            <ChevronRight aria-hidden />
          </button>
        </div>
      ))}

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={t('pages.tabs')}>
          {STREAM_TABS.map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={styles.tab} onClick={() => update({ tab: value === 'all' ? undefined : value, id: undefined })}>
              {t(`pages.tab.${value}` as TranslationKey)}
              <span className={styles.tabCount}>{counts[value]}</span>
            </button>
          ))}
        </div>
        <div className={styles.filters} role="search" aria-label={t('pages.search')}>
          <span className={styles.search}>
            <Search aria-hidden />
            <input type="search" aria-label={t('offers.search')} placeholder={t(phone ? 'pages.searchShort' : 'pages.searchPlaceholder')} value={search} onChange={(event) => {
                setSearch(event.target.value);
                update({ id: undefined });
              }} />
          </span>
          <PillSelect label={t('pages.product')} value={productId} onChange={(value) => update({ product: value || undefined, id: undefined })} options={[{ value: '', label: t('offers.all') }, ...products.map(([value, label]) => ({ value, label }))]} />
          {phone ? null : (
            <Link to="/affiliate/offers" className={styles.newPage} data-plain={empty || undefined}>
              <Plus aria-hidden />
              {t('pages.newPage')}
            </Link>
          )}
        </div>
      </div>

      <section className={styles.listCard} aria-label={t('pages.list')}>
        {list}
        {streams.data && visible.length && !phone ? (
          <p className={styles.footNote}>
            <RefreshCw aria-hidden />
            {t('pages.footNote')} ·<b>{asOf ?? '—'}</b>
          </p>
        ) : null}
      </section>

      {selected && !phone ? <SelectedStream row={selected} phone={false} /> : null}
      <WhenNotAccepting />
      {phone && !empty ? (
        <PageActionBar>
          <Link to="/affiliate/offers" className={styles.barPrimary}>{t('pages.newPage')}</Link>
        </PageActionBar>
      ) : null}
      <AdRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

/** Telefon (R5): har sahifa — karta; bosilsa «Tanlangan sahifa» alohida ochiladi. */
function PhoneCards({ rows, onSelect, asOf }: { rows: readonly StreamRow[]; onSelect: (id: string) => void; asOf: string | null }) {
  const { t } = useTranslation();
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const totals = streamTotals(rows);
  return (
    <ul className={styles.cards}>
      {rows.map((row) => (
        <li key={row.stream.id} className={styles.streamCard} data-testid="stream-row">
          <button type="button" className={styles.cardOpen} onClick={() => onSelect(row.stream.id)} aria-label={t('pages.openCard', { code: row.stream.code })} />
          <div className={styles.cardTop}>
            <CodeBadge>{row.stream.code}</CodeBadge>
            <span className={styles.strong}>{row.stream.productName}</span>
            <StreamMenu stream={row.stream} label={t('pages.actionsFor', { code: row.stream.code })} />
          </div>
          <span className={styles.sub}>
            {sum(row.stream.salePrice)}
            {row.fee !== null ? ` · ${t('pages.feeShort', { amount: formatMoney(row.fee) })}` : ''}
          </span>
          <StreamStatusBadges stream={row.stream} status={row.status} />
          <div className={styles.cardStats}>
            <div><span>{t('offers.col.clicks')}</span><span>{formatMoney(row.stream.clicks)}</span></div>
            <div><span>{t('offers.col.leads')}</span><span>{formatMoney(row.stream.leads)}</span></div>
            <div><span>{t('offers.col.sales')}</span><span>{row.stream.sales === null ? '—' : formatMoney(row.stream.sales)}</span></div>
            <div data-wide>
              <span>{t('pages.col.income')}</span>
              <span>
                {row.income === null ? '—' : sum(row.income)}
                {row.hold ? <small>{t('pages.hold', { amount: formatMoney(row.hold) })}</small> : null}
              </span>
            </div>
          </div>
          <div className={styles.cardActions}>
            <CopyLinkButton link={row.stream.link} size="md" block tone="plain" />
          </div>
        </li>
      ))}
      <li className={styles.totalCard}>
        <div className={styles.totalTop}>
          <strong>{t('pages.total', { count: rows.length })}</strong>
          <span className={styles.stackEnd}>
            <strong>{totals.income === null ? '—' : sum(totals.income)}</strong>
            {totals.hold ? <span className={styles.sub}>{t('pages.hold', { amount: formatMoney(totals.hold) })}</span> : null}
          </span>
        </div>
        <div className={styles.totalStats}>
          <span>{t('offers.col.clicks')} <b>{formatMoney(totals.clicks)}</b></span>
          <span>{t('offers.col.leads')} <b>{formatMoney(totals.leads)}</b></span>
          <span>{t('offers.col.sales')} <b>{formatMoney(totals.sales)}</b></span>
        </div>
        <p className={styles.footNote}>
          <RefreshCw aria-hidden />
          <span>{t('pages.footNote')} · <b>{asOf ?? '—'}</b></span>
        </p>
      </li>
    </ul>
  );
}
