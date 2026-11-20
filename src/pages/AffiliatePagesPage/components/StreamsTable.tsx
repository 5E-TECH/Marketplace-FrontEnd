import { Dropdown } from 'antd';
import { ChartColumn, Copy, ExternalLink, Inbox, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AffiliateStream } from '../../../features/affiliate/api/offersApi';
import { StreamStatusBadges } from '../../../features/affiliate/ui/StreamStatusBadges';
import { useCopyLink } from '../../../features/affiliate/ui/useCopyLink';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { CodeBadge } from '../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { StreamRow } from '../model/streamRows';
import styles from '../AffiliatePagesPage.module.css';

/** «⋯» menyusi (sotuvchi-sahifalarim 3): sozlash, ochib ko'rish, statistika, lidlar. QR va o'zi to'xtatish — kartada yo'q. */
export function StreamMenu({ stream, label }: { stream: AffiliateStream; label: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'settings', icon: <SlidersHorizontal aria-hidden />, label: t('pages.menu.settings') },
          { key: 'open', icon: <ExternalLink aria-hidden />, label: t('streams.open') },
          { key: 'stats', icon: <ChartColumn aria-hidden />, label: t('pages.menu.stats') },
          { key: 'leads', icon: <Inbox aria-hidden />, label: t('pages.menu.leads') },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'settings') void navigate(`/affiliate/pages/${stream.id}`);
          if (key === 'open') window.open(stream.link, '_blank', 'noopener,noreferrer');
          if (key === 'stats') void navigate(`/affiliate/stats?page=${stream.id}`);
          if (key === 'leads') void navigate(`/affiliate/leads?page=${stream.id}`);
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} onClick={(event) => event.stopPropagation()}>
        <MoreHorizontal aria-hidden />
      </button>
    </Dropdown>
  );
}

export function CopyCodeButton({ stream }: { stream: AffiliateStream }) {
  const { t } = useTranslation();
  const copy = useCopyLink();
  const label = t('pages.copyLink', { code: stream.code });
  return (
    <button
      type="button"
      className={styles.iconButton}
      data-size="sm"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        void copy(stream.link);
      }}
    >
      <Copy aria-hidden />
    </button>
  );
}

interface StreamsTableProps {
  rows: readonly StreamRow[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  totals: { clicks: number; leads: number; sales: number; income: number | null; hold: number | null } | null;
}

/** Sahifalar jadvali (sotuvchi-sahifalarim): qatorni bosish — «Tanlangan sahifa»; oxirida jami. */
export function StreamsTable({ rows, selectedId, onSelect, totals }: StreamsTableProps) {
  const { t } = useTranslation();
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const dash = '—';
  return (
    <table className={styles.table} data-testid="streams-table">
      <caption className={styles.visuallyHidden}>{t('pages.caption')}</caption>
      <thead>
        <tr>
          <th>{t('offers.col.product')}</th>
          <th>{t('offers.col.link')}</th>
          <th>{t('offers.col.status')}</th>
          <th className={styles.num}>{t('offers.col.price')}</th>
          <th className={styles.num}>{t('offers.col.clicks')}</th>
          <th className={styles.num}>{t('offers.col.leads')}</th>
          <th className={styles.num}>{t('offers.col.sales')}</th>
          <th className={styles.num}>{t('pages.col.income')}</th>
          <th className={styles.actionsCol}><span className={styles.visuallyHidden}>{t('pages.col.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.stream.id}
            aria-selected={row.stream.id === selectedId}
            onClick={() => onSelect(row.stream.id)}
            data-testid="stream-row"
          >
            <td>
              <span className={styles.stack}>
                <span className={styles.strong}>{row.stream.productName}</span>
                <span className={styles.sub}>{t('pages.created', { date: row.createdLabel })}</span>
              </span>
            </td>
            <td>
              <span className={styles.codeCell}>
                <CodeBadge>{row.stream.code}</CodeBadge>
                <CopyCodeButton stream={row.stream} />
              </span>
            </td>
            <td>
              <span className={styles.stack}>
                <StreamStatusBadges stream={row.stream} status={row.status} />
                {row.status !== 'ACTIVE' ? <span className={styles.sub}>{t(`pages.reason.${row.status}` as TranslationKey)}</span> : null}
              </span>
            </td>
            <td className={styles.num}>
              <span className={styles.stackEnd}>
                <span className={styles.medium}>{sum(row.stream.salePrice)}</span>
                {row.fee !== null ? <span className={styles.sub}>{t('pages.feeShort', { amount: formatMoney(row.fee) })}</span> : null}
              </span>
            </td>
            <td className={styles.num}>{formatMoney(row.stream.clicks)}</td>
            <td className={styles.num}>{formatMoney(row.stream.leads)}</td>
            <td className={`${styles.num} ${styles.strong}`}>{row.stream.sales === null ? dash : formatMoney(row.stream.sales)}</td>
            <td className={styles.num}>
              <span className={styles.stackEnd}>
                <span className={styles.medium}>{row.income === null ? dash : sum(row.income)}</span>
                {row.hold ? <span className={styles.sub}>{t('pages.hold', { amount: formatMoney(row.hold) })}</span> : null}
              </span>
            </td>
            <td className={styles.actionsCol}>
              <StreamMenu stream={row.stream} label={t('pages.actionsFor', { code: row.stream.code })} />
            </td>
          </tr>
        ))}
      </tbody>
      {totals ? (
        <tfoot>
          <tr>
            <td colSpan={4}>{t('pages.total', { count: rows.length })}</td>
            <td className={styles.num}>{formatMoney(totals.clicks)}</td>
            <td className={styles.num}>{formatMoney(totals.leads)}</td>
            <td className={styles.num}>{formatMoney(totals.sales)}</td>
            <td className={styles.num}>
              <span className={styles.stackEnd}>
                <span>{totals.income === null ? dash : sum(totals.income)}</span>
                {totals.hold ? <span className={styles.sub}>{t('pages.hold', { amount: formatMoney(totals.hold) })}</span> : null}
              </span>
            </td>
            <td />
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
