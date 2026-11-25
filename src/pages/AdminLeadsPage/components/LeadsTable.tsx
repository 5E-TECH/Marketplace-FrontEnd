import { Dropdown, Tooltip } from 'antd';
import { ArrowDown, ArrowRightLeft, ArrowUp, ChevronsUpDown, Ellipsis, Eye, Headphones, RotateCcw, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isFresh, leadDayTime, transferBlock, withinDays, type SortField } from '../../../features/adminLeads/lib/leadRows';
import type { AdminLeadListItem, AdminLeadQuery } from '../../../features/adminLeads/model/adminLeadTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { CheckBox } from '../../../shared/ui/CheckBox/CheckBox';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import styles from '../AdminLeadsPage.module.css';

export type LeadRowAction = 'transfer' | 'reopen';

const SKELETON = [0, 1, 2, 3, 4];


interface LeadsTableProps {
  rows: readonly AdminLeadListItem[];
  base: string;
  admin: boolean;
  now: number;
  caption: string;
  /** Telefon bo'yicha qidiruv — «Telefon» ustuni (faqat admin). */
  phoneColumn: string | null;
  sort: NonNullable<AdminLeadQuery['sort']>;
  onSort: (field: SortField) => void;
  selected: ReadonlySet<string>;
  onSelect: (ids: readonly string[], checked: boolean) => void;
  onAction: (action: LeadRowAction, lead: AdminLeadListItem) => void;
  /** Qatorlar o'rnida: «topilmadi» yoki xato qatori. */
  body?: ReactNode;
  /** Ustun nomlari joyida, qatorlar skelet (admin-lidlar «Yuklanish»). */
  loading?: boolean;
}

/**
 * Lidlar jadvali (admin-lidlar): tanlash, Lid, Mijoz, Sahifa · sotuvchi, Narx, Operator, Urinish, Holat, Keldi, ⋯.
 * Planshetda (container `content`) Sahifa, Operator va Urinish ustunlari yashiriladi, tugmalar 44 px.
 */
export function LeadsTable({ rows, base, admin, now, caption, phoneColumn, sort, onSort, selected, onSelect, onAction, body, loading }: LeadsTableProps) {
  const { t } = useTranslation();
  const ids = rows.map((lead) => lead.id);
  const picked = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && picked === ids.length;
  const columns = phoneColumn ? 11 : 10;

  const sortHeader = (field: SortField, label: string) => {
    const active = sort.replace('-', '') === field;
    const desc = sort.startsWith('-');
    const Icon = !active ? ChevronsUpDown : desc ? ArrowDown : ArrowUp;
    return (
      <th className={styles.num} aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined} data-col={field === 'attempts' ? 'attempts' : undefined}>
        <button type="button" className={styles.sort} data-active={active || undefined} onClick={() => onSort(field)}>
          {label}
          <Icon aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className={styles.visuallyHidden}>{caption}</caption>
        <thead>
          <tr>
            <th className={styles.check}>
              <label className={styles.checkHit}>
                <CheckBox aria-label={t('al.selectAll')} checked={all} indeterminate={picked > 0 && !all} disabled={!ids.length} onChange={(event) => onSelect(ids, event.target.checked)} />
              </label>
            </th>
            <th>{t('al.col.lead')}</th>
            <th>{t('al.col.customer')}</th>
            {phoneColumn ? <th>{t('al.col.phone')}</th> : null}
            <th data-col="stream">{t('al.col.stream')}</th>
            {sortHeader('price', t('al.col.price'))}
            <th data-col="operator">{t('al.col.operator')}</th>
            {sortHeader('attempts', t('al.col.attempts'))}
            <th>{t('al.col.status')}</th>
            {sortHeader('createdAt', t('al.col.createdAt'))}
            <th className={styles.actions}><span className={styles.visuallyHidden}>{t('al.col.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading ? SKELETON.map((row) => (
            <tr key={row} className={styles.skeletonRow} aria-hidden>
              <td className={styles.check}><span className={styles.bone} data-shape="box" /></td>
              <td><span className={styles.bone} style={{ width: 52 }} /></td>
              <td><span className={styles.bone} style={{ width: 110 }} /></td>
              {phoneColumn ? <td><span className={styles.bone} style={{ width: 112 }} /></td> : null}
              <td data-col="stream"><span className={styles.bone} data-shape="pill" style={{ width: 70 }} /></td>
              <td><span className={styles.bone} style={{ width: 88, marginLeft: 'auto' }} /></td>
              <td data-col="operator"><span className={styles.bone} style={{ width: 80 }} /></td>
              <td data-col="attempts"><span className={styles.bone} style={{ width: 24, marginLeft: 'auto' }} /></td>
              <td><span className={styles.bone} data-shape="pill" style={{ width: 96 }} /></td>
              <td><span className={styles.bone} style={{ width: 88, marginLeft: 'auto' }} /></td>
              <td className={styles.actions} />
            </tr>
          )) : body ? (
            <tr className={styles.messageRow}><td colSpan={columns}>{body}</td></tr>
          ) : rows.map((lead) => {
            const fresh = isFresh(lead, now);
            const note = fresh ? t('al.justNow', { time: tashkentClock(Date.parse(lead.statusAt ?? '')) }) : lead.status === 'NEW' ? null : lead.closedNote;
            return (
              <tr key={lead.id} data-testid="lead-row" data-fresh={fresh || undefined} data-selected={selected.has(lead.id) || undefined}>
                <td className={styles.check}>
                  <label className={styles.checkHit}>
                    <CheckBox aria-label={t('al.selectRow', { id: lead.id })} checked={selected.has(lead.id)} onChange={(event) => onSelect([lead.id], event.target.checked)} />
                  </label>
                </td>
                <td className={styles.tabular}><Link className={styles.leadLink} to={`${base}/${encodeURIComponent(lead.id)}`}>{lead.id}</Link></td>
                <td>
                  <span className={styles.person}>
                    <span>{lead.customerName}</span>
                    <span>{lead.regionName ?? '—'}</span>
                  </span>
                </td>
                {phoneColumn ? <td className={styles.tabular}>{phoneColumn}</td> : null}
                <td data-col="stream">
                  <span className={styles.stream}>
                    {lead.streamCode ? <span className={styles.code}>{lead.streamCode}</span> : null}
                    <span>{lead.affiliateName ?? '—'}</span>
                  </span>
                </td>
                <td className={styles.num}>{lead.salePrice ? t('al.sum', { amount: formatMoney(lead.salePrice) }) : <span className={styles.muted}>—</span>}</td>
                <td data-col="operator">{lead.operatorName ?? <span className={styles.muted}>—</span>}</td>
                <td className={styles.num} data-col="attempts">{lead.attemptsCount ?? 0}</td>
                <td className={note ? styles.statusCell : undefined}>
                  <StatusBadge family="lead" code={lead.status} />
                  {note ? <span className={styles.statusNote}>{note}</span> : null}
                </td>
                <td className={styles.num}>{leadDayTime(lead.createdAt, t, now)}</td>
                <td className={styles.actions}><RowMenu lead={lead} base={base} admin={admin} onAction={onAction} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Qator menyusi: lidni ochish, yozuvni tinglash, o'tkazish (yopilganda — sababi bilan yopiq), qayta ochish (admin). */
function RowMenu({ lead, base, admin, onAction }: { lead: AdminLeadListItem; base: string; admin: boolean; onAction: (action: LeadRowAction, lead: AdminLeadListItem) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const label = t('al.rowActions', { id: lead.id });
  const block = transferBlock(lead);
  const noCalls = !lead.attemptsCount;
  // «Rad etildi» — 3 kun ichida faqat admin qayta ochadi (TZ 5-bo'lim 10-qoida).
  const reopenable = lead.status === 'REJECTED' && (!lead.rejectedAt || withinDays(lead.rejectedAt, 3));
  const href = `${base}/${encodeURIComponent(lead.id)}`;
  const hinted = (text: string, hint: string | null) => (hint ? <Tooltip title={hint} placement="left">{text}</Tooltip> : text);
  // Menyu oyna ochilishidan oldin yopiladi — aks holda birinchi Escape oynani emas, menyuni yopadi.
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      rootClassName={rowMenu.root}
      open={open}
      onOpenChange={setOpen}
      menu={{
        items: [
          { key: 'open', icon: <Eye aria-hidden />, label: t('al.menu.open') },
          { key: 'listen', icon: <Headphones aria-hidden />, label: hinted(t('al.menu.listen'), noCalls ? t('al.menu.noCallsHint') : null), disabled: noCalls },
          { key: 'transfer', icon: <ArrowRightLeft aria-hidden />, label: hinted(t('al.menu.transfer'), block ? t(block) : null), disabled: Boolean(block) },
          ...(admin ? [
            { type: 'divider' as const },
            { key: 'reopen', icon: <RotateCcw aria-hidden />, label: hinted(t('al.menu.reopen'), reopenable ? null : t('alk.a.reopenHint')), disabled: !reopenable },
          ] : []),
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          setOpen(false);
          if (key === 'open') void navigate(href);
          if (key === 'listen') void navigate(`${href}?listen=1`);
          if (key === 'transfer' || key === 'reopen') window.setTimeout(() => onAction(key, lead));
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-expanded={open}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}

/** Jadval ichidagi xabar qatori (admin-lidlar «Filtr bo'yicha bo'sh»): ikonka, sarlavha, matn, o'ngda tugma. */
export function MessageRow({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className={styles.message} data-testid="leads-empty">
      <span className={styles.messageIcon} aria-hidden><Search /></span>
      <span className={styles.messageText}>
        <span>{title}</span>
        <span>{text}</span>
      </span>
      {action}
    </div>
  );
}
