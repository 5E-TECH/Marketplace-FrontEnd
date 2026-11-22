import { ChevronRight, CircleCheck, CircleMinus, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SHIPMENT_STATUSES, type InboundWholesaler } from '../../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
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
  const approved = wholesaler.products.filter((item) => item.status === 'ACTIVE').length;
  const seen = wholesaler.cabinet?.lastSeenAt;
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
        <div><dt>{t('inb.summary.onHand')}</dt><dd>{t('inb.pieces', { count: wholesaler.onHand })}</dd></div>
        <div><dt>{t('inb.summary.awaiting')}</dt><dd>{t('inb.summary.awaitingValue', { shipments: wholesaler.awaiting.shipments, quantity: wholesaler.awaiting.quantity })}</dd></div>
        <div>
          <dt>{t('inb.summary.cabinet')}</dt>
          <dd>{wholesaler.cabinet ? t('inb.summary.cabinetActive', { time: seen ? tashkentClock(Date.parse(seen)) : '—' }) : t('inb.summary.cabinetNone')}</dd>
        </div>
      </dl>
      <p className={styles.note}>{t(wholesaler.cabinet ? 'inb.summary.cabinetText' : 'inb.summary.noCabinetText')}</p>
      <div>
        <Link className={styles.more} to="/admin/wholesalers">{t('inb.summary.card')}<ChevronRight aria-hidden /></Link>
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
