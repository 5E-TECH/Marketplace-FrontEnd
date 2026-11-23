import { Check, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useShipmentQuery } from '../../features/inbound/api/inboundQueries';
import { authorLabel, inboundActPath, personName, wholesalerLabel } from '../../features/inbound/lib/shipmentLabels';
import type { InboundShipment } from '../../features/inbound/model/inboundTypes';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { tashkentDateTime } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import styles from './AdminShipmentPage.module.css';

interface Step {
  label: string;
  meta: string | null;
  done: boolean;
}

function steps(t: ReturnType<typeof useTranslation>['t'], shipment: InboundShipment): Step[] {
  const author = authorLabel(t, shipment.declaredBy);
  const list: Step[] = [{ label: t('inb.detail.created'), meta: `${tashkentDateTime(shipment.createdAt)} · ${author.name}`, done: true }];
  if (shipment.status === 'IN_TRANSIT') list.push({ label: t('inb.detail.inTransit'), meta: null, done: true });
  const by = shipment.receivedBy?.name ? ` · ${personName(shipment.receivedBy)}` : '';
  list.push({ label: t('inb.detail.received'), meta: shipment.receivedAt ? `${tashkentDateTime(shipment.receivedAt)}${by}` : null, done: Boolean(shipment.receivedAt) });
  return list;
}

/**
 * Postavka tafsiloti (admin-postavka: «Qatorni bosing — postavka va qabul akti ochiladi»; holatlar 4, telefonda R8):
 * qabul akti — yo'l, e'lon / qabul / brak va tafsilot; PDF — hujjat-qabul-akti. Optovik e'tirozi [?] — TZ'da yo'q.
 */
export default function AdminShipmentPage() {
  const { t } = useTranslation();
  const { shipmentId } = useParams();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const query = useShipmentQuery(shipmentId);
  const shipment = query.data;
  usePageTitle(shipment?.number ?? null);

  if (query.isPending) return <PageLoader compact />;
  if (!shipment) return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('inb.detail.notFound')} />;

  const completed = Boolean(shipment.receivedAt);
  const sub = completed ? t(shipment.status === 'RECEIVED' ? 'inb.detail.noDiff' : 'inb.detail.withDiff') : t('inb.detail.pending');
  const pdf = completed ? (
    <a className={styles.pdf} href={inboundActPath(shipment.id)} target="_blank" rel="noopener"><FileText aria-hidden />PDF</a>
  ) : null;
  const numbers = (
    <div className={styles.numbers}>
      {([
        [phone ? 'inb.list.col.declared' : 'inb.detail.declared', shipment.declared],
        [phone ? 'inb.list.col.accepted' : 'inb.detail.accepted', completed ? shipment.accepted : null],
        ['inb.detail.defect', completed ? shipment.defect : null],
      ] as const).map(([label, value]) => (
        <div key={label}>
          <span>{t(label)}</span>
          <strong>{value ?? '—'}{value === null ? null : <span> {t('inb.unit')}</span>}</strong>
        </div>
      ))}
    </div>
  );
  const products: [string, string][] = shipment.items.map((item) => [
    shipment.items.length === 1 ? t('inb.detail.product') : t('inb.detail.productN', { count: item.declared }),
    phone ? item.productName : [item.productName, item.barcode].filter(Boolean).join(' · '),
  ]);
  const facts: [string, string][] = [
    ...products,
    ...(phone && shipment.items.length === 1 && shipment.items[0].barcode ? [[t('inb.detail.barcode'), shipment.items[0].barcode] as [string, string]] : []),
    [t('inb.detail.wholesaler'), wholesalerLabel(t, shipment)],
    ...(shipment.receivedBy ? [[t('inb.detail.receivedBy'), t('inb.detail.receivedByValue', { name: personName(shipment.receivedBy) })] as [string, string]] : []),
    ...(shipment.receiveComment ? [[t('inb.detail.actNote'), `«${shipment.receiveComment}»`] as [string, string]] : []),
    ...(shipment.note ? [[t('inb.detail.note'), shipment.note] as [string, string]] : []),
  ];

  return (
    <div className={styles.page} data-testid="admin-shipment">
      <section className={styles.card}>
        <div className={styles.head}>
          <div className={styles.title}>
            <h2>{phone ? t('inb.list.col.act') : t('inb.detail.act', { number: shipment.number })}</h2>
            {sub && !phone ? <span>{sub}</span> : null}
          </div>
          <div className={styles.headEnd}>
            {phone ? null : <StatusBadge family="shipment" code={shipment.status} />}
            {pdf}
          </div>
        </div>
        {phone ? <div><StatusBadge family="shipment" code={shipment.status} /></div> : null}
        {phone ? numbers : null}
        <ol className={styles.steps} data-vertical={phone || undefined}>
          {steps(t, shipment).map((step) => (
            <li key={step.label} data-done={step.done || undefined}>
              <span className={styles.marker}>
                <span className={styles.dot}>{step.done ? <Check aria-hidden /> : null}</span>
                <span className={styles.line} />
              </span>
              <span className={styles.stepText}>
                <span>{step.label}</span>
                {step.meta ? <span>{step.meta}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        {phone ? null : numbers}
        {phone ? null : (
          <div className={styles.details}>
            {facts.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
        )}
        {completed ? null : <p className={styles.note}>{t('inb.detail.actLater')}</p>}
      </section>
      {phone ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{t('inb.detail.details')}</h2>
          <dl className={styles.dl}>
            {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
