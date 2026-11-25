import { App } from 'antd';
import { ChevronRight, Download, FileCheck, FileText, FileUp, Lock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAdminProductsQuery } from '../../../features/adminProducts/api/adminProductsQueries';
import { getWholesalerContractLink, getWholesalerDocumentLink } from '../../../features/wholesalers/api/wholesalersApi';
import {
  useWholesalerActsQuery,
  useWholesalerAuditQuery,
  useWholesalerDocumentsQuery,
  useWholesalerSettlementsQuery,
  useWholesalerStockQuery,
} from '../../../features/wholesalers/api/wholesalersQueries';
import { displayPhone, hasContract } from '../../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler, WholesalerAuditEntry, WholesalerSettlement } from '../../../features/wholesalers/model/wholesalerTypes';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { downloadFile } from '../../../shared/api/download';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge/Badge';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { CardDialog, DialogOptions } from '../model/cardView';
import { Card, Money, Tile } from './GeneralTab';
import styles from '../AdminWholesalerPage.module.css';

type T = ReturnType<typeof useTranslation>['t'];

interface TabProps {
  wholesaler: Wholesaler;
  phone: boolean;
}

const Loading = () => <div className={styles.skeleton} aria-busy="true" style={{ height: 140 }} />;
const num = (value: number) => formatMoney(value);

/**
 * «Qoldiq»: optovik SKU larining ombordagi holati (BE-16/17 `GET /admin/inventory/stock?shopId`) — omborda, bandda,
 * mavjud, brak va sotuvdan chiqarilgan (muddati o'tgan partiya). Harakatlar va partiyalar — «Qoldiq» sahifasida.
 */
export function StockTab({ wholesaler, phone }: TabProps) {
  const { t } = useTranslation();
  const stock = useWholesalerStockQuery(wholesaler.id);
  if (stock.isError) return <LoadError error={stock.error} onRetry={() => void stock.refetch()} variant="page" />;
  if (!stock.data) return <Loading />;
  const rows = stock.data;
  const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const link = <Link to="/admin/inventory" className={styles.link}>{t('whk.stock.link')}<ChevronRight aria-hidden /></Link>;
  return (
    <div className={styles.general}>
      <div className={styles.tiles}>
        <Tile label={t('whk.goods.onHand')} value={num(sum((row) => row.onHand))} unit={t('whs.kpi.stockUnit')} sub={t('whk.stock.onHandSub')} />
        <Tile label={t('whk.prod.col.reserved')} value={num(sum((row) => row.reserved))} unit={t('whs.kpi.stockUnit')} sub={t('whk.stock.reservedSub')} />
        <Tile label={t('whk.prod.col.available')} value={num(sum((row) => row.available))} unit={t('whs.kpi.stockUnit')} sub={t('whk.stock.availableSub')} tone="sunken" />
        <Tile label={t('whk.goods.defect')} value={num(sum((row) => row.defect))} unit={t('whs.kpi.stockUnit')} sub={t('whk.stock.defectSub')} />
        <Tile label={t('whk.stock.blocked')} value={num(sum((row) => row.blocked))} unit={t('whs.kpi.stockUnit')} sub={t('whk.stock.blockedSub')} />
      </div>
      <Card title={t('whk.stock.title')} sub={t('whk.stock.sub', { count: rows.length })} labelledBy="whk-stock" aside={phone ? null : link}>
        {!rows.length ? <p className={styles.muted}>{t('whk.stock.empty')}</p> : phone ? (
          <ul className={styles.rowList}>
            {rows.map((row) => (
              <li key={row.variantId}>
                <div className={styles.rowLink}>
                  <span className={styles.rowTop}><span className={styles.rowName}>{row.name}</span><span className={styles.strong}>{t('whk.stock.phoneAvailable', { count: row.available })}</span></span>
                  <span className={styles.rowSub}>{[row.barcode, row.cell ? t('whk.stock.cell', { cell: row.cell }) : null].filter(Boolean).join(' · ')}</span>
                  <span className={styles.rowSub}>{t('whk.stock.phoneLine', { onHand: row.onHand, reserved: row.reserved, defect: row.defect })}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="wholesaler-stock">
              <caption className={styles.visuallyHidden}>{t('whk.stock.title')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('whk.prod.col.product')}</th>
                  <th scope="col" data-wide>{t('whk.stock.col.cell')}</th>
                  <th scope="col" data-end>{t('whk.prod.col.onHand')}</th>
                  <th scope="col" data-end>{t('whk.prod.col.reserved')}</th>
                  <th scope="col" data-end>{t('whk.prod.col.available')}</th>
                  <th scope="col" data-end>{t('whk.prod.col.defect')}</th>
                  <th scope="col" data-end data-wide>{t('whk.stock.blocked')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.variantId}>
                    <td>
                      <span className={styles.stack}>
                        {row.productId ? <Link to={`/admin/products/${encodeURIComponent(row.productId)}?tab=stock`} className={styles.name}>{row.name}</Link> : <span className={styles.main}>{row.name}</span>}
                        <span className={styles.sub}>{row.barcode ?? '—'}</span>
                      </span>
                    </td>
                    <td data-wide>{row.cell ?? '—'}</td>
                    <td data-end>{num(row.onHand)}</td>
                    <td data-end>{num(row.reserved)}</td>
                    <td data-end className={styles.strong}>{num(row.available)}</td>
                    <td data-end>{num(row.defect)}</td>
                    <td data-end data-wide>{num(row.blocked)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('whk.stock.total', { count: rows.length })}</td>
                  <td data-wide />
                  <td data-end>{num(sum((row) => row.onHand))}</td>
                  <td data-end>{num(sum((row) => row.reserved))}</td>
                  <td data-end>{num(sum((row) => row.available))}</td>
                  <td data-end>{num(sum((row) => row.defect))}</td>
                  <td data-end data-wide>{num(sum((row) => row.blocked))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {phone ? <div>{link}</div> : null}
        <p className={styles.note}>{t('whk.stock.note')}</p>
      </Card>
    </div>
  );
}

/**
 * «Qaytgan va brak»: qaytgan (omborda saralanmoqda / Elchi'da qaytmoqda) va brak (qabulda / qaytgan tovardan) — taklif
 * §6; optovikka yuboriladigan brak va qabul aktlari — taklif §5 (har biridan «Yuborish»). Olib ketish tartibi — TZ'da yo'q.
 */
export function ReturnsTab({ wholesaler, phone, onDialog }: TabProps & { onDialog: (dialog: CardDialog, options?: DialogOptions) => void }) {
  const { t } = useTranslation();
  const acts = useWholesalerActsQuery(wholesaler.id);
  const goods = wholesaler.stats?.goods;
  const list = (acts.data ?? []).filter((act) => act.kind !== 'SETTLEMENT');
  const canSend = hasContract(wholesaler) && wholesaler.status !== 'PENDING';
  const send = (actId: string) => onDialog('act', { actId });
  const sent = (at: string | null) => (at ? t('whk.ret.sentAt', { when: tashkentDateTime(at) }) : t('whk.ret.notSent'));
  return (
    <div className={styles.general}>
      <div className={styles.tiles}>
        <Tile label={t('whk.goods.returned')} value={num(goods?.returned ?? 0)} unit={t('whs.kpi.stockUnit')} sub={goods ? t('whk.goods.returnedSub', { sorting: goods.returnedSorting, elchi: goods.returnedInElchi }) : ''} />
        <Tile label={t('whk.goods.defect')} value={num(goods?.defect ?? 0)} unit={t('whs.kpi.stockUnit')} sub={goods ? t('whk.goods.defectSub', { receiving: goods.defectReceiving, returns: goods.defectReturns }) : ''} />
      </div>
      <Card title={t('whk.ret.title')} sub={t('whk.ret.sub')} labelledBy="whk-returns">
        {acts.isError ? <LoadError error={acts.error} onRetry={() => void acts.refetch()} variant="row" /> : !acts.data ? <Loading /> : !list.length ? (
          <p className={styles.muted}>{t('whk.ret.empty')}</p>
        ) : phone ? (
          <ul className={styles.rowList}>
            {list.map((act) => (
              <li key={act.id}>
                <div className={styles.rowLink}>
                  <span className={styles.rowTop}><span className={styles.rowName}>{t(`whd.act.kind.${act.kind}` as TranslationKey, { code: act.code })}</span>{canSend ? <button type="button" className={styles.ghost} onClick={() => send(act.id)}><Send aria-hidden />{t('whk.ret.send')}</button> : null}</span>
                  <span className={styles.rowSub}>{act.title}</span>
                  <span className={styles.rowSub}>{sent(act.sentAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="wholesaler-acts">
              <caption className={styles.visuallyHidden}>{t('whk.ret.title')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('whk.ret.col.act')}</th>
                  <th scope="col">{t('whk.ret.col.content')}</th>
                  <th scope="col" data-wide>{t('whk.ret.col.date')}</th>
                  <th scope="col">{t('whk.ret.col.sent')}</th>
                  <th scope="col" className={styles.actionCell}><span className={styles.visuallyHidden}>{t('whs.col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((act) => (
                  <tr key={act.id}>
                    <td className={styles.strong}>{t(`whd.act.kind.${act.kind}` as TranslationKey, { code: act.code })}</td>
                    <td>{act.title}</td>
                    <td data-wide>{act.at ? formatCsvDate(act.at) : '—'}</td>
                    <td><span className={styles.sub}>{sent(act.sentAt)}</span></td>
                    <td className={styles.actionCell}>{canSend ? <button type="button" className={styles.ghost} onClick={() => send(act.id)}><Send aria-hidden />{t('whk.ret.send')}</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>{t('whk.ret.note')} <span className={styles.tbd}>{t('whs.tbd')}</span></p>
      </Card>
    </div>
  );
}

const SETTLEMENT_TONE: Record<WholesalerSettlement['status'], BadgeTone> = { READY: 'info', EXPORTED: 'warning', PAID: 'success', NETTED: 'neutral', VOID: 'neutral' };

/**
 * «Pul va aktlar»: «Umumiy» dagi pul bloki (taklif §7) va hamma akt-sverkalar (BE-33 `GET /admin/finance/settlements`)
 * — davr, holat, o'tkaziladigan, qarzga ushlangan, to'langan, PDF.
 */
export function MoneyTab({ wholesaler, phone }: TabProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const settlements = useWholesalerSettlementsQuery(wholesaler.id);
  const pdf = async (item: WholesalerSettlement) => {
    try {
      await downloadFile(`/admin/finance/settlements/${encodeURIComponent(item.id)}/act.pdf`, `${item.number}.pdf`);
    } catch (error) {
      notification.error({ title: t('whk.money.pdfError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
    }
  };
  const period = (item: WholesalerSettlement) => `${formatCsvDate(item.periodStart).slice(0, 5)}–${formatCsvDate(item.periodEnd)}`;
  const sum = (value: number | null | undefined) => (value === null || value === undefined ? '—' : t('whs.money', { amount: num(value) }));
  const badge = (item: WholesalerSettlement) => <Badge tone={SETTLEMENT_TONE[item.status]}>{t(`whk.settle.${item.status}` as TranslationKey)}</Badge>;
  const items = settlements.data ?? [];
  return (
    <div className={styles.general}>
      <Money wholesaler={wholesaler} phone={phone} tabLink={false} />
      <Card title={t('whk.settle.title')} sub={t('whk.settle.sub')} labelledBy="whk-settlements">
        {settlements.isError ? <LoadError error={settlements.error} onRetry={() => void settlements.refetch()} variant="row" /> : !settlements.data ? <Loading /> : !items.length ? (
          <p className={styles.muted}>{t('whk.settle.empty')}</p>
        ) : phone ? (
          <ul className={styles.rowList}>
            {items.map((item) => (
              <li key={item.id}>
                <div className={styles.rowLink}>
                  <span className={styles.rowTop}><span className={styles.rowName}>{item.number} · {period(item)}</span>{badge(item)}</span>
                  <span className={styles.rowSub}>{t('whk.settle.phoneLine', { amount: num(item.totalAmount), debt: num(item.debtDeducted) })}</span>
                  <button type="button" className={styles.pdfButton} onClick={() => void pdf(item)}><FileText aria-hidden />PDF</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="wholesaler-settlements">
              <caption className={styles.visuallyHidden}>{t('whk.settle.title')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('whk.settle.col.act')}</th>
                  <th scope="col">{t('whk.settle.col.period')}</th>
                  <th scope="col">{t('whk.prod.col.status')}</th>
                  <th scope="col" data-end>{t('whk.settle.col.amount')}</th>
                  <th scope="col" data-end data-wide>{t('whk.settle.col.debt')}</th>
                  <th scope="col" data-wide>{t('whk.settle.col.paid')}</th>
                  <th scope="col" data-end>{t('whk.settle.col.pdf')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.strong}>{item.number}</td>
                    <td>
                      <span className={styles.stack}>
                        <span>{period(item)}</span>
                        <span className={styles.sub}>{t('whk.settle.prepared', { when: tashkentDateTime(item.createdAt) })}</span>
                      </span>
                    </td>
                    <td>{badge(item)}</td>
                    <td data-end>{sum(item.totalAmount)}</td>
                    <td data-end data-wide>{sum(item.debtDeducted)}</td>
                    <td data-wide>{item.paidAt ? tashkentDateTime(item.paidAt) : <span className={styles.sub}>{t('whk.settle.notPaid')}</span>}</td>
                    <td data-end><button type="button" className={styles.pdfButton} onClick={() => void pdf(item)}><FileText aria-hidden />PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>{t('whk.settle.note')}</p>
      </Card>
    </div>
  );
}

/**
 * «Hujjatlar»: komissiya shartnomasi (skan — taklif §3, elektron — BE-30) va optovik hujjatlari (BE-30 KYC,
 * mahsulot sertifikatlari). Hamma fayl yopiq — 10 daqiqalik imzolangan havola bilan ochiladi.
 */
export function DocumentsTab({ wholesaler, phone, onDialog }: TabProps & { onDialog: (dialog: CardDialog, options?: DialogOptions) => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const documents = useWholesalerDocumentsQuery(wholesaler.id);
  const products = useAdminProductsQuery({ tab: 'ALL', search: '', page: 1, limit: 100, shopId: wholesaler.id });
  const productName = (id: string | null) => (id ? products.data?.items.find((item) => item.id === id)?.name ?? `#${id}` : null);
  const open = async (link: () => Promise<string>) => {
    try {
      window.open(await link(), '_blank', 'noopener');
    } catch (error) {
      notification.error({ title: t('whk.contract.openError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
    }
  };
  type Row = { key: string; icon: ReactNode; name: string; kind: string; product: string | null; productId: string | null; at: string | null; onOpen: () => void };
  const rows: Row[] = [];
  if (wholesaler.contractFile) {
    const file = wholesaler.contractFile;
    rows.push({ key: file.id, icon: <FileText />, name: file.fileName, kind: t('whk.doc.kind.contract'), product: null, productId: null, at: file.uploadedAt, onOpen: () => void open(() => getWholesalerDocumentLink({ id: wholesaler.id, documentId: file.id })) });
  }
  if (wholesaler.contractAcceptedAt) {
    rows.push({ key: 'electronic', icon: <FileCheck />, name: t('whk.contract.electronic'), kind: t('whk.doc.kind.electronic'), product: null, productId: null, at: wholesaler.contractAcceptedAt, onOpen: () => void open(() => getWholesalerContractLink(wholesaler.id)) });
  }
  for (const document of documents.data ?? []) {
    rows.push({
      key: document.id, icon: <FileText />, name: document.fileName, kind: t(`whk.doc.kind.${document.kind}` as TranslationKey), product: productName(document.productId), productId: document.productId,
      at: document.createdAt, onOpen: () => void open(() => getWholesalerDocumentLink({ id: wholesaler.id, documentId: document.id })),
    });
  }
  const upload = hasContract(wholesaler) ? null : <button type="button" className={styles.outlineAction} onClick={() => onDialog('contract')}><FileUp aria-hidden />{t('whk.head.uploadContract')}</button>;
  return (
    <Card title={t('whk.doc.title')} sub={t('whk.doc.sub', { count: rows.length })} labelledBy="whk-documents" aside={phone ? null : upload}>
      {documents.isError ? <LoadError error={documents.error} onRetry={() => void documents.refetch()} variant="row" /> : null}
      {!rows.length && documents.data ? <p className={styles.muted}>{t('whk.doc.empty')}</p> : (
        <ul className={styles.files} data-testid="wholesaler-documents">
          {rows.map((row) => (
            <li key={row.key}>
              <span className={styles.fileIcon} aria-hidden>{row.icon}</span>
              <span className={styles.fileBody}>
                <span className={styles.fileTop}>
                  <span className={styles.fileName}>{row.name}</span>
                  <Lock aria-hidden />
                  <span className={styles.visuallyHidden}>{t('whd.file.private')}</span>
                  <span className={styles.fileMeta}>{row.kind}</span>
                </span>
                <span className={styles.sub}>
                  {[row.at ? tashkentDay(row.at) : null].filter(Boolean).join(' · ')}
                  {row.product && row.productId ? <> · <Link to={`/admin/products/${encodeURIComponent(row.productId)}`} className={styles.inlineLink}>{row.product}</Link></> : null}
                </span>
              </span>
              <button type="button" className={styles.iconButton} aria-label={t('whk.contract.open', { name: row.name })} title={t('whk.contract.open', { name: row.name })} onClick={row.onOpen}><Download aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      {phone && upload ? <div>{upload}</div> : null}
      <p className={styles.note}>{t('whk.contract.privateNote')}</p>
    </Card>
  );
}

const FIELD_KEYS: Record<string, TranslationKey> = {
  name: 'whf.name', legalType: 'whk.req.type', tin: 'whk.req.tin', directorName: 'whk.req.director', address: 'whk.req.address', phone: 'whk.req.phone',
  bankName: 'whk.req.bank', bankMfo: 'whk.req.mfo', bankAccount: 'whk.req.account', contractNumber: 'whd.contract.number', contractDate: 'whd.contract.date', description: 'whk.hist.description',
};

/** Audit yozuvi matni (BE-07 `wholesaler.*` va taklif amallari). */
function historyText(entry: WholesalerAuditEntry, t: T): string {
  const meta = entry.meta;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  switch (entry.action) {
    case 'wholesaler.create':
      return t('whk.hist.create');
    case 'wholesaler.update': {
      const changes = (meta.changes && typeof meta.changes === 'object' ? meta.changes : {}) as Record<string, unknown>;
      if (changes.status === 'SUSPENDED') return text(changes.reason) ? t('whk.hist.suspendedReason', { reason: text(changes.reason) }) : t('whk.hist.suspended');
      if (changes.status === 'ACTIVE') return t('whk.hist.resumed');
      const fields = Object.keys(changes).filter((key) => FIELD_KEYS[key]).map((key) => t(FIELD_KEYS[key]));
      return fields.length ? t('whk.hist.updated', { fields: fields.join(', ') }) : t('whk.hist.updatedPlain');
    }
    case 'wholesaler.contract.upload':
      return t('whk.hist.contract', { number: text(meta.contractNumber) || '—', date: text(meta.contractDate) ? formatCsvDate(text(meta.contractDate)) : '—' });
    case 'wholesaler.owner.link':
      return t('whk.hist.invite', { phone: displayPhone(text(meta.phone) || null) });
    case 'wholesaler.review':
      return meta.decision === 'REJECT' ? t('whk.hist.rejected', { note: text(meta.note) || '—' }) : t('whk.hist.approved');
    case 'wholesaler.act.send':
      return t('whk.hist.act', { code: text(meta.code) || '—' });
    case 'wholesaler.bank.review':
      return t(meta.decision === 'APPROVE' ? 'whk.hist.bankApproved' : 'whk.hist.bankRejected');
    default:
      return entry.action;
  }
}

/** «Tarix»: optovik auditi (`GET /admin/audit?entityType=Wholesaler&entityId=`) — qachon, kim, nima; yangisi tepada. */
export function HistoryTab({ wholesaler, phone }: TabProps) {
  const { t } = useTranslation();
  const audit = useWholesalerAuditQuery(wholesaler.id);
  const who = (name: string | null) => (name ? shortPersonName(name) : t('moderation.audit.system'));
  const entries = audit.data ?? [];
  return (
    <Card title={t('whk.hist.title')} sub={t('whk.hist.sub')} labelledBy="whk-history">
      {audit.isError ? <LoadError error={audit.error} onRetry={() => void audit.refetch()} variant="row" /> : !audit.data ? <Loading /> : !entries.length ? (
        <p className={styles.muted}>{t('whk.hist.empty')}</p>
      ) : phone ? (
        <ul className={styles.rowList}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className={styles.rowLink}>
                <span className={styles.rowTop}><span className={styles.rowName}>{who(entry.actorName)}</span><span className={styles.rowSub}>{tashkentDateTime(entry.at)}</span></span>
                <span className={styles.rowSub}>{historyText(entry, t)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-testid="wholesaler-history">
            <caption className={styles.visuallyHidden}>{t('whk.hist.title')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('moderation.audit.when')}</th>
                <th scope="col">{t('moderation.audit.who')}</th>
                <th scope="col">{t('moderation.audit.what')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{tashkentDateTime(entry.at)}</td>
                  <td>{who(entry.actorName)}</td>
                  <td className={styles.wrapCell}>{historyText(entry, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.note}>{t('whk.hist.note')}</p>
    </Card>
  );
}
