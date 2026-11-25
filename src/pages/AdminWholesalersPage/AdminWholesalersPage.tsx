import { PackagePlus, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useShipmentCounts } from '../../features/inbound/api/inboundQueries';
import { useWholesalersQuery } from '../../features/wholesalers/api/wholesalersQueries';
import { tabCounts } from '../../features/wholesalers/lib/wholesalerRules';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { ShipmentsTab } from './components/ShipmentsTab';
import { WholesalersTab } from './components/WholesalersTab';
import { parsePageTab, type PageTab } from './model/wholesalerList';
import styles from './AdminWholesalersPage.module.css';

/**
 * «Optoviklar» (admin): yorliqlar «Optoviklar» (FE-25, admin-optoviklar — sukut), «Postavkalar» (FE-16,
 * admin-postavka) va «Yangi arizalar» (M2: optovik kabinetda o'zi ro'yxatdan o'tgan, BE-30). Sahifa amallari —
 * «Postavka arizasi» va «Optovik qo'shish» (telefonda — «⋮» varag'i va pastki panel).
 */
export default function AdminWholesalersPage() {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [params, setParams] = useSearchParams();
  const tab = parsePageTab(params.get('tab'));
  const list = useWholesalersQuery();
  const shipments = useShipmentCounts();
  const counts = tabCounts(list.data ?? []);

  const goTab = (key: PageTab) => setParams(key === 'wholesalers' ? {} : { tab: key }, { replace: true });
  const declare = (wholesalerId?: string) => setParams({ tab: 'shipments', declare: '1', ...(wholesalerId ? { wholesaler: wholesalerId } : {}) });
  const showActions = tab === 'wholesalers' && !phone && Boolean(list.data?.length);

  const tabs: [PageTab, string, number | null][] = [
    ['wholesalers', t('inb.tab.wholesalers'), list.data ? counts.ALL : null],
    ['shipments', t('inb.tab.shipments'), shipments?.ALL ?? null],
    ['applications', t('whs.tab.applications'), list.data ? counts.PENDING : null],
  ];

  return (
    <div className={styles.page} data-testid={tab === 'shipments' ? 'admin-shipments' : 'admin-wholesalers'} data-layout={phone ? 'phone' : undefined}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={t('inb.tabsAria')}>
          {tabs.map(([key, label, count]) => (
            <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => goTab(key)}>
              {label}
              {count === null ? null : <span className={styles.count}>{count}</span>}
            </button>
          ))}
        </div>
        {showActions ? (
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryAction} onClick={() => declare()}><PackagePlus aria-hidden />{t('whs.declare')}</button>
            <Link to="/admin/wholesalers/new" className={styles.primaryAction}><Plus aria-hidden />{t('whs.add')}</Link>
          </div>
        ) : null}
      </div>

      {tab === 'shipments' ? (
        <ShipmentsTab key={params.get('wholesaler') ?? 'all'} wholesalerId={params.get('wholesaler')} focus={params.get('declare') === '1'} />
      ) : (
        <WholesalersTab key={tab} phone={phone} onDeclare={declare} applications={tab === 'applications'} />
      )}
    </div>
  );
}
