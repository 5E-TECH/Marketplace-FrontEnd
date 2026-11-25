import { Dropdown, Tooltip } from 'antd';
import { CirclePause, CirclePlay, Ellipsis, Eye, PackagePlus, Plus, Send, Smartphone, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cabinetState, hasContract, productBlock } from '../../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler } from '../../../features/wholesalers/model/wholesalerTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { cardPath } from '../model/wholesalerList';
import styles from './WholesalersTab.module.css';

type T = ReturnType<typeof useTranslation>['t'];

export type WholesalerAction = 'open' | 'declare' | 'addProduct' | 'act' | 'invite' | 'suspend' | 'resume';

interface Cell {
  main: ReactNode;
  sub?: ReactNode;
}

const dash = <span className={styles.sub}>—</span>;
const pieces = (count: number, t: T) => t('whs.pieces', { count: formatMoney(count) });

/** Shartnoma ustuni: belgi va ostida — sana va kabinet, yoki nega yopiq. */
function contractSub(item: Wholesaler, t: T): string {
  if (item.status === 'PENDING') return t('whs.contract.application');
  if (!hasContract(item)) return t('whs.contract.productsClosed');
  if (item.status === 'SUSPENDED') return t('whs.cabinet.closed');
  const date = tashkentDay(item.contractDate ?? '');
  const cabinet = cabinetState(item);
  return cabinet === 'NONE' ? date : `${date} · ${t(cabinet === 'ACTIVE' ? 'whs.cabinet.active' : 'whs.cabinet.invited')}`;
}

/** Planshetda «Shartnoma» ustuni yo'q — holat ostida shartnoma sanasi yoki nega yopiq. */
function statusSubTablet(item: Wholesaler, t: T): string | null {
  if (item.status === 'SUSPENDED') return item.statusChangedAt ? tashkentDay(item.statusChangedAt) : null;
  if (item.status === 'PENDING') return t('whs.contract.application');
  return hasContract(item) ? t('whs.contract.date', { date: tashkentDay(item.contractDate ?? '') }) : t('whs.contract.productsClosed');
}

function productsCell(item: Wholesaler, t: T): Cell | null {
  if (item.status === 'PENDING') return null;
  if (!hasContract(item)) return { main: '0', sub: t('whs.products.afterContract') };
  const stats = item.stats?.products;
  if (!stats) return null;
  const sub = item.status === 'SUSPENDED'
    ? t('whs.products.stopped', { count: stats.total - stats.onSale })
    : stats.noStock ? t('whs.products.noStock', { count: stats.noStock }) : t('whs.products.total', { count: stats.total });
  return { main: t('whs.products.onSale', { count: stats.onSale }), sub };
}

function stockCell(item: Wholesaler, t: T, tablet = false): Cell | null {
  const stock = item.stats?.stock;
  if (item.status === 'PENDING' || !hasContract(item) || !stock) return null;
  if (item.status === 'SUSPENDED' && stock.onHand === 0) return { main: pieces(0, t), sub: t('whs.stock.returned') };
  const values = { available: formatMoney(stock.available), reserved: formatMoney(stock.reserved) };
  return { main: pieces(stock.onHand, t), sub: t(tablet ? 'whs.stock.ready' : 'whs.stock.sub', values) };
}

function shipmentsCell(item: Wholesaler, t: T): Cell | null {
  const stats = item.stats?.shipments;
  if (item.status !== 'ACTIVE' || !hasContract(item) || !stats) return null;
  const defect = stats.lastDefect ? t('whs.shipments.defect', { code: stats.lastDefect.code, count: stats.lastDefect.quantity }) : null;
  if (stats.waiting) return { main: t('whs.shipments.waiting', { count: stats.waiting }), sub: defect ?? t('whs.shipments.total', { count: stats.total }) };
  return stats.total ? { main: t('whs.shipments.total', { count: stats.total }), sub: defect } : { main: t('whs.shipments.none') };
}

function payableCell(item: Wholesaler, t: T): Cell | null {
  const payable = item.stats?.payable;
  if (item.status === 'PENDING' || !hasContract(item) || !payable) return null;
  if (item.status === 'SUSPENDED' && payable.amount === 0) return { main: t('whs.money', { amount: '0' }), sub: t('whs.payable.closed') };
  return { main: t('whs.money', { amount: formatMoney(payable.amount) }), sub: payable.held ? t('whs.payable.held', { amount: formatMoney(payable.held) }) : null };
}

function Stack({ cell, end = false }: { cell: Cell | null; end?: boolean }) {
  if (!cell) return dash;
  return (
    <span className={styles.stack} data-end={end || undefined}>
      <span className={styles.main}>{cell.main}</span>
      {cell.sub ? <span className={styles.sub}>{cell.sub}</span> : null}
    </span>
  );
}

interface RowMenuProps {
  wholesaler: Wholesaler;
  onAction: (action: WholesalerAction) => void;
}

/**
 * Qator «⋯» menyusi (admin-optoviklar.holatlar §4): karta, postavka arizasi va mahsulot — optovik nomidan
 * (shartnomasiz yoki to'xtatilgan — yopiq, sababi maslahatda), akt, kabinetga taklif (kabinet faol — yopiq), to'xtatish.
 */
export function WholesalerRowMenu({ wholesaler, onAction }: RowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const block = productBlock(wholesaler);
  const cabinet = cabinetState(wholesaler);
  const label = t('whs.rowActions', { name: wholesaler.name });
  const disabledLabel = (text: string, reason: string) => <Tooltip title={reason} placement="left">{text}</Tooltip>;
  const blocked = (text: string) => (block ? disabledLabel(text, t(`whs.block.${block}` as TranslationKey)) : text);
  const items = [
    { key: 'open', icon: <Eye aria-hidden />, label: t('whs.menu.open') },
    { key: 'declare', icon: <PackagePlus aria-hidden />, label: blocked(t('whs.menu.declare')), disabled: Boolean(block) },
    { key: 'addProduct', icon: <Plus aria-hidden />, label: blocked(t('whs.menu.addProduct')), disabled: Boolean(block) },
    { key: 'act', icon: <Send aria-hidden />, label: t('whs.menu.act'), disabled: !hasContract(wholesaler) },
    { type: 'divider' as const },
    {
      key: 'invite',
      icon: <Smartphone aria-hidden />,
      label: cabinet === 'ACTIVE' ? disabledLabel(t('whs.menu.reinvite'), t('whs.block.cabinetActive')) : t(cabinet === 'INVITED' ? 'whs.menu.reinvite' : 'whs.menu.invite'),
      disabled: cabinet === 'ACTIVE' || wholesaler.status === 'SUSPENDED',
    },
    wholesaler.status === 'SUSPENDED'
      ? { key: 'resume', icon: <CirclePlay aria-hidden />, label: t('whs.menu.resume') }
      : { key: 'suspend', icon: <CirclePause aria-hidden />, label: t('whs.menu.suspend'), danger: true },
  ];
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      rootClassName={rowMenu.root}
      open={open}
      onOpenChange={setOpen}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          setOpen(false);
          // Menyu yopilgach oyna yoki sahifa ochiladi — aks holda birinchi Escape menyuga ketadi.
          window.setTimeout(() => onAction(key as WholesalerAction));
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-expanded={open} onClick={(event) => event.stopPropagation()}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}

interface TableProps {
  rows: readonly Wholesaler[];
  onAction: (item: Wholesaler, action: WholesalerAction) => void;
  /** Bo'sh natija (filtr) — sarlavha ostida ixcham qator (komponentlar-E §13). */
  empty?: ReactNode;
  footer: ReactNode;
}

/**
 * Optoviklar jadvali (admin-optoviklar): optovik, holat, shartnoma, mahsulotlar, omborda, postavkalar, to'lanadigan.
 * Planshetda (≤ 919 px) — optovik, holat (+ shartnoma sanasi), omborda, to'lanadigan. Qatorni bosish — karta.
 */
export function WholesalerTable({ rows, onAction, empty, footer }: TableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="wholesalers-table">
          <caption className={styles.visuallyHidden}>{t('whs.list.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('whs.col.wholesaler')}</th>
              <th scope="col">{t('whs.col.status')}</th>
              <th scope="col" data-wide>{t('whs.col.contract')}</th>
              <th scope="col" data-wide>{t('whs.col.products')}</th>
              <th scope="col" data-end>{t('whs.col.stock')}</th>
              <th scope="col" data-wide>{t('whs.col.shipments')}</th>
              <th scope="col" data-end>{t('whs.col.payable')}</th>
              <th scope="col" className={styles.actionsCol}><span className={styles.visuallyHidden}>{t('whs.col.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const tabletSub = statusSubTablet(item, t);
              const pending = item.status === 'PENDING';
              return (
                <tr
                  key={item.id}
                  data-testid="wholesaler-row"
                  className={styles.row}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a, button')) return;
                    void navigate(cardPath(item.id));
                  }}
                >
                  <td>
                    <span className={styles.stack}>
                      <Link to={cardPath(item.id)} className={styles.name}>{item.name}</Link>
                      <span className={styles.sub}>{t('whs.tin', { tin: item.tin ?? '—' })}</span>
                    </span>
                  </td>
                  <td>
                    <span className={styles.badgeStack}>
                      <StatusBadge family="wholesaler" code={item.status} />
                      {item.status === 'SUSPENDED' && item.statusChangedAt ? <span className={`${styles.sub} ${styles.desktopOnly}`}>{tashkentDay(item.statusChangedAt)}</span> : null}
                      {tabletSub ? <span className={`${styles.sub} ${styles.tabletOnly}`}>{tabletSub}</span> : null}
                    </span>
                  </td>
                  <td data-wide>
                    <span className={styles.badgeStack}>
                      <StatusBadge family="contract" code={hasContract(item) ? 'SIGNED' : 'MISSING'} />
                      <span className={styles.sub}>{contractSub(item, t)}</span>
                    </span>
                  </td>
                  <td data-wide><Stack cell={productsCell(item, t)} /></td>
                  <td data-end>
                    <span className={styles.desktopOnly}><Stack cell={stockCell(item, t)} end /></span>
                    <span className={styles.tabletOnly}><Stack cell={stockCell(item, t, true)} end /></span>
                  </td>
                  <td data-wide><Stack cell={shipmentsCell(item, t)} /></td>
                  <td data-end><Stack cell={payableCell(item, t)} end /></td>
                  <td className={styles.actionsCol}>
                    {pending ? (
                      <Link to={cardPath(item.id)} className={styles.iconButton} aria-label={t('whs.review')} title={t('whs.review')}><Eye aria-hidden /></Link>
                    ) : (
                      <WholesalerRowMenu wholesaler={item} onAction={(action) => onAction(item, action)} />
                    )}
                  </td>
                </tr>
              );
            })}
            {empty ? <tr><td colSpan={8} className={styles.emptyCell}>{empty}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  );
}

/** Telefon (admin-optoviklar.mobil, .holatlar §5): jadval o'rnida kartalar; karta — optovik kartasiga havola. */
export function WholesalerCards({ rows, footer }: { rows: readonly Wholesaler[]; footer: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className={styles.cardsBox}>
      <ul className={styles.cards} aria-label={t('whs.list.title')}>
        {rows.map((item) => {
          const signed = hasContract(item);
          const stock = item.stats?.stock;
          const payable = item.stats?.payable;
          const shipments = item.stats?.shipments;
          const suspended = item.status === 'SUSPENDED';
          let second: ReactNode = null;
          let third: string = t('whs.tin', { tin: item.tin ?? '—' });
          if (item.status === 'PENDING') {
            second = <span className={styles.cardLine}>{t('whs.card.pendingLine')}<span className={styles.cardMuted}> · M2</span></span>;
            third = t('whs.card.pendingTin', { tin: item.tin ?? '—' });
          } else if (!signed) {
            second = <span className={styles.cardBadgeLine}><Badge tone="warning" icon={TriangleAlert}>{t('whs.card.contractMissing')}</Badge><span className={styles.cardMuted}>{t('whs.card.noContractLine')}</span></span>;
            if (cabinetState(item) === 'NONE') third = t('whs.card.cabinetNone', { tin: item.tin ?? '—' });
          } else {
            if (stock) {
              const rest = suspended && stock.onHand === 0
                ? ` · ${t('whs.stock.returned')}`
                : t('whs.card.stockSub', { available: formatMoney(stock.available), reserved: formatMoney(stock.reserved) });
              second = <span className={styles.cardLine}>{t('whs.card.stockLine', { count: formatMoney(stock.onHand) })}<span className={styles.cardMuted}>{rest}</span></span>;
            }
            third = suspended && item.statusChangedAt
              ? t('whs.card.suspended', { tin: item.tin ?? '—', date: tashkentDay(item.statusChangedAt) })
              : t('whs.card.signed', { tin: item.tin ?? '—', date: tashkentDay(item.contractDate ?? '') });
          }
          const fourth = suspended
            ? (payable?.amount === 0 ? t('whs.payable.closed') : null)
            : signed && shipments?.waiting
              ? [t('whs.card.shipments', { count: shipments.waiting }), shipments.lastDefect ? t('whs.shipments.defect', { code: shipments.lastDefect.code, count: shipments.lastDefect.quantity }) : null].filter(Boolean).join(' · ')
              : null;
          return (
            <li key={item.id} data-testid="wholesaler-row">
              <Link to={cardPath(item.id)} className={styles.cardLink} aria-label={t('whs.openCard', { name: item.name })}>
                <span className={styles.cardTop}>
                  <span className={styles.cardName}>{item.name}</span>
                  <StatusBadge family="wholesaler" code={item.status} />
                </span>
                {second}
                <span className={styles.cardFoot}>
                  <span className={styles.cardMeta}>{third}</span>
                  {signed && payable && item.status !== 'PENDING' ? (
                    <span className={styles.cardMoney}>
                      <span>{t('whs.card.payable')}</span>
                      <strong>{t('whs.money', { amount: formatMoney(payable.amount) })}</strong>
                    </span>
                  ) : null}
                </span>
                {fourth ? <span className={styles.cardNote}>{fourth}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {footer}
    </div>
  );
}
