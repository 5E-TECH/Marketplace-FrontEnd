import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isFresh, leadDayTime } from '../../../features/adminLeads/lib/leadRows';
import type { AdminLeadListItem } from '../../../features/adminLeads/model/adminLeadTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { CheckBox } from '../../../shared/ui/CheckBox/CheckBox';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { statusKey } from '../../../shared/ui/StatusBadge/statusConfig';
import styles from '../AdminLeadsPage.module.css';

interface LeadCardsProps {
  rows: readonly AdminLeadListItem[];
  base: string;
  now: number;
  caption: string;
  /** «Lidlarni tanlash» rejimi: karta bosilsa belgilanadi (lid kartasi ochilmaydi). */
  selecting: boolean;
  selected: ReadonlySet<string>;
  onSelect: (ids: readonly string[], checked: boolean) => void;
  total: number;
  onMore: (() => void) | null;
  moreCount: number;
}

/**
 * Telefon (admin-lidlar.mobil): kartalar — oddiy ko'rinishda bosilsa lid kartasi (R5), «Tanlash» rejimida chapda
 * katakcha. Pastda «Yana 10 ta lid» va «10 / 240 ta lid ko'rsatildi».
 */
export function LeadCards({ rows, base, now, caption, selecting, selected, onSelect, total, onMore, moreCount }: LeadCardsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.cardList}>
      <ul aria-label={caption}>
        {rows.map((lead) => {
          const body = <CardBody lead={lead} now={now} />;
          return (
            <li key={lead.id} data-testid="lead-row" data-fresh={isFresh(lead, now) || undefined}>
              {selecting ? (
                <label className={styles.cardSelect}>
                  <span className={styles.checkHit}>
                    <CheckBox aria-label={t('al.selectRow', { id: lead.id })} checked={selected.has(lead.id)} onChange={(event) => onSelect([lead.id], event.target.checked)} />
                  </span>
                  {body}
                </label>
              ) : (
                <Link
                  className={styles.cardLink}
                  to={`${base}/${encodeURIComponent(lead.id)}`}
                  aria-label={t('al.cardOpen', { id: lead.id, name: lead.customerName, status: t(statusKey('lead', lead.status)) })}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.cardMore}>
        {onMore ? <button type="button" className={styles.secondary} onClick={onMore}><ChevronDown aria-hidden />{t('al.more', { count: moreCount })}</button> : null}
        <p role="status">{t('al.shown', { shown: rows.length, total })}</p>
      </div>
    </div>
  );
}

function CardBody({ lead, now }: { lead: AdminLeadListItem; now: number }) {
  const { t } = useTranslation();
  const fresh = isFresh(lead, now);
  const note = fresh ? t('al.justNow', { time: tashkentClock(Date.parse(lead.statusAt ?? '')) }) : lead.status === 'NEW' ? null : lead.closedNote;
  const meta = [lead.streamCode, lead.affiliateName, leadDayTime(lead.createdAt, t, now)].filter(Boolean);
  return (
    <span className={styles.cardBody}>
      <span className={styles.cardTop}>
        <span className={styles.cardId}>{lead.id}</span>
        <StatusBadge family="lead" code={lead.status} />
      </span>
      <span className={styles.cardName}>
        {lead.customerName}
        {lead.regionName ? <span> · {lead.regionName}</span> : null}
      </span>
      {note ? <span className={styles.statusNote}>{note}</span> : null}
      <span className={styles.cardBottom}>
        <span className={styles.cardMeta}>
          {meta.map((item, index) => <span key={index}>{index ? ' · ' : ''}{item}</span>)}
        </span>
        {lead.salePrice ? <span className={styles.cardPrice}>{t('al.sum', { amount: formatMoney(lead.salePrice) })}</span> : null}
      </span>
    </span>
  );
}
