import { FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useShipmentsQuery } from '../../../features/inbound/api/inboundQueries';
import { adminShipmentPath, arrivalNote, authorLabel, inboundActPath, shipmentTitle } from '../../../features/inbound/lib/shipmentLabels';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import styles from '../AdminWholesalerPage.module.css';

/**
 * Optovik postavkalari (admin-optovik-karta «Postavkalar», BE-17 `GET /admin/inventory/shipments?wholesalerId`):
 * oxirgi ariza tepada; qator — postavka tafsiloti. «Umumiy» da — oxirgi 5 ta, yorlig'ida — hammasi.
 */
export function WholesalerShipments({ wholesalerId, phone, limit }: { wholesalerId: string; phone: boolean; limit?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useShipmentsQuery({ page: 1, limit: limit ?? 100, wholesalerId });
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} variant="row" />;
  if (query.isPending) return <div className={styles.skeleton} aria-busy="true" style={{ height: 160 }} />;
  const items = query.data.items;
  const total = query.data.total;
  if (!items.length) return <p className={styles.muted}>{t('whk.ship.empty')}</p>;
  const counted = (value: number, received: boolean) => (received ? String(value) : '—');

  const footer = <p className={styles.footer}>{t('whk.ship.note')} {t('whk.ship.shown', { to: items.length, total })}</p>;

  if (phone) {
    return (
      <>
        <ul className={styles.rowList}>
          {items.map((shipment) => {
            const item = shipment.items[0];
            return (
              <li key={shipment.id}>
                <Link to={adminShipmentPath(shipment.id)} className={styles.rowLink}>
                  <span className={styles.rowTop}><span className={styles.rowName}>{shipment.number} · {shipmentTitle(t, shipment)}</span><StatusBadge family="shipment" code={shipment.status} /></span>
                  <span className={styles.rowSub}>{[formatCsvDate(shipment.expectedAt), arrivalNote(t, shipment), t('whk.ship.declaredPhone', { count: item?.declared ?? 0 })].filter(Boolean).join(' · ')}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {footer}
      </>
    );
  }

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="wholesaler-shipments">
          <caption className={styles.visuallyHidden}>{t('whk.ship.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('inb.list.col.number')}</th>
              <th scope="col">{t('whk.prod.col.product')}</th>
              <th scope="col" data-wide>{t('inb.list.col.expected')}</th>
              <th scope="col" data-end>{t('inb.list.col.declared')}</th>
              <th scope="col" data-end>{t('inb.list.col.accepted')}</th>
              <th scope="col" data-end>{t('inb.list.col.defect')}</th>
              <th scope="col">{t('inb.list.col.status')}</th>
              <th scope="col" data-wide>{t('inb.list.col.author')}</th>
              <th scope="col" data-end data-wide>{t('inb.list.col.act')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((shipment) => {
              const received = Boolean(shipment.receivedAt);
              const sum = (pick: (row: (typeof shipment.items)[number]) => number) => shipment.items.reduce((total, row) => total + pick(row), 0);
              const author = authorLabel(t, shipment.declaredBy);
              const note = arrivalNote(t, shipment);
              return (
                <tr key={shipment.id} className={styles.clickRow} onClick={(event) => { if (!(event.target as HTMLElement).closest('a')) void navigate(adminShipmentPath(shipment.id)); }}>
                  <td><Link to={adminShipmentPath(shipment.id)} className={styles.name}>{shipment.number}</Link></td>
                  <td>
                    <span className={styles.stack}>
                      <span className={styles.main}>{shipmentTitle(t, shipment)}</span>
                      <span className={styles.sub}>{shipment.items[0]?.barcode ?? '—'}</span>
                    </span>
                  </td>
                  <td data-wide>
                    <span className={styles.stack}>
                      <span>{formatCsvDate(shipment.expectedAt)}</span>
                      {note ? <span className={styles.sub}>{note}</span> : null}
                    </span>
                  </td>
                  <td data-end>{sum((row) => row.declared)}</td>
                  <td data-end>{counted(sum((row) => row.accepted), received)}</td>
                  <td data-end>{counted(sum((row) => row.defect), received)}</td>
                  <td><StatusBadge family="shipment" code={shipment.status} /></td>
                  <td data-wide>
                    <span className={styles.stack}>
                      <span>{author.name}</span>
                      <span className={styles.sub}>{author.sub}</span>
                    </span>
                  </td>
                  <td data-end data-wide>
                    {received
                      ? <a className={styles.pdf} href={inboundActPath(shipment.id)} target="_blank" rel="noopener"><FileText aria-hidden />{t('inb.list.pdf')}</a>
                      : <span className={styles.sub}>{t('inb.list.actLater')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  );
}
