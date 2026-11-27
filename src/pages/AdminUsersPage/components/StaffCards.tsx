import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { displayName, lastLoginText } from '../../../features/staff/lib/staffFormat';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { AccountStatusBadge, Avatar, TwoFactorLine } from '../../../features/staff/ui/StaffBadges';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import type { StaffGroup } from '../model/staffList';
import { groupLabel, groupSuffix } from '../model/staffLabels';
import styles from './StaffTab.module.css';

interface StaffCardsProps {
  groups: readonly StaffGroup[];
  viewerId: string;
  caption: string;
  blockedOnly: boolean;
  onGiveRole: (user: UserAccount) => void;
  /** «Yana 9 ta operator» va «11 / 20 ta xodim ko‘rsatildi». */
  more?: ReactNode;
}

/**
 * Telefon (admin-foydalanuvchilar.mobil, R5): jadval o'rnida rol bo'yicha guruhlangan kartalar; karta — xodim kartasi
 * (ichki sahifa). Roli noma'lum xodim ostida «Rol berish».
 */
export function StaffCards({ groups, viewerId, caption, blockedOnly, onGiveRole, more }: StaffCardsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.cardsBox}>
      <ul className={styles.cards} aria-label={caption} data-testid="staff-cards">
        {groups.map((group) => (
          <Fragment key={group.key}>
            <li className={styles.cardsGroup}>
              <span><strong>{groupLabel(group.key, t)}</strong> {groupSuffix(group, t, blockedOnly)}</span>
              {group.key === 'OPERATOR_LEAD' ? <Link to="/admin/users?tab=teams" className={styles.cardsGroupLink}>{t('staff.toTeams')}<ChevronRight aria-hidden /></Link> : null}
            </li>
            {group.users.map((user) => {
              const name = displayName(user);
              return (
                <li key={user.id} className={styles.cardItem}>
                  <Link to={`/admin/users/${encodeURIComponent(user.id)}`} className={styles.cardLink} aria-label={t('staff.card.aria', { name })}>
                    <Avatar name={user.name || user.phone} size={36} />
                    <span className={styles.cardBody}>
                      <span className={styles.cardTop}>
                        <span className={styles.cardName}>{name}{user.id === viewerId ? <span className={styles.you}> {t('staff.you')}</span> : null}</span>
                        <AccountStatusBadge user={user} />
                      </span>
                      <span className={styles.cardLine}>
                        {user.lastLoginAt === null
                          ? t('staff.card.lineNever', { code: user.code })
                          : t('staff.card.line', { code: user.code, when: user.lastLoginAt ? lastLoginText(user.lastLoginAt, t) : '—' })}
                      </span>
                      <TwoFactorLine user={user} />
                    </span>
                  </Link>
                  {user.role === null ? (
                    <div className={styles.cardAction}>
                      <button type="button" className={styles.outlineFull} onClick={() => onGiveRole(user)}>{t('staff.giveRole')}</button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </Fragment>
        ))}
      </ul>
      {more}
    </div>
  );
}

export function MoreButton({ label, status, onClick }: { label: string; status: string; onClick: () => void }) {
  return (
    <div className={styles.more}>
      <button type="button" className={styles.moreButton} onClick={onClick}><ChevronDown aria-hidden />{label}</button>
      <p role="status">{status}</p>
    </div>
  );
}
