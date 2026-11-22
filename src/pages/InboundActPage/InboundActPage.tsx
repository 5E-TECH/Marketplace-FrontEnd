import { App, QRCode } from 'antd';
import { ChevronLeft, Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { downloadShipmentAct } from '../../features/inbound/api/inboundApi';
import { useInboundWholesalersQuery, useShipmentQuery } from '../../features/inbound/api/inboundQueries';
import { isSellableExpiry } from '../../features/inbound/lib/expiry';
import { capitalize, uzNumberWords } from '../../features/inbound/lib/numberWords';
import { shipmentTally } from '../../features/inbound/lib/scanRules';
import { inboundActPath, personName, wholesalerLabel } from '../../features/inbound/lib/shipmentLabels';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { BRAND } from '../../shared/config/brand';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDate, tashkentDateTime, tashkentDay } from '../../shared/lib/tashkentTime';
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
 * Postavka qabul akti (hujjat-qabul-akti; FE-16 TC1): A4 varaq ekranda; «PDF yuklab olish» — server tuzgan akt
 * (BE-17 `act.pdf`), «Chop etish» — shu varaq. Optovikka avtomatik yuborilmaydi — PDF qo'lda yuboriladi.
 * Sonlar postavkadagi bilan bir xil: «Aktdagi son tizim bilan mos».
 */
export default function InboundActPage() {
  const { t, language } = useTranslation();
  const { notification } = App.useApp();
  const { shipmentId } = useParams();
  const user = useAppSelector(selectAuthUser);
  const query = useShipmentQuery(shipmentId);
  // Optovik rekvizitlari (STIR, shartnoma) — admin ro'yxatidan; omborchiga ochilishi — taklif (fe-16 §4).
  const wholesalers = useInboundWholesalersQuery(user?.role !== 'WAREHOUSE');
  const scale = useSheetScale();
  const [downloading, setDownloading] = useState(false);
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

  const download = () => {
    setDownloading(true);
    downloadShipmentAct(shipment.id, `${t('inb.act.fileName', { number: shipment.number })}.pdf`)
      .catch((error: unknown) => notification.error({ title: t('inb.act.pdfError'), description: getApiErrorMessage(error) }))
      .finally(() => setDownloading(false));
  };

  const toolbar = (
    <div className={styles.toolbar}>
      <button type="button" className={styles.back} onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
        <ChevronLeft aria-hidden />{t('inb.act.back')}
      </button>
      {shipment.receivedAt ? (
        <span className={styles.toolbarEnd}>
          <span className={styles.toolbarHint}>{t('inb.act.pdfHint')}</span>
          <button type="button" className={styles.secondary} onClick={() => window.print()}><Printer aria-hidden />{t('inb.act.print')}</button>
          <button type="button" className={styles.primary} disabled={downloading} onClick={download}><Download aria-hidden />{t('inb.act.pdf')}</button>
        </span>
      ) : null}
    </div>
  );

  if (!shipment.receivedAt) {
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
  const receivedAt = shipment.receivedAt;
  const receivedOn = tashkentDate(Date.parse(receivedAt));
  const receiver = personName(shipment.receivedBy);
  // Muddatiga qabul kunida 60 kundan kam qolgan partiya — qoldiqda, lekin sotuvga chiqmaydi.
  const blocked = shipment.items.filter((item) => item.expiryDate && !isSellableExpiry(item.expiryDate, receivedOn)).reduce((sum, item) => sum + item.accepted, 0);
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
                  <p className={styles.small}>{tashkentDay(receivedAt)}</p>
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
                <tr><th>{t('inb.act.consignor')}</th><td>{wholesalerLabel(t, shipment)}{wholesaler?.tin ? <> · {t('inb.act.tin')} <span className={styles.nums}>{wholesaler.tin}</span></> : null}</td></tr>
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
              <div><p>{t('inb.act.completed')}</p><p>{tashkentDateTime(receivedAt)}</p></div>
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
                {shipment.items.map((item, index) => {
                  const sellable = !item.expiryDate || isSellableExpiry(item.expiryDate, receivedOn);
                  return (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <span className={styles.strong}>{item.productName}</span>
                        <span className={styles.subline}>{t('inb.act.skuLine', { barcode: item.barcode ?? '—', cell: item.cell ?? '—' })}</span>
                      </td>
                      <td>
                        <span className={styles.medium}>{item.batch ?? shipment.number}</span>
                        <span className={styles.subline}>
                          {item.expiryDate ? t(sellable ? 'inb.act.expiry' : 'inb.act.expiryBlocked', { date: isoToDots(item.expiryDate) }) : t('inb.act.noExpiry')}
                        </span>
                      </td>
                      <td className={styles.num}>{item.declared}</td>
                      <td className={styles.num}>{item.accepted}</td>
                      <td className={styles.num}>{item.defect}</td>
                      <td className={styles.num}>{signed(item.accepted - item.declared)}</td>
                    </tr>
                  );
                })}
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
                <div className={styles.noteBox}>{shipment.receiveComment ? `«${shipment.receiveComment}»` : '—'}</div>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>{t('inb.act.sendTitle')}</h2>
                <p className={styles.sendText}>{t(exact ? 'inb.act.sendExact' : 'inb.act.sendText')}</p>
              </div>
            </div>
            <div className={styles.signatures}>
              {[
                { title: t('inb.act.signWarehouse'), name: t('inb.act.receivedByValue', { name: receiver }), date: t('inb.act.date', { date: tashkentDay(receivedAt) }) },
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
            <span>{t('inb.act.created', { date: tashkentDateTime(receivedAt), name: receiver })}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
