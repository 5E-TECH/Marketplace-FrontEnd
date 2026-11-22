import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useLotsQuery, useWarehouseStockQuery } from '../../features/inbound/api/inboundQueries';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { tashkentClock } from '../../shared/lib/tashkentTime';
import { ExpiryTab } from './components/ExpiryTab';
import { StockListTab } from './components/StockListTab';
import styles from './WarehouseStockPage.module.css';

type Tab = 'list' | 'expiry';

/**
 * «Qoldiq» (omborchi; FE-16): «Ro'yxat» — SKU bo'yicha qoldiq (ombor-qoldiq), «Muddat» — partiyalar va 60 kun
 * qoidasi (ombor-muddat, OMB-3). Muddati 60 kundan kam partiya omborda, lekin «mavjud»ga kirmaydi (TC4).
 */
export default function WarehouseStockPage() {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'expiry' ? 'expiry' : 'list';
  const stock = useWarehouseStockQuery();
  const lots = useLotsQuery({});
  const active = tab === 'list' ? stock : lots;
  const attention = (lots.data?.counts.BLOCKED ?? 0) + (lots.data?.counts.EXPIRED ?? 0) + (lots.data?.counts.APPROACHING ?? 0);

  return (
    <div className={styles.page} data-testid="stock-page" data-tab={tab}>
      <div className={styles.head}>
        <div className={styles.tabs} role="tablist" aria-label={t('inb.stock.tabsAria')}>
          {([['list', 'inb.stock.tabList', stock.data?.length ?? 0], ['expiry', 'inb.stock.tabExpiry', attention]] as const).map(([key, label, count]) => (
            <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => setParams(key === 'list' ? {} : { tab: key }, { replace: true })}>
              {t(label)}<span className={styles.count}>{count}</span>
            </button>
          ))}
        </div>
        {phone ? null : (
          <div className={styles.updated}>
            <span>{t('inb.stock.updated')} <strong>{active.dataUpdatedAt ? tashkentClock(active.dataUpdatedAt) : '—'}</strong></span>
            <button type="button" className={styles.refresh} onClick={() => void Promise.all([stock.refetch(), lots.refetch()])}>
              <RefreshCw aria-hidden />{t('inb.stock.refresh')}
            </button>
          </div>
        )}
      </div>
      {tab === 'list' ? <StockListTab query={stock} phone={phone} /> : <ExpiryTab phone={phone} onToList={() => setParams({}, { replace: true })} />}
    </div>
  );
}
