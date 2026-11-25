import { App } from 'antd';
import { ChevronRight, CircleCheck, Download, FileCheck, FileText, Lock, Pencil, Send, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getWholesalerContractLink, getWholesalerDocumentLink } from '../../../features/wholesalers/api/wholesalersApi';
import { cabinetState, displayPhone, hasContract } from '../../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler, WholesalerMoney } from '../../../features/wholesalers/model/wholesalerTypes';
import { ContractFile } from '../../../features/wholesalers/ui/ContractFile';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { downloadFile } from '../../../shared/api/download';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { dayTime } from '../../../shared/lib/dayTime';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentClock, tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge, DotLabel } from '../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { legalTypeLabel, type CardDialog, type DialogOptions } from '../model/cardView';
import { WholesalerProducts } from './WholesalerProducts';
import { WholesalerShipments } from './WholesalerShipments';
import styles from '../AdminWholesalerPage.module.css';

type T = ReturnType<typeof useTranslation>['t'];

/** «2020 8000 4051 2873 9001». */
const groupAccount = (value: string | null) => (value ? value.replace(/(\d{4})(?=\d)/g, '$1 ') : '—');

export function Card({ title, sub, aside, children, labelledBy, className }: { title: string; sub?: ReactNode; aside?: ReactNode; children: ReactNode; labelledBy: string; className?: string }) {
  return (
    <section className={`${styles.card} ${className ?? ''}`.trim()} aria-labelledby={labelledBy}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2 id={labelledBy}>{title}</h2>
          {sub ? <span className={styles.cardSub}>{sub}</span> : null}
        </div>
        {aside ? <div className={styles.cardAside}>{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Facts({ rows, columns = false }: { rows: [string, ReactNode][]; columns?: boolean }) {
  return (
    <dl className={styles.facts} data-columns={columns || undefined}>
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

const tbd = (text: string) => <span className={styles.tbd}>{text}</span>;

function Requisites({ wholesaler, onEdit, onBank }: { wholesaler: Wholesaler; onEdit: () => void; onBank: () => void }) {
  const { t } = useTranslation();
  return (
    <Card
      title={t('whk.req.title')}
      labelledBy="whk-req"
      className={styles.requisites}
      aside={<button type="button" className={styles.ghost} onClick={onEdit}><Pencil aria-hidden />{t('whk.req.edit')}</button>}
    >
      <Facts
        columns
        rows={[
          [t('whk.req.type'), legalTypeLabel(wholesaler, t)],
          [t('whk.req.tin'), wholesaler.tin ?? '—'],
          [t('whk.req.director'), wholesaler.directorName || '—'],
          [t('whk.req.address'), wholesaler.address || '—'],
          [t('whk.req.phone'), displayPhone(wholesaler.phone)],
          [t('whk.req.bank'), wholesaler.bankName ?? '—'],
          [t('whk.req.mfo'), wholesaler.bankMfo ?? '—'],
          [t('whk.req.account'), groupAccount(wholesaler.bankAccount)],
        ]}
      />
      {wholesaler.bankChangeRequest ? (
        <p className={styles.inlineWarning}>
          <TriangleAlert aria-hidden />
          <span>{t('whk.req.bankRequest', { when: formatCsvDate(wholesaler.bankChangeRequest.requestedAt) })}</span>
          <button type="button" className={styles.inlineLink} onClick={onBank}>{t('whk.req.bankReview')}</button>
        </p>
      ) : null}
      <p className={styles.note}>{t('whk.req.note')}</p>
    </Card>
  );
}

function FileLine({ icon, name, meta, state, onOpen, openLabel }: { icon: ReactNode; name: string; meta: string; state: string; onOpen: () => void; openLabel: string }) {
  const { t } = useTranslation();
  return (
    <li>
      <span className={styles.fileIcon} aria-hidden>{icon}</span>
      <span className={styles.fileBody}>
        <span className={styles.fileTop}>
          <span className={styles.fileName}>{name}</span>
          <Lock aria-hidden />
          <span className={styles.visuallyHidden}>{t('whd.file.private')}</span>
          <span className={styles.fileMeta}>{meta}</span>
        </span>
        <span className={styles.fileState}><CircleCheck aria-hidden />{state}</span>
      </span>
      <button type="button" className={styles.iconButton} aria-label={openLabel} title={openLabel} onClick={onOpen}><Download aria-hidden /></button>
    </li>
  );
}

function ContractCard({ wholesaler, phone, onUpload }: { wholesaler: Wholesaler; phone: boolean; onUpload: (file: File | null) => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const signed = hasContract(wholesaler);
  const open = async (link: () => Promise<string>) => {
    try {
      window.open(await link(), '_blank', 'noopener');
    } catch (error) {
      notification.error({ title: t('whk.contract.openError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
    }
  };
  const scan = wholesaler.contractFile;
  return (
    <Card
      title={t('whk.contract.title')}
      labelledBy="whk-contract"
      aside={signed ? <Badge tone="success" icon={FileCheck}>{t('status.contract.SIGNED')}</Badge> : <Badge tone="warning" icon={TriangleAlert}>{t('status.contract.MISSING')}</Badge>}
    >
      {signed ? (
        <>
          <Facts
            rows={[
              [t('whk.contract.number'), t('whk.contract.numberValue', { number: wholesaler.contractNumber ?? '', date: tashkentDay(wholesaler.contractDate ?? '') })],
              [t('whk.contract.commissioner'), tbd(t('whk.contract.commissionerTbd'))],
              [t('whk.contract.principal'), wholesaler.name],
              [t('whk.contract.version'), wholesaler.contractVersion ?? tbd(t('whd.versionTbd'))],
              [t('whk.contract.signMethod'), tbd(t('whk.contract.signMethodTbd'))],
            ]}
          />
          {scan || wholesaler.contractAcceptedAt ? (
            <ul className={styles.files}>
              {scan ? (
                <FileLine
                  icon={<FileText />}
                  name={scan.fileName}
                  meta={t('whk.contract.paper')}
                  state={t('whk.contract.uploaded', { date: tashkentDay(scan.uploadedAt), who: scan.uploadedBy ? ` · ${shortPersonName(scan.uploadedBy)}` : '' })}
                  openLabel={t('whk.contract.open', { name: scan.fileName })}
                  onOpen={() => void open(() => getWholesalerDocumentLink({ id: wholesaler.id, documentId: scan.id }))}
                />
              ) : null}
              {wholesaler.contractAcceptedAt ? (
                <FileLine
                  icon={<FileCheck />}
                  name={t('whk.contract.electronic')}
                  meta={t('whk.contract.inCabinet')}
                  state={t('whk.contract.signedAt', { when: tashkentDateTime(wholesaler.contractAcceptedAt) })}
                  openLabel={t('whk.contract.openElectronic')}
                  onOpen={() => void open(() => getWholesalerContractLink(wholesaler.id))}
                />
              ) : null}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <Facts rows={[[t('whk.contract.state'), t('whk.contract.notUploaded')], [t('whk.contract.version'), tbd(t('whd.versionTbd'))]]} />
          <ContractFile file={null} onChange={onUpload} phone={phone} label={t('whd.contract.fileLabel')} />
        </>
      )}
      <p className={styles.note}>{t('whk.contract.privateNote')}</p>
    </Card>
  );
}

function CabinetCard({ wholesaler, onInvite }: { wholesaler: Wholesaler; onInvite: () => void }) {
  const { t } = useTranslation();
  const state = wholesaler.status === 'SUSPENDED' ? 'CLOSED' : cabinetState(wholesaler);
  const cabinet = wholesaler.cabinet;
  const when = (value: string | null | undefined) => (value ? tashkentDateTime(value) : '—');
  const dot = {
    ACTIVE: <DotLabel tone="success">{t('whk.cab.active')}</DotLabel>,
    INVITED: <DotLabel tone="warning">{t('whk.cab.invited')}</DotLabel>,
    NONE: <DotLabel tone="neutral">{t('whk.cab.none')}</DotLabel>,
    CLOSED: <DotLabel tone="neutral">{t('whk.cab.closed')}</DotLabel>,
  }[state];
  let body: ReactNode;
  if (state === 'ACTIVE') {
    body = (
      <>
        <Facts
          rows={[
            [t('whk.cab.login'), t('whk.cab.loginValue', { phone: displayPhone(cabinet?.phone ?? wholesaler.phone) })],
            [t('whk.cab.invitedAt'), when(cabinet?.invitedAt)],
            [t('whk.cab.openedAt'), when(cabinet?.openedAt)],
            [t('whk.cab.lastActive'), cabinet?.lastActiveAt ? dayTime(cabinet.lastActiveAt, t, undefined, true) : '—'],
            [t('whk.cab.users'), '1'],
          ]}
        />
        <p className={styles.note}>{t('whk.cab.activeNote')}</p>
      </>
    );
  } else if (state === 'INVITED') {
    body = (
      <>
        <Facts rows={[[t('whk.req.phone'), displayPhone(cabinet?.phone ?? wholesaler.phone)], [t('whk.cab.invitedAt'), when(cabinet?.invitedAt)], [t('whk.cab.linkTtl'), tbd(t('whs.tbd'))]]} />
        <p className={styles.note}>{t('whk.cab.invitedNote')}</p>
        <div><button type="button" className={styles.outline} onClick={onInvite}><Send aria-hidden />{t('whk.cab.resend')}</button></div>
      </>
    );
  } else {
    body = (
      <>
        <Facts rows={[[t('whk.req.phone'), displayPhone(wholesaler.phone)], [t('whk.cab.invite'), state === 'CLOSED' ? t('whk.cab.closedValue') : t('whk.cab.notSent')]]} />
        <p className={styles.note}>{t(state === 'CLOSED' ? 'whk.cab.closedNote' : 'whk.cab.noneNote')}</p>
        {state === 'NONE' ? <div><button type="button" className={styles.outlineAction} onClick={onInvite}><Send aria-hidden />{t('whd.invite.button')}</button></div> : null}
      </>
    );
  }
  return (
    <Card title={t('whk.cab.title')} sub="M2" labelledBy="whk-cabinet" aside={dot}>
      {body}
    </Card>
  );
}

export function Tile({ label, value, unit, sub, tone }: { label: string; value: string; unit: string; sub: string; tone?: 'sunken' }) {
  return (
    <div className={styles.tile} data-tone={tone}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}<span> {unit}</span></span>
      <span className={styles.tileSub}>{sub}</span>
    </div>
  );
}

function Goods({ wholesaler, time }: { wholesaler: Wholesaler; time: string }) {
  const { t } = useTranslation();
  const stock = wholesaler.stats?.stock;
  const goods = wholesaler.stats?.goods;
  const n = (value: number | undefined) => (value === undefined ? '—' : formatMoney(value));
  return (
    <Card title={t('whk.goods.title')} sub={t('whk.goods.sub', { time })} labelledBy="whk-goods">
      <div className={styles.tiles}>
        <Tile label={t('whk.goods.onHand')} value={n(stock?.onHand)} unit={t('whs.kpi.stockUnit')} sub={stock ? t('whs.kpi.stockSub', { available: n(stock.available), reserved: n(stock.reserved) }) : ''} />
        <Tile label={t('whk.goods.transit')} value={n(goods?.inTransit)} unit={t('whs.kpi.stockUnit')} sub={t('whk.goods.transitSub')} />
        <Tile label={t('whk.goods.sold')} value={n(goods?.sold)} unit={t('whs.kpi.stockUnit')} sub={goods ? t('whk.goods.soldSub', { amount: n(goods.soldAmount) }) : ''} tone="sunken" />
        <Tile label={t('whk.goods.returned')} value={n(goods?.returned)} unit={t('whs.kpi.stockUnit')} sub={goods ? t('whk.goods.returnedSub', { sorting: goods.returnedSorting, elchi: goods.returnedInElchi }) : ''} />
        <Tile label={t('whk.goods.defect')} value={n(goods?.defect)} unit={t('whs.kpi.stockUnit')} sub={goods ? t('whk.goods.defectSub', { receiving: goods.defectReceiving, returns: goods.defectReturns }) : ''} />
      </div>
      <p className={styles.note}>{t('whk.goods.note')}</p>
    </Card>
  );
}

const ACT_TONE = { READY: 'info', ACCEPTED: 'success', DISPUTED: 'warning', PAID: 'success' } as const;

function weekday(iso: string, t: T) {
  const day = new Date(Date.parse(iso) + 5 * 3_600_000).getUTCDay();
  return t(`whk.weekday.${day}` as Parameters<T>[0]);
}

export function Money({ wholesaler, phone, tabLink = true }: { wholesaler: Wholesaler; phone: boolean; tabLink?: boolean }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const money: WholesalerMoney | null | undefined = wholesaler.stats?.money;
  const sum = (value: number) => t('whs.money', { amount: formatMoney(value) });
  const link = tabLink ? <Link to="?tab=money" className={styles.link}>{t('whk.money.tabLink')}<ChevronRight aria-hidden /></Link> : null;
  if (!money) {
    return (
      <Card title={t('whk.money.title')} sub={t('whk.money.sub')} labelledBy="whk-money" aside={phone ? null : link}>
        <p className={styles.muted}>{t('whk.money.none')}</p>
      </Card>
    );
  }
  const act = money.lastAct;
  const downloadAct = async () => {
    if (!act) return;
    try {
      await downloadFile(`/admin/finance/settlements/${encodeURIComponent(act.id)}/act.pdf`, `${act.code}.pdf`);
    } catch (error) {
      notification.error({ title: t('whk.money.pdfError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
    }
  };
  const formula = money.formula.map((part) => `${part.quantity} × ${formatMoney(part.basePrice)}`).join(' + ');
  return (
    <Card title={t('whk.money.title')} sub={t('whk.money.sub')} labelledBy="whk-money" aside={phone ? null : link}>
      {phone ? <div>{link}</div> : null}
      <div className={styles.moneyGrid}>
        <div className={styles.moneyMain}>
          <div className={styles.moneyBig}>
            <span className={styles.tileLabel}>{t('whs.kpi.payable')}</span>
            <span className={styles.tileValue}>{formatMoney(money.payable)}<span> {t('whs.kpi.payableUnit')}</span></span>
            <span className={styles.note}>{t('whk.money.payableSub', { count: money.payableQty })}</span>
          </div>
          <div className={styles.bar} role="img" aria-label={t('whk.money.barAria', { payable: formatMoney(money.payable), held: formatMoney(money.held) })}>
            <span style={{ flexGrow: money.payable }} />
            <span style={{ flexGrow: money.held }} data-tone="held" />
          </div>
          <div className={styles.legend}>
            <span><i aria-hidden />{t('whs.kpi.payable')}</span>
            <span><i aria-hidden data-tone="held" />{t('whk.money.held')}</span>
          </div>
          <Facts
            rows={[
              [t('whk.money.held'), <>{sum(money.held)} <span className={styles.tbd}>{t('whk.money.qty', { count: money.heldQty })}</span></>],
              [t('whk.money.paid'), <>{sum(money.paid)} <span className={styles.tbd}>{money.paid ? '' : t('whk.money.notPaid')}</span></>],
              [t('whk.money.written'), <>{sum(money.written)} <span className={styles.tbd}>{t('whk.money.qty', { count: money.writtenQty })}</span></>],
            ]}
          />
          <p className={styles.note}>{t('whk.money.formula', { formula, total: formatMoney(money.written) })}</p>
        </div>
        <div className={styles.actBox}>
          {act ? (
            <>
              <div className={styles.actHead}>
                <span className={styles.actTitle}>{t('whk.money.actTitle', { code: act.code, from: formatCsvDate(act.periodFrom).slice(0, 5), to: formatCsvDate(act.periodTo) })}</span>
                <Badge tone={ACT_TONE[act.status]}>{t(`whk.act.${act.status}`)}</Badge>
                <button type="button" className={styles.pdfButton} onClick={() => void downloadAct()}><FileText aria-hidden />PDF</button>
              </div>
              <p className={styles.note}>{t('whk.money.prepared', { when: tashkentDateTime(act.preparedAt) })}</p>
              <Facts rows={[[t('whk.money.counted'), sum(act.counted)], [t('whk.money.notCounted'), sum(act.notCounted)], [t('whk.money.transfer'), sum(act.transfer)]]} />
            </>
          ) : <p className={styles.note}>{t('whk.money.noAct')}</p>}
          <div className={styles.divider} />
          <Facts
            rows={[
              [t('whk.money.nextAct'), money.nextActAt ? t('whk.money.nextActValue', { date: tashkentDay(money.nextActAt), weekday: weekday(money.nextActAt, t), time: tashkentClock(Date.parse(money.nextActAt)) }) : '—'],
              [t('whk.money.transferTo'), <>{t('whk.money.account', { last: (wholesaler.bankAccount ?? '').slice(-4) || '—' })} {tbd(t('whs.tbd'))}</>],
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

/** To'xtatilgan optovik: banner ostidagi to'rt raqam (holatlar §3). */
function SuspendedTiles({ wholesaler }: { wholesaler: Wholesaler }) {
  const { t } = useTranslation();
  const stats = wholesaler.stats;
  return (
    <div className={styles.suspendedTiles}>
      <Tile label={t('whk.goods.onHand')} value={formatMoney(stats?.stock.onHand ?? 0)} unit={t('whs.kpi.stockUnit')} sub={stats?.stock.onHand ? t('whs.kpi.stockSub', { available: stats.stock.available, reserved: stats.stock.reserved }) : t('whk.susp.returned')} />
      <Tile label={t('whk.goods.transit')} value={formatMoney(stats?.goods?.inTransit ?? 0)} unit={t('whs.kpi.stockUnit')} sub={stats?.goods?.inTransit ? t('whk.goods.transitSub') : t('whk.susp.noOrders')} />
      <Tile label={t('whk.susp.products')} value={String(stats?.products.total ?? 0)} unit={t('whs.kpi.wholesalersUnit')} sub={t('whk.susp.notOnSale')} />
      <Tile label={t('whs.kpi.payable')} value={formatMoney(stats?.payable.amount ?? 0)} unit={t('whs.kpi.payableUnit')} sub={stats?.payable.amount ? t('whs.kpi.payableSub', { amount: formatMoney(stats.payable.held) }) : t('whs.payable.closed')} />
    </div>
  );
}

interface GeneralTabProps {
  wholesaler: Wholesaler;
  phone: boolean;
  updatedAt: number;
  onDialog: (dialog: CardDialog, options?: DialogOptions) => void;
  onEdit: () => void;
}

/**
 * «Umumiy» (admin-optovik-karta): rekvizitlar, komissiya shartnomasi, kabinet, tovar holati, pul va aktlar,
 * mahsulotlar va oxirgi postavkalar. To'xtatilgan optovikda «Tovar holati» o'rnida — to'rt yakuniy raqam.
 */
export function GeneralTab({ wholesaler, phone, updatedAt, onDialog, onEdit }: GeneralTabProps) {
  const { t } = useTranslation();
  const time = updatedAt ? tashkentClock(updatedAt) : '—';
  const stats = wholesaler.stats;
  const signed = hasContract(wholesaler);
  const pending = wholesaler.status === 'PENDING';
  return (
    <div className={styles.general}>
      {wholesaler.status === 'SUSPENDED' ? <SuspendedTiles wholesaler={wholesaler} /> : null}
      <div className={styles.topRow}>
        <Requisites wholesaler={wholesaler} onEdit={onEdit} onBank={() => onDialog('bank')} />
        <ContractCard wholesaler={wholesaler} phone={phone} onUpload={(file) => onDialog('contract', { file })} />
        <CabinetCard wholesaler={wholesaler} onInvite={() => onDialog('invite')} />
      </div>
      {wholesaler.status === 'SUSPENDED' || pending || !signed ? null : <Goods wholesaler={wholesaler} time={time} />}
      {pending ? null : <Money wholesaler={wholesaler} phone={phone} />}
      {pending ? null : (
        <Card
          title={t('whk.prod.title')}
          sub={stats ? t('whk.prod.sub', { total: stats.products.total, onSale: stats.products.onSale }) : undefined}
          labelledBy="whk-products"
          aside={<Link to="?tab=products" className={styles.link}>{t('whk.prod.tabLink')}<ChevronRight aria-hidden /></Link>}
        >
          <WholesalerProducts wholesalerId={wholesaler.id} phone={phone} limit={8} />
          <p className={styles.note}>{t('whk.prod.note')}</p>
        </Card>
      )}
      {pending ? null : (
        <Card
          title={t('whk.ship.title')}
          sub={t('whk.ship.sub')}
          labelledBy="whk-shipments"
          aside={<Link to="?tab=shipments" className={styles.link}>{t('whk.ship.tabLink', { count: stats?.shipments.total ?? 0 })}<ChevronRight aria-hidden /></Link>}
        >
          <WholesalerShipments wholesalerId={wholesaler.id} phone={phone} limit={5} />
        </Card>
      )}
    </div>
  );
}
