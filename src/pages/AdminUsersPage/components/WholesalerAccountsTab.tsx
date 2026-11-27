import { ChevronRight, ExternalLink, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { lastLoginText } from '../../../features/staff/lib/staffFormat';
import { useWholesalersQuery } from '../../../features/wholesalers/api/wholesalersQueries';
import type { Wholesaler } from '../../../features/wholesalers/model/wholesalerTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../../shared/lib/phone';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { AccountRowMenu } from './AccountRowMenu';
import { Avatar } from '../../../features/staff/ui/StaffBadges';
import styles from './StaffTab.module.css';

const WHOLESALERS_PATH = '/admin/wholesalers';
const cardPath = (id: string) => `${WHOLESALERS_PATH}/${encodeURIComponent(id)}`;

/** Kabinet hisobi bor optoviklar: egasi bog'langan yoki kabinetga taklif yuborilgan (FE-25, taklif `cabinet`). */
const hasAccount = (item: Wholesaler) => Boolean(item.ownerUserId || item.cabinet);

interface WholesalerAccountsTabProps {
  viewer: { id: string; role: UserRole };
  phone: boolean;
  onImpersonate: (owner: { id: string; name: string }) => void;
}

/**
 * «Optoviklar» yorlig'i (admin-foydalanuvchilar.holatlar «Tablar»): kabinet hisoblari — kim kiradi (rahbar), holat,
 * kabinet ochilgan va oxirgi faollik. Optovikni admin «Optoviklar» bo'limida ochadi; kabinet — M2. Ma'lumot FE-25
 * optoviklar ro'yxatidan (`GET /admin/wholesalers`), kabinet — taklif (fe-25 §1).
 */
export function WholesalerAccountsTab({ viewer, phone, onImpersonate }: WholesalerAccountsTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useWholesalersQuery();
  const rows = (query.data ?? []).filter(hasAccount);
  const superadmin = viewer.role === 'SUPERADMIN';

  const owner = (item: Wholesaler) => ({ name: item.directorName ?? '—', phone: item.cabinet?.phone ?? item.phone });
  const tin = (item: Wholesaler) => (item.tin ? t('staff.wh.tin', { tin: item.tin }) : null);
  const opened = (item: Wholesaler) => (item.cabinet?.openedAt ? tashkentDateTime(item.cabinet.openedAt) : t('staff.wh.invited'));
  const active = (item: Wholesaler) => (item.cabinet?.lastActiveAt ? lastLoginText(item.cabinet.lastActiveAt, t) : '—');
  const note = <p className={styles.note}><Info aria-hidden /><span>{t('staff.wh.note')}</span></p>;
  const empty = (
    <div className={styles.emptyRow}>
      <span className={styles.emptyText}><span className={styles.emptyTitle}>{t('staff.wh.empty')}</span></span>
    </div>
  );

  const body = (): ReactNode => {
    if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} variant="page" context={t('staff.wh.caption')} text={t('staff.loadErrorText')} />;
    if (phone) {
      return (
        <div className={styles.cardsBox}>
          {rows.length ? (
            <ul className={styles.cards} aria-label={t('staff.wh.caption')} data-testid="wholesaler-accounts-cards">
              {rows.map((item) => (
                <li key={item.id} className={styles.cardItem}>
                  <Link to={cardPath(item.id)} className={styles.cardLink} aria-label={t('staff.wh.cardAria', { name: item.name })}>
                    <Avatar name={item.name} size={36} />
                    <span className={styles.cardBody}>
                      <span className={styles.cardTop}>
                        <span className={styles.cardName}>{item.name}</span>
                        <StatusBadge family="wholesaler" code={item.status} />
                      </span>
                      <span className={styles.cardLine}>{[tin(item), t('staff.login.sms')].filter(Boolean).join(' · ')}</span>
                      <span className={styles.cardLine}>{t('staff.wh.ownerLine', { name: owner(item).name })}</span>
                      <span className={styles.cardLine}>{t('staff.wh.cabinetLine', { opened: opened(item), active: active(item) })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : query.isPending ? null : empty}
          {rows.length ? <div className={styles.more}><p role="status">{t('staff.wh.allShown', { shown: rows.length, total: rows.length })}</p></div> : null}
        </div>
      );
    }
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="wholesaler-accounts-table">
          <caption className={styles.visuallyHidden}>{t('staff.wh.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('staff.wh.col.wholesaler')}</th>
              <th scope="col">{t('staff.wh.col.owner')}</th>
              <th scope="col">{t('staff.col.status')}</th>
              <th scope="col" className={styles.loginCol}>{t('staff.col.login')}</th>
              <th scope="col">{t('staff.wh.col.opened')}</th>
              <th scope="col">{t('staff.wh.col.active')}</th>
              <th scope="col" className={styles.endCol}><span className={styles.visuallyHidden}>{t('staff.col.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} data-testid={`wholesaler-account-${item.id}`}>
                <td>
                  <span className={styles.person}>
                    <Avatar name={item.name} />
                    <span className={styles.personText}>
                      <span className={styles.personName}>{item.name}</span>
                      {tin(item) ? <span className={styles.personCode}>{tin(item)}</span> : null}
                    </span>
                  </span>
                </td>
                <td>
                  <span className={styles.personText}>
                    <span className={styles.ownerName}>{owner(item).name}</span>
                    <span className={styles.personCode}>{t('staff.wh.ownerRole', { phone: owner(item).phone ? formatUzPhone(owner(item).phone ?? '') : '—' })}</span>
                  </span>
                </td>
                <td><StatusBadge family="wholesaler" code={item.status} /></td>
                <td className={styles.loginCol}>{t('staff.login.sms')}</td>
                <td className={styles.numeric}>{opened(item)}</td>
                <td className={styles.numeric}>{active(item)}</td>
                <td className={styles.endCol}>
                  <span className={styles.rowEnd}>
                    <Link to={cardPath(item.id)} className={styles.groupLink}>{t('staff.wh.card')}<ChevronRight aria-hidden /></Link>
                    <AccountRowMenu
                      label={t('staff.rowActions', { name: item.name })}
                      cardLabel={t('staff.wh.card')}
                      canImpersonate={superadmin && Boolean(item.ownerUserId) && item.status === 'ACTIVE'}
                      onAction={(action) => {
                        if (action === 'card') void navigate(cardPath(item.id));
                        else if (action === 'impersonate' && item.ownerUserId) onImpersonate({ id: item.ownerUserId, name: item.name });
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length && !query.isPending ? <tr><td colSpan={7} className={styles.emptyCell}>{empty}</td></tr> : null}
          </tbody>
        </table>
      </div>
    );
  };

  if (phone) return <>{note}{body()}</>;
  return (
    <section className={styles.panel} aria-label={t('staff.wh.caption')} data-testid="wholesaler-accounts">
      {note}
      {body()}
    </section>
  );
}

/** «Optoviklar» bo'limiga havola (sarlavha qatorida, o'ngda). */
export function WholesalersSectionLink() {
  const { t } = useTranslation();
  return <Link to={WHOLESALERS_PATH} className={styles.sectionLink}>{t('staff.wh.link')}<ExternalLink aria-hidden /></Link>;
}
