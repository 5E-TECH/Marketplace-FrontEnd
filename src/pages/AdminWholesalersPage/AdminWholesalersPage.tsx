import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInboundWholesalersQuery, useShipmentCounts } from '../../features/inbound/api/inboundQueries';
import type { InboundShipment } from '../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import PlaceholderPage from '../PlaceholderPage/PlaceholderPage';
import { DeclareForm } from './components/DeclareForm';
import { ShipmentList } from './components/ShipmentList';
import { ShipmentFlow, WholesalerSummary } from './components/SideCards';
import styles from './AdminWholesalersPage.module.css';

type Tab = 'wholesalers' | 'shipments';

/**
 * «Optoviklar» (admin): yorliqlar «Optoviklar» va «Postavkalar». «Postavkalar» — FE-16 (admin-postavka):
 * optovik nomidan e'lon formasi, tanlangan optovik, ariza yo'li va hamma postavkalar ro'yxati.
 * «Optoviklar» ro'yxati va optovik kartasi — FE-25 (admin-optoviklar); u kelguncha sukut — «Postavkalar».
 * «Yangi arizalar» (optovikning o'z ro'yxatdan o'tishi, BE-30) — M2, M1 da yo'q.
 */
export default function AdminWholesalersPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'wholesalers' ? 'wholesalers' : 'shipments';
  const wholesalersQuery = useInboundWholesalersQuery();
  const counts = useShipmentCounts();
  const wholesalers = useMemo(() => wholesalersQuery.data ?? [], [wholesalersQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  // Sukut: shartnomasi bor birinchi optovik (pilotda bitta — Namuna Savdo).
  const wholesaler = wholesalers.find((item) => item.id === selectedId) ?? wholesalers.find((item) => item.contractSigned) ?? wholesalers[0] ?? null;

  const tabs = (
    <div className={styles.tabs} role="tablist" aria-label={t('inb.tabsAria')}>
      {([['wholesalers', 'inb.tab.wholesalers', wholesalers.length], ['shipments', 'inb.tab.shipments', counts?.ALL ?? 0]] as const).map(([key, label, count]) => (
        <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} onClick={() => setParams(key === 'shipments' ? {} : { tab: key }, { replace: true })}>
          {t(label)}
          <span className={styles.count}>{count}</span>
        </button>
      ))}
    </div>
  );

  if (tab === 'wholesalers') {
    return (
      <div className={styles.page}>
        {tabs}
        <PlaceholderPage />
      </div>
    );
  }

  const onDeclared = (created: InboundShipment) => setHighlight([created.id]);
  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formRef.current?.querySelector<HTMLElement>('select, button[role="combobox"]')?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.page} data-testid="admin-shipments">
      {tabs}
      {wholesalersQuery.isError && !wholesalersQuery.data ? (
        <LoadError error={wholesalersQuery.error} onRetry={() => void wholesalersQuery.refetch()} />
      ) : (
        <div className={styles.top}>
          <div className={styles.formColumn} ref={formRef}>
            <DeclareForm key={wholesaler?.id ?? 'none'} wholesalers={wholesalers} wholesaler={wholesaler} onWholesalerChange={setSelectedId} onDeclared={onDeclared} />
          </div>
          <div className={styles.side}>
            <WholesalerSummary wholesaler={wholesaler} />
            <ShipmentFlow />
          </div>
        </div>
      )}
      <ShipmentList wholesalers={wholesalers} highlight={highlight} onCreate={focusForm} />
    </div>
  );
}
