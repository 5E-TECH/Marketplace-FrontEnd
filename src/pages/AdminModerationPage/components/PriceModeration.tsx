import { ChevronRight, Clock, Tag } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminProductQuery, usePriceQueueQuery } from '../../../features/adminProducts/api/adminProductsQueries';
import { formatKg } from '../../../features/adminProducts/lib/productFormat';
import type { PriceQueueItem } from '../../../features/adminProducts/model/adminProductTypes';
import { PriceWorkbench, type PriceOutcome } from '../../../features/adminProducts/ui/price/PriceWorkbench';
import { useAdminCategoryNames } from '../../../features/categories/api/categoryQueries';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { usePageBack } from '../../../shared/ui/PageHeader/pageTitle';
import { RefreshStatus } from './ModerationQueue';
import styles from '../AdminModerationPage.module.css';
import own from './PriceModeration.module.css';

const POLL_MS = 60_000;

interface PriceModerationProps {
  phone: boolean;
  /** Telefon: `/admin/moderation/:productId?tab=prices`. */
  routeId: string | undefined;
  tabs: ReactNode;
  bannedLink: ReactNode;
}

/** Narx ko'rib chiqilishi holati (sarlavhadagi chip): kutilmoqda, tasdiqlandi, rad etildi. */
function ReviewChip({ outcome }: { outcome: PriceOutcome | undefined }) {
  const { t } = useTranslation();
  const kind = outcome?.kind === 'approved' ? 'APPROVED' : outcome?.kind === 'rejected' ? 'REJECTED' : 'PENDING';
  return (
    <span className={own.chip} data-kind={kind} data-testid="price-review-state">
      {kind === 'PENDING' ? <Clock aria-hidden /> : null}
      {t(`anarx.review.${kind}` as TranslationKey)}
    </span>
  );
}

/**
 * «Narx» tabi (FE-13, admin-narx): narx navbati (taklif `GET /admin/moderation/prices` — optovik narxi → tavsiya),
 * tanlangan mahsulot sarlavhasi va narx kalkulyatori. Qarordan keyin mahsulot navbatdan chiqadi, «Keyingisi» ochiladi.
 * Telefonda navbat — alohida ro'yxat, mahsulot — «Orqaga: Narx navbati» sahifasi.
 */
export function PriceModeration({ phone, routeId, tabs, bannedLink }: PriceModerationProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queue = usePriceQueueQuery({ refetchInterval: POLL_MS });
  const items = useMemo(() => queue.data ?? [], [queue.data]);
  const requestedId = routeId ?? params.get('product') ?? undefined;
  // Qaror paytida tanlangan mahsulot: navbat yangilanib u chiqib ketsa ham ochiq qoladi (URL kechroq yangilanadi).
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const selectedId = requestedId ?? pinnedId ?? (phone ? undefined : items[0]?.productId);
  const product = useAdminProductQuery(selectedId).data;
  const categoryNames = useAdminCategoryNames();
  const [outcomes, setOutcomes] = useState<Record<string, PriceOutcome>>({});
  // Qaror paytidagi navbat: mahsulot navbatdan chiqqach ham «Keyingisi» shu ro'yxatdan.
  const [snapshot, setSnapshot] = useState<readonly PriceQueueItem[] | null>(null);
  // Telefon: yuqori qatordagi «orqaga» — narx navbatiga (bo'lim manzili mahsulot navbatini ochadi).
  usePageBack(phone && selectedId ? { path: '/admin/moderation?tab=prices', label: t('anarx.queue.title') } : null);

  const hrefOf = (id: string) => (phone
    ? `/admin/moderation/${encodeURIComponent(id)}?tab=prices`
    : `/admin/moderation?tab=prices&product=${encodeURIComponent(id)}`);
  const refresh = () => void queue.refetch();
  const list = snapshot ?? items;
  const index = list.findIndex((item) => item.productId === selectedId);
  const nextItem = list.slice(index + 1).find((item) => item.productId !== selectedId && !outcomes[item.productId])
    ?? list.find((item) => item.productId !== selectedId && !outcomes[item.productId]) ?? null;
  const modeNote = t('anarx.queue.note', { mode: t(`anarx.mode.${items[0]?.deliveryMode ?? 'PARTIAL'}` as TranslationKey) });

  const status = <RefreshStatus updatedAt={queue.dataUpdatedAt} onRefresh={refresh} refreshing={queue.isFetching} />;
  const priceLine = (item: PriceQueueItem) => (
    <span className={own.priceLine}>
      <span>{formatMoney(item.basePrice)}</span> → <strong>{formatMoney(item.recommended)}</strong>
    </span>
  );

  const queueError = queue.isError && !queue.data ? (
    <LoadError error={queue.error} onRetry={refresh} lastSuccessAt={queue.dataUpdatedAt} title={t('anarx.queue.loadError')} />
  ) : null;

  const empty = (
    <section className={styles.empty} data-testid="price-queue-empty">
      <span aria-hidden><Tag /></span>
      <h2>{t('anarx.queue.emptyTitle')}</h2>
      <p>{t('anarx.queue.emptyText')}</p>
    </section>
  );

  const header = product ? (
    <section className={styles.head} aria-labelledby="price-product-h">
      {phone && index >= 0 ? <p className={styles.position}>{t('anarx.queue.position', { index: index + 1, total: list.length })}</p> : null}
      <h2 id="price-product-h">{product.name}</h2>
      {phone ? <div><ReviewChip outcome={outcomes[product.id]} /></div> : null}
      <dl className={styles.facts}>
        <div><dt>{t('anarx.field.shop')}</dt><dd>{product.shop?.name ?? '—'}</dd></div>
        <div><dt>{t('anarx.field.category')}</dt><dd>{(product.categoryId && categoryNames.get(product.categoryId)) || '—'}</dd></div>
        <div><dt>{t('anarx.field.weight')}</dt><dd>{product.weightGrams === null ? '—' : t('anarx.kg', { kg: formatKg(product.weightGrams) })}</dd></div>
        {phone ? null : <div><dt>{t('anarx.field.state')}</dt><dd><ReviewChip outcome={outcomes[product.id]} /></dd></div>}
      </dl>
    </section>
  ) : null;

  const workbench = product ? (
    <PriceWorkbench
      key={product.id}
      product={product}
      phone={phone}
      next={nextItem ? { name: nextItem.name, open: () => { setSnapshot(null); void navigate(hrefOf(nextItem.productId)); } } : null}
      initialOutcome={outcomes[product.id] ?? null}
      onDecisionStart={() => {
        // Qaror qilingan mahsulot navbatdan chiqadi — tanlov unda qolsin (natija va «Keyingisi» ko'rinib tursin).
        setSnapshot(items);
        setPinnedId(product.id);
        if (!requestedId) void navigate(hrefOf(product.id), { replace: true });
      }}
      onOutcome={(outcome) => setOutcomes((previous) => ({ ...previous, [product.id]: outcome }))}
    />
  ) : selectedId ? (
    <div className={styles.detailState} aria-busy="true">
      <span className={styles.skeleton} style={{ width: '46%' }} />
      <span className={styles.skeleton} style={{ width: '100%', height: 64 }} />
      <span className={styles.skeleton} style={{ width: '100%', height: 240 }} />
    </div>
  ) : null;

  // ── Telefon: navbat ro'yxati yoki mahsulot sahifasi ──
  if (phone) {
    if (!selectedId) {
      return (
        <div className={styles.page} data-layout="phone">
          {tabs}
          {queueError ?? (
            <>
              <div className={styles.phoneStatus}>
                <RefreshStatus updatedAt={queue.dataUpdatedAt} onRefresh={refresh} refreshing={queue.isFetching} compact />
              </div>
              {queue.isSuccess && !items.length ? empty : (
                <section className={styles.phoneQueue} aria-labelledby="price-queue-h" data-testid="price-queue">
                  <h2 id="price-queue-h">{t('anarx.queue.title')} {t('anarx.queue.count', { count: items.length })}</h2>
                  <p>{t('anarx.queue.headPhone')}</p>
                  <ul>
                    {items.map((item) => (
                      <li key={item.productId}>
                        <Link to={hrefOf(item.productId)} aria-label={t('anarx.queue.openAria', { name: item.name })}>
                          <span>
                            <span>{item.name}</span>
                            <span>{item.shopName ?? '—'}</span>
                            <span className={own.phonePrice}>{formatMoney(item.basePrice)} → <strong>{t('anarx.sum', { amount: formatMoney(item.recommended) })}</strong></span>
                          </span>
                          <ChevronRight aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.phoneQueueNote}>{modeNote}</p>
                </section>
              )}
              <div>{bannedLink}</div>
            </>
          )}
        </div>
      );
    }
    return (
      <div className={styles.page} data-layout="phone">
        <div className={styles.phoneDetail}>
          {header}
          {workbench}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        {tabs}
        <div className={styles.toolbarStatus}>
          <span className={styles.toolbarRefresh}>{status}</span>
          <span className={styles.divider} aria-hidden />
          {bannedLink}
        </div>
      </div>
      {queueError ?? (queue.isSuccess && !items.length && !requestedId ? empty : (
        <div className={styles.board}>
          <section className={styles.queue} aria-labelledby="price-queue-h" data-testid="price-queue">
            <div className={styles.queueInner}>
              <div className={styles.queueHead}>
                <h2 id="price-queue-h">
                  {t('anarx.queue.title')} <span>{t('anarx.queue.reviewing')}</span>{' '}
                  {queue.isPending ? null : <span className={styles.nums}>{t('anarx.queue.count', { count: items.length })}</span>}
                </h2>
                <p>{t('anarx.queue.head')}</p>
              </div>
              <ul className={styles.queueList} aria-busy={queue.isPending || undefined}>
                {queue.isPending ? [0, 1, 2].map((key) => <li key={key}><span className={styles.queueSkeleton} /></li>) : null}
                {items.map((item) => (
                  <li key={item.productId}>
                    <Link
                      to={hrefOf(item.productId)}
                      className={styles.queueItem}
                      aria-current={item.productId === selectedId ? 'true' : undefined}
                      aria-label={t('anarx.queue.openAria', { name: item.name })}
                    >
                      <span>{item.name}</span>
                      <span>{item.shopName ?? '—'}</span>
                      {priceLine(item)}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className={styles.queueFoot}>
                <p>{modeNote}</p>
                <div className={styles.queueStatus}>{status}</div>
              </div>
            </div>
          </section>
          <div className={styles.detail} data-testid="price-detail">
            {header}
            {workbench}
          </div>
        </div>
      ))}
    </div>
  );
}
