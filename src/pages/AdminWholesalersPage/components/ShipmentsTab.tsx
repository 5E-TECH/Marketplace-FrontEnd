import { useEffect, useMemo, useRef, useState } from 'react';
import { useInboundWholesalersQuery } from '../../../features/inbound/api/inboundQueries';
import type { InboundShipment } from '../../../features/inbound/model/inboundTypes';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { DeclareForm } from './DeclareForm';
import { ShipmentList } from './ShipmentList';
import { ShipmentFlow, WholesalerSummary } from './SideCards';
import styles from '../AdminWholesalersPage.module.css';

interface ShipmentsTabProps {
  /** «Postavka arizasi — nomidan» (optoviklar ro'yxati yoki kartasidan): shu optovik tanlangan bo'ladi. */
  wholesalerId: string | null;
  /** «Postavka arizasi» bosilgan — forma ko'rinadigan joyga suriladi va fokus oladi. */
  focus: boolean;
}

/**
 * «Postavkalar» (FE-16, admin-postavka): optovik nomidan e'lon formasi, tanlangan optovik, ariza yo'li va hamma
 * postavkalar ro'yxati.
 */
export function ShipmentsTab({ wholesalerId, focus }: ShipmentsTabProps) {
  const wholesalersQuery = useInboundWholesalersQuery();
  const wholesalers = useMemo(() => wholesalersQuery.data ?? [], [wholesalersQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(wholesalerId);
  const [highlight, setHighlight] = useState<string[]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  // Sukut: shartnomasi bor birinchi optovik (pilotda bitta — Namuna Savdo).
  const wholesaler = wholesalers.find((item) => item.id === selectedId) ?? wholesalers.find((item) => item.contractSigned) ?? wholesalers[0] ?? null;

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formRef.current?.querySelector<HTMLElement>('select, button[role="combobox"]')?.focus({ preventScroll: true });
  };
  const ready = wholesalers.length > 0;
  useEffect(() => {
    if (focus && ready) focusForm();
  }, [focus, ready]);

  const onDeclared = (created: InboundShipment) => setHighlight([created.id]);

  return (
    <>
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
    </>
  );
}
