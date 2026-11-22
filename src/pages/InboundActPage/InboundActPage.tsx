import { QRCode } from 'antd';
import { ChevronLeft, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInboundWholesalersQuery, useShipmentQuery } from '../../features/inbound/api/inboundQueries';
import { capitalize, uzNumberWords } from '../../features/inbound/lib/numberWords';
import { shipmentTally } from '../../features/inbound/lib/scanRules';
import { inboundActPath } from '../../features/inbound/lib/shipmentLabels';
import { BRAND } from '../../shared/config/brand';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { tashkentDateTime, tashkentDay } from '../../shared/lib/tashkentTime';
import { isoToDots } from '../../shared/ui/DateInput/dateInput';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import styles from './InboundActPage.module.css';

const SHEET_WIDTH = 794;
const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

/** Telefonda varaq ekranga sig'adi (A4 794 px); chop etishda — haqiqiy o'lcham. */
function useSheetScale() {
  const read = () => Math.min(1, (window.innerWidth - 32) / SHEET_WIDTH);
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const onResize = () => setScale(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

/**
 * Postavka qabul akti (hujjat-qabul-akti; FE-16 TC1): A4 varaq, «PDF yuklab olish» — brauzerning chop etish oynasi
 * («PDF sifatida saqlash»). Optovikka avtomatik yuborilmaydi — PDF qo'lda yuboriladi (FE-16, BE-17).
 * Sonlar postavkadagi bilan bir xil: «Aktdagi son tizim bilan mos».
 */
export default function InboundActPage() {
  const { t, language } = useTranslation();
  const { shipmentId } = useParams();
  const query = useShipmentQuery(shipmentId);
  const wholesalers = useInboundWholesalersQuery();
  const scale = useSheetScale();
  const shipment = query.data;

  useEffect(() => {
    if (!shipment) return undefined;
    const previous = document.title;
    // Saqlanadigan PDF nomi — sarlavhadan.
    document.title = t('inb.act.fileName', { number: shipment.number });
    return () => {
      document.title = previous;
    };
  }, [shipment, t]);

  if (query.isPending) return <PageLoader />;
  if (!shipment) return <div className={styles.screen}><LoadError error={query.error} onRetry={() => void query.refetch()} title={t('inb.detail.notFound')} /></div>;

  const toolbar = (
    <div className={styles.toolbar}>
      <button type="button" className={styles.back} onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
        <ChevronLeft aria-hidden />{t('inb.act.back')}
      </button>
      {shipment.completedAt ? (
        <span className={styles.toolbarEnd}>
          <span className={styles.toolbarHint}>{t('inb.act.pdfHint')}</span>
          <button type="button" className={styles.primary} onClick={() => window.print()}><Download aria-hidden />{t('inb.act.pdf')}</button>
        </span>
      ) : null}
    </div>
  );

  if (!shipment.completedAt) {
    return (
      <div className={styles.screen}>
        {toolbar}
        <p className={styles.notReady} data-testid="act-not-ready">{t('inb.act.notReady')}</p>
      </div>
    );
  }

  const counts = { declared: shipment.declared, accepted: shipment.accepted, defect: shipment.defect };
  const tally = shipmentTally(counts);
  const exact = shipment.status === 'RECEIVED';
  const wholesaler = wholesalers.data?.find((item) => item.id === shipment.wholesaler.id);
  const completedAt = shipment.completedAt;
  const receiver = shortPersonName(shipment.completedBy?.name ?? '');
  const lots = shipment.lots.filter((lot) => lot.expiresAt);
  const blocked = lots.filter((lot) => !lot.sellable).reduce((sum, lot) => sum + lot.quantity, 0);
  const allDefect = tally.diff === -counts.defect && !tally.shortage && !tally.surplus;
  const parts = allDefect
    ? t('inb.act.diffAllDefect')
    : [
      counts.defect ? t('inb.act.partDefect', { count: counts.defect }) : null,
      tally.shortage ? t('inb.act.partShort', { count: tally.shortage }) : null,
      tally.surplus ? t('inb.act.partSurplus', { count: tally.surplus }) : null,
    ].filter(Boolean).join(', ');
  const countNote = tally.shortage ? t('inb.act.short', { count: tally.shortage }) : tally.surplus ? t('inb.act.surplus', { count: tally.surplus }) : t('inb.act.noShort');
  const words = language === 'uz'
    ? `${[
      `${capitalize(uzNumberWords(counts.declared))} dona e’lon qilingan`,
      `${uzNumberWords(counts.accepted)} dona qabul qilingan`,
      counts.defect ? `${uzNumberWords(counts.defect)} dona brak` : null,
      tally.shortage ? `${uzNumberWords(tally.shortage)} dona kam kelgan` : null,
    ].filter(Boolean).join(', ')}.`
    : null;

  return (
    <div className={styles.screen}>
      {toolbar}
      <div className={styles.frame} style={{ zoom: scale }}>
        <article className={styles.sheet} aria-label={`${t('inb.act.title')} ${shipment.number}`} data-testid="inbound-act">
          <div className={styles.content}>
            <header className={styles.header}>
              <div className={styles.issuer}>
                <img src="/brand/elchi-app-icon.png" alt="" width={36} height={36} />
                <div>
                  <p className={styles.brand}>{BRAND.name}</p>
                  <p className={styles.small}><span className={styles.muted}>{t('inb.act.legal')}</span> · {t('inb.act.tin')} <span className={styles.muted}>{t('inb.act.tinPlaceholder')}</span></p>
                  <p className={styles.small}>{t('inb.act.warehouse')} <span className={styles.muted}>{t('inb.act.warehousePlaceholder')}</span></p>
                </div>
              </div>
              <div className={styles.actNumber}>
                <div>
                  <p className={styles.label}>{t('inb.act.number')}</p>
                  <p className={styles.number}>{shipment.number}</p>
                  <p className={styles.small}>{tashkentDay(completedAt)}</p>
                </div>
                <QRCode
                  value={`${window.location.origin}${inboundActPath(shipment.id)}`}
                  size={62}
                  type="svg"
                  bordered={false}
                  bgColor="#ffffff"
                  color="#101733"
                  aria-label={t('inb.act.qr', { number: shipment.number })}
                  className={styles.qr}
                />
              </div>
            </header>
            <div className={styles.rule} />
            <div className={styles.titleRow}>
              <div>
                <h1>{t('inb.act.title')}</h1>
                <p>{t(exact ? 'inb.act.subExact' : 'inb.act.subDiff')}</p>
              </div>
              <span className={styles.stamp} data-testid="act-status">{t(exact ? 'inb.act.chipExact' : 'inb.act.chipDiff')}</span>
            </div>
            <table className={styles.parties}>
              <tbody>
                <tr><th>{t('inb.act.consignor')}</th><td>{shipment.wholesaler.name}{shipment.wholesaler.tin ? <> · {t('inb.act.tin')} <span className={styles.nums}>{shipment.wholesaler.tin}</span></> : null}</td></tr>
                <tr><th>{t('inb.act.commissioner')}</th><td><span className={styles.muted}>{t('inb.act.legal')}</span> · {t('inb.act.tin')} <span className={styles.muted}>{t('inb.act.tinPlaceholder')}</span></td></tr>
                <tr>
                  <th>{t('inb.act.basis')}</th>
                  <td>
                    {t('inb.act.basisValue')} {wholesaler?.contractNumber ?? <span className={styles.muted}>{t('inb.act.basisPlaceholder')}</span>}
                    {wholesaler?.contractDate ? <>, <span className={styles.nums}>{isoToDots(wholesaler.contractDate)}</span></> : null}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className={styles.meta}>
              <div><p>{t('inb.act.request')}</p><p>{shipment.number}</p></div>
              <div><p>{t('inb.act.expected')}</p><p>{isoToDots(shipment.expectedAt)}</p></div>
              <div><p>{t('inb.act.completed')}</p><p>{tashkentDateTime(completedAt)}</p></div>
              <div><p>{t('inb.act.receivedBy')}</p><p>{t('inb.act.receivedByValue', { name: receiver })}</p></div>
            </div>
            <div className={styles.goodsHead}>
              <h2>{t('inb.act.goods')}</h2>
              <span>{t('inb.act.scanned')}</span>
            </div>
            <table className={styles.goods}>
              <thead>
                <tr>
                  <th className={styles.colNo}>{t('inb.act.col.no')}</th>
                  <th>{t('inb.act.col.product')}</th>
                  <th className={styles.colLot}>{t('inb.act.col.lot')}</th>
                  <th className={styles.num}>{t('inb.recv.col.declared')}</th>
                  <th className={styles.num}>{t('inb.recv.col.accepted')}</th>
                  <th className={styles.num}>{t('inb.recv.col.defect')}</th>
                  <th className={styles.num}>{t('inb.recv.col.diff')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>
                    <span className={styles.strong}>{shipment.sku.name}</span>
                    <span className={styles.subline}>{t('inb.act.skuLine', { barcode: shipment.sku.barcode ?? '—', cell: shipment.sku.cell ?? '—' })}</span>
                  </td>
                  <td>
                    {lots.length ? lots.map((lot) => (
                      <span key={lot.id} className={styles.lotLine}>
                        <span className={styles.medium}>{lot.number}</span>
                        <span className={styles.subline}>{t(lot.sellable ? 'inb.act.expiry' : 'inb.act.expiryBlocked', { date: isoToDots(lot.expiresAt) })}</span>
                      </span>
                    )) : (
                      <>
                        <span className={styles.medium}>{shipment.lots[0]?.number ?? shipment.number}</span>
                        <span className={styles.subline}>{t('inb.act.noExpiry', { category: shipment.sku.categoryName ?? '—' })}</span>
                      </>
                    )}
                  </td>
                  <td className={styles.num}>{counts.declared}</td>
                  <td className={styles.num}>{counts.accepted}</td>
                  <td className={styles.num}>{counts.defect}</td>
                  <td className={styles.num}>{signed(tally.diff)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{t('inb.act.total')}</td>
                  <td className={styles.num}>{counts.declared}</td>
                  <td className={styles.num}>{counts.accepted}</td>
                  <td className={styles.num}>{counts.defect}</td>
                  <td className={styles.num}>{signed(tally.diff)}</td>
                </tr>
              </tfoot>
            </table>
            <div className={styles.summary}>
              <div className={styles.summaryHead}>
                <p className={styles.summaryTitle}>{exact ? t('inb.act.noDiff', { accepted: counts.accepted, declared: counts.declared }) : t('inb.act.diff', { diff: signed(tally.diff), parts })}</p>
                <p className={styles.summaryNote}>{exact ? `${t('inb.act.noDefect')} · ${countNote}` : `${t('inb.act.counted', { counted: tally.counted, declared: counts.declared })} · ${countNote}`}</p>
              </div>
              {words ? <p className={styles.words}><span>{words}</span></p> : null}
              <ul className={styles.bullets}>
                <li><span /><span>{t('inb.act.toStockLead')} <strong>{t('inb.pieces', { count: counts.accepted })}</strong> {blocked ? t('inb.act.toStockTailBlocked', { blocked }) : t('inb.act.toStockTail')}</span></li>
                {counts.defect ? <li><span /><span>{t('inb.act.defectLead')} <strong>{t('inb.pieces', { count: counts.defect })}</strong> {t('inb.act.defectTail')}</span></li> : null}
                {counts.defect ? <li><span /><span>{t('inb.act.returnRule')} <span className={styles.muted}>{t('inb.recv.tbd')}</span></span></li> : null}
                {tally.shortage ? <li><span /><span>{t('inb.act.shortLine', { count: tally.shortage })}</span></li> : null}
                {tally.surplus ? <li><span /><span>{t('inb.act.surplusLine', { count: tally.surplus })}</span></li> : null}
              </ul>
            </div>
            <div className={styles.twoCols}>
              <div>
                <h2 className={styles.sectionTitle}>{t('inb.act.note')}</h2>
                <div className={styles.noteBox}>{shipment.actNote ? `«${shipment.actNote}»` : '—'}</div>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>{t('inb.act.sendTitle')}</h2>
                <p className={styles.sendText}>{t(exact ? 'inb.act.sendExact' : 'inb.act.sendText')}</p>
              </div>
            </div>
            <div className={styles.signatures}>
              {[
                { title: t('inb.act.signWarehouse'), name: t('inb.act.receivedByValue', { name: receiver }), date: t('inb.act.date', { date: tashkentDay(completedAt) }) },
                { title: t('inb.act.signWholesaler'), name: <span className={styles.muted}>{t('inb.act.fio')}</span>, date: t('inb.act.dateBlank') },
              ].map((item) => (
                <div key={item.title} className={styles.signature}>
                  <p className={styles.sectionTitle}>{item.title}</p>
                  <p className={styles.signName}>{item.name}</p>
                  <div className={styles.signRow}>
                    <div>
                      <div className={styles.signLine} />
                      <p className={styles.signCaption}>{t('inb.act.sign')}</p>
                      <p className={styles.signCaption}>{item.date}</p>
                    </div>
                    <div className={styles.seal}>{t('inb.act.stamp')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <footer className={styles.footer}>
            <span>{t('inb.act.footer', { number: shipment.number })}</span>
            <span>{t('inb.act.created', { date: tashkentDateTime(completedAt), name: receiver })}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
