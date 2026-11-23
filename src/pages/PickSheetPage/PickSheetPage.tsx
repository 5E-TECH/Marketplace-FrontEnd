import { ChevronLeft, Printer } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { ROLE_LABEL_KEYS } from '../../features/auth/lib/roleLabels';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { usePickListQuery } from '../../features/fulfillment/api/fulfillmentQueries';
import { pickSheet } from '../../features/fulfillment/lib/pickRules';
import { BRAND } from '../../shared/config/brand';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { tashkentClock, tashkentDate, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { SHEET_WIDTH, useSheetScale } from '../../shared/lib/useSheetScale';
import { isoToDots } from '../../shared/ui/DateInput/dateInput';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import styles from './PickSheetPage.module.css';

/** A4 sahifaning matn maydoni (297 mm − 2 × 15 mm, 96 dpi). */
const PAGE_BODY = 1009;
const SHEET_PADDING = 57;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const cssString = (text: string) => `"${text.replace(/["\\]/g, '\\$&')}"`;
/** «{page} / {pages} bet» → CSS `content`: chop etishda har betga haqiqiy raqam. */
const cssPageContent = (template: string) => template
  .split(/(\{page\}|\{pages\})/)
  .filter(Boolean)
  .map((part) => (part === '{page}' ? 'counter(page)' : part === '{pages}' ? 'counter(pages)' : cssString(part)))
  .join(' ');

/** Ekrandagi varaq necha A4 betga tushadi (chop etishda har bet chetida 15 mm). Varaq yuklangach o'lchanadi. */
function usePageCount() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [pages, setPages] = useState(1);
  useLayoutEffect(() => {
    if (!node) return undefined;
    const measure = () => {
      const ratio = SHEET_WIDTH / (node.offsetWidth || SHEET_WIDTH);
      setPages(Math.max(1, Math.ceil((node.offsetHeight * ratio - 2 * SHEET_PADDING - 1) / PAGE_BODY)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [pages, setNode] as const;
}

const Box = ({ middle = false }: { middle?: boolean }) => <span className={middle ? styles.boxMiddle : styles.box} aria-hidden />;

/**
 * Yig'ish varaqasi (hujjat-yigish-varaqasi; FE-17): to'lqinning hali yig'ilmagan donasi — yacheyka tartibida va
 * posilkalarga taqsimlab. Yordamchi qog'oz: tovar baribir planshetda skanerlanadi (noto'g'ri tovar — OMB-2).
 * Ko'p posilkada varaq bir necha A4 betga bo'linadi — har bet ostida «n / m bet».
 */
export default function PickSheetPage() {
  const { t, language } = useTranslation();
  const [params] = useSearchParams();
  const user = useAppSelector(selectAuthUser);
  const today = tashkentDate();
  const raw = params.get('date');
  const date = raw && ISO_DATE.test(raw) ? raw : today;
  const query = usePickListQuery(date);
  const scale = useSheetScale();
  const [pages, sheetRef] = usePageCount();
  const [printedAt, setPrintedAt] = useState(() => tashkentDateTime());

  useEffect(() => {
    const previous = document.title;
    // Saqlanadigan PDF nomi — sarlavhadan.
    document.title = t('ful.sheet.fileName', { date: isoToDots(date) });
    const onBeforePrint = () => setPrintedAt(tashkentDateTime());
    window.addEventListener('beforeprint', onBeforePrint);
    return () => {
      document.title = previous;
      window.removeEventListener('beforeprint', onBeforePrint);
    };
  }, [date, t]);

  if (query.isPending) return <PageLoader />;
  if (!query.data) return <div className={styles.screen}><LoadError error={query.error} onRetry={() => void query.refetch()} /></div>;

  const tomorrow = date > today;
  const sheet = pickSheet(query.data.items, date, today);
  const dots = isoToDots(date);
  const name = user?.name ? shortPersonName(user.name) : '—';
  const role = user ? t(ROLE_LABEL_KEYS[user.role]).toLocaleLowerCase(language) : null;
  const hasCustomers = sheet.groups.some((group) => group.orders.some((order) => order.customerName));
  const footer = t('ful.sheet.footer', { date: dots });
  const printed = t('ful.sheet.printed', { date: printedAt, name });
  // Chop etishda pastki yozuv — sahifa chetida, har betda (Chrome `@page` margin box).
  const pageCss = `@page pick-sheet { @bottom-left { content: ${cssString(`${footer} · `)} ${cssPageContent(t('ful.sheet.page'))}; } @bottom-right { content: ${cssString(printed)}; } }`;

  return (
    <div className={styles.screen}>
      <style>{pageCss}</style>
      <div className={styles.toolbar}>
        <button type="button" className={styles.back} onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
          <ChevronLeft aria-hidden />{t('inb.act.back')}
        </button>
        <span className={styles.toolbarEnd}>
          <span className={styles.toolbarHint}>{t('ful.sheet.toolbarHint')}</span>
          <button type="button" className={styles.primary} disabled={!sheet.groups.length} onClick={() => window.print()}>
            <Printer aria-hidden />{t('inb.act.print')}
          </button>
        </span>
      </div>
      <div className={styles.frame} style={{ zoom: scale }}>
        <article ref={sheetRef} className={styles.sheet} aria-label={t('ful.sheet.aria', { date: dots })} data-testid="pick-sheet" data-pages={pages}>
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
              <div className={styles.wave}>
                <p className={styles.label}>{t('ful.sheet.wave')}</p>
                <p className={styles.number}>{dots}</p>
                <p className={styles.small}>{t('ful.sheet.pickup')} <span className={styles.muted}>{t('ful.wave.pickupTbd')}</span></p>
              </div>
            </header>
            <div className={styles.rule} />
            <div className={styles.titleRow}>
              <div>
                <h1>{t('ful.sheet.title')}</h1>
                <p>{t(tomorrow ? 'ful.sheet.subTomorrow' : 'ful.sheet.subToday', { cells: sheet.cells, parcels: sheet.parcels })}</p>
              </div>
              <span className={styles.stamp}>{t(tomorrow ? 'ful.sheet.stampTomorrow' : 'ful.sheet.stampToday')}</span>
            </div>
            <div className={styles.meta}>
              <div><p>{t('ful.sheet.cutoff')}</p><p>{t(tomorrow ? 'ful.sheet.cutoffTomorrow' : 'ful.sheet.cutoffToday')}</p></div>
              {sheet.lastConfirmed?.confirmedAt ? (
                <div>
                  <p>{t('ful.sheet.lastConfirm')}</p>
                  <p>{t('ful.sheet.lastConfirmValue', { time: tashkentClock(Date.parse(sheet.lastConfirmed.confirmedAt)), order: sheet.lastConfirmed.orderNumber })}</p>
                </div>
              ) : null}
              <div><p>{t('ful.sheet.parcelsPieces')}</p><p data-testid="sheet-totals">{sheet.parcels} / {sheet.pieces}</p></div>
              <div><p>{t('ful.sheet.picker')}</p><p>{role ? t('ful.sheet.pickerValue', { name, role }) : name}</p></div>
            </div>

            {sheet.groups.length ? (
              <>
                <div className={styles.sectionHead}>
                  <h2>{t('ful.sheet.takeTitle')}</h2>
                  <span>{t('ful.sheet.takeHint', { count: sheet.pieces })}</span>
                </div>
                <table className={styles.table} data-testid="sheet-take">
                  <thead>
                    <tr>
                      <th className={styles.colCell}>{t('ful.sheet.col.cell')}</th>
                      <th>{t('ful.sheet.col.product')}</th>
                      <th className={styles.colBarcode}>{t('ful.sheet.col.barcode')}</th>
                      <th className={styles.colTake}>{t('ful.sheet.col.take')}</th>
                      <th className={styles.colTaken}>{t('ful.sheet.col.taken')}</th>
                      <th className={styles.colShort}>{t('ful.sheet.col.short')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.groups.map((group) => (
                      <tr key={group.key}>
                        <td><span className={styles.cell}>{group.cell ?? '—'}</span></td>
                        <td><span className={styles.product}>{group.productName}</span></td>
                        <td><span className={styles.code}>{group.code ?? '—'}</span></td>
                        <td className={styles.take}><span>{group.quantity}</span> {t('ful.sheet.unit')}</td>
                        <td><Box /></td>
                        <td><span className={styles.line} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={styles.sectionHead}>
                  <h2>{t('ful.sheet.splitTitle')}</h2>
                  <span>{t('ful.sheet.splitHint')}</span>
                </div>
                <table className={`${styles.table} ${styles.split}`} data-testid="sheet-split">
                  <thead>
                    <tr>
                      <th className={styles.colGroup}>{t('ful.sheet.col.group')}</th>
                      <th className={styles.colNo}>{t('ful.sheet.col.no')}</th>
                      <th className={styles.colOrder}>{t('ful.sheet.col.order')}</th>
                      {hasCustomers ? <th>{t('ful.sheet.col.customer')}</th> : null}
                      <th className={styles.colQty}>{t('ful.sheet.col.qty')}</th>
                      <th className={styles.colBoxed}>{t('ful.sheet.col.boxed')}</th>
                    </tr>
                  </thead>
                  {sheet.groups.map((group) => (
                    <tbody key={group.key}>
                      {group.orders.map((order, index) => (
                          <tr key={order.taskId}>
                            {index === 0 ? (
                              <th scope="rowgroup" rowSpan={group.orders.length} className={styles.groupHead}>
                                <span className={styles.cell}>{group.cell ?? '—'}</span>
                                <span className={styles.groupSub}>{t('ful.sheet.groupSub', { product: group.productName, count: group.orders.length })}</span>
                              </th>
                            ) : null}
                            <td className={styles.nums}>{order.no}</td>
                            <td><span className={styles.order}>{order.orderNumber}</span></td>
                            {hasCustomers ? <td>{order.customerName ? shortPersonName(order.customerName) : '—'}</td> : null}
                            <td className={styles.qty}>{t('ful.sheet.qty', { count: order.quantity })}</td>
                            <td><Box middle /></td>
                          </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </>
            ) : (
              <div className={styles.empty} data-testid="sheet-empty">
                <p className={styles.emptyTitle}>{t('ful.sheet.empty')}</p>
                <p>{t('ful.sheet.emptyText')}</p>
              </div>
            )}

            <ul className={styles.notes}>
              <li><span /><span>{t('ful.sheet.noteScan')}</span></li>
              <li><span /><span>{t('ful.sheet.noteCutoff')}</span></li>
              {query.data.truncated ? <li><span /><span>{t('ful.sheet.noteTruncated')}</span></li> : null}
            </ul>
          </div>
          <footer className={styles.footer}>
            <span>{footer} · {t('ful.sheet.page', { page: pages, pages })}</span>
            <span>{printed}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
