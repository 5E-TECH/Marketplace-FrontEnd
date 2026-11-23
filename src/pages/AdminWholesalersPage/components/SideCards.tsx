import { ChevronRight, CircleCheck, CircleMinus, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAwaitingShipments, useWholesalerProductsQuery } from '../../../features/inbound/api/inboundQueries';
import { SHIPMENT_STATUSES, type InboundWholesaler } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../AdminWholesalersPage.module.css';

/** «Namuna Savdo MChJ · tanlangan optovik»: holat, shartnoma, tasdiqlangan mahsulot, qoldiq, kutilayotgan postavkalar. */
export function WholesalerSummary({ wholesaler }: { wholesaler: InboundWholesaler | null }) {
  const { t } = useTranslation();
  if (!wholesaler) {
    return (
      <section className={styles.card}>
        <p className={styles.note}>{t('inb.summary.empty')}</p>
      </section>
    );
  }
  return <Summary wholesaler={wholesaler} />;
}

function Summary({ wholesaler }: { wholesaler: InboundWholesaler }) {
  const { t } = useTranslation();
  const products = useWholesalerProductsQuery(wholesaler.id).data ?? [];
  const awaiting = useAwaitingShipments(wholesaler.id).items;
  const approved = products.filter((item) => item.status === 'ACTIVE' && item.cpaEnabled).length;
  const onHand = products.reduce((sum, item) => sum + item.onHand, 0);
  const quantity = awaiting.reduce((sum, item) => sum + item.declared, 0);
  return (
    <section className={styles.card} data-testid="wholesaler-summary">
      <div className={styles.cardHead}>
        <h2>{wholesaler.name}</h2>
        <span className={styles.cardSub}>{t('inb.summary.selected')}</span>
      </div>
      <div className={styles.chips}>
        {wholesaler.status === 'ACTIVE'
          ? <Badge tone="success" icon={CircleCheck}>{t('inb.summary.statusActive')}</Badge>
          : <Badge tone="neutral" icon={CircleMinus}>{t('inb.summary.statusSuspended')}</Badge>}
        {wholesaler.contractSigned
          ? <Badge tone="success" icon={FileCheck}>{t('inb.summary.contract')}</Badge>
          : <Badge tone="danger">{t('inb.summary.noContract')}</Badge>}
      </div>
      <dl className={styles.facts}>
        <div><dt>{t('inb.summary.approved')}</dt><dd>{t('inb.summary.approvedValue', { count: approved })}</dd></div>
        <div><dt>{t('inb.summary.onHand')}</dt><dd>{t('inb.pieces', { count: onHand })}</dd></div>
        <div><dt>{t('inb.summary.awaiting')}</dt><dd>{t('inb.summary.awaitingValue', { shipments: awaiting.length, quantity })}</dd></div>
        <div><dt>{t('inb.summary.cabinet')}</dt><dd>{t(wholesaler.hasCabinet ? 'inb.summary.cabinetActive' : 'inb.summary.cabinetNone')}</dd></div>
      </dl>
      <p className={styles.note}>{t(wholesaler.hasCabinet ? 'inb.summary.cabinetText' : 'inb.summary.noCabinetText')}</p>
      <div>
        <Link className={styles.more} to="/admin/wholesalers?tab=wholesalers">{t('inb.summary.card')}<ChevronRight aria-hidden /></Link>
      </div>
    </section>
  );
}

/** «Ariza yo'li · holatlar»: har holat chipi va qisqa izohi. */
export function ShipmentFlow() {
  const { t } = useTranslation();
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>{t('inb.flow.title')}</h2>
        <span className={styles.cardSub}>{t('inb.flow.sub')}</span>
      </div>
      <ul className={styles.flow}>
        {SHIPMENT_STATUSES.map((status) => (
          <li key={status}>
            <StatusBadge family="shipment" code={status} />
            <span>
              {t(`inb.flow.${status}`)}
              {status === 'IN_TRANSIT' ? <> <span className={styles.muted}>{t('inb.flow.tbd')}</span></> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
