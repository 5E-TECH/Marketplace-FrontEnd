import { ChevronRight, ChevronsUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { displayName, lastLoginText } from '../../../features/staff/lib/staffFormat';
import { roleInfo } from '../../../features/staff/model/roleCatalog';
import { staffPermissions } from '../../../features/staff/model/staffRules';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { AccountStatusBadge, Avatar, TwoFactorCell } from '../../../features/staff/ui/StaffBadges';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import type { SortOrder, StaffGroup } from '../model/staffList';
import { groupLabel, groupSuffix } from '../model/staffLabels';
import { StaffRowMenu, type StaffAction } from './StaffRowMenu';
import styles from './StaffTab.module.css';

interface StaffTableProps {
  groups: readonly StaffGroup[];
  viewer: { id: string; role: UserRole };
  caption: string;
  sort: SortOrder;
  onSort: () => void;
  /** «Holat: Bloklangan» — guruh sarlavhasida «— bloklangan», holat ustida «Blokdan chiqarish» ostida. */
  blockedOnly: boolean;
  onOpen: (user: UserAccount) => void;
  onAction: (user: UserAccount, action: StaffAction) => void;
  /** Filtr natijasi bo'sh — sarlavha ostida ixcham qator. */
  empty?: ReactNode;
  /** Karta ochiq (admin-foydalanuvchi-karta): faqat xodim, oxirgi kirish, holat va amallar. */
  compact?: boolean;
  selectedId?: string;
}

/**
 * Xodimlar jadvali (admin-foydalanuvchilar): rol bo'yicha guruhlar; ustunlar — xodim, kirish, ikki bosqichli kirish,
 * oxirgi kirish (saralanadi), holat, amallar. Planshetda «Kirish» ustuni yo'q. Qatorni bosish — xodim kartasi.
 */
export function StaffTable({ groups, viewer, caption, sort, onSort, blockedOnly, onOpen, onAction, empty, compact = false, selectedId }: StaffTableProps) {
  const { t } = useTranslation();
  const ariaSort = sort === 'lastLoginDesc' ? 'descending' : sort === 'lastLoginAsc' ? 'ascending' : undefined;
  const SortIcon = sort === 'lastLoginDesc' ? ArrowDown : sort === 'lastLoginAsc' ? ArrowUp : ChevronsUpDown;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-testid="staff-table" data-compact={compact || undefined}>
        <caption className={styles.visuallyHidden}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.colStaff}>{t('staff.col.staff')}</th>
            {compact ? null : <th scope="col" className={`${styles.loginCol} ${styles.colLogin}`}>{t('staff.col.login')}</th>}
            {compact ? null : <th scope="col" className={styles.colTfa}>{t('staff.col.tfa')}</th>}
            <th scope="col" className={styles.colLast} aria-sort={ariaSort}>
              <button type="button" className={styles.sortButton} onClick={onSort} title={t('staff.sortLastLogin')}>
                {t('staff.col.lastLogin')}
                <SortIcon aria-hidden />
              </button>
            </th>
            <th scope="col">{t('staff.col.status')}</th>
            <th scope="col" className={styles.actionsCol}><span className={styles.visuallyHidden}>{t('staff.col.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              <tr className={styles.groupRow}>
                <th scope="colgroup" colSpan={compact ? 4 : 6}>
                  <span className={styles.groupHead}>
                    <span><strong>{groupLabel(group.key, t)}</strong> {groupSuffix(group, t, blockedOnly)}</span>
                    {group.key === 'OPERATOR_LEAD' ? <Link to="/admin/users?tab=teams" className={styles.groupLink}>{t('staff.toTeams')}<ChevronRight aria-hidden /></Link> : null}
                  </span>
                </th>
              </tr>
              {group.users.map((user) => <StaffRow key={user.id} user={user} viewer={viewer} compact={compact} selected={user.id === selectedId} onOpen={onOpen} onAction={onAction} />)}
            </Fragment>
          ))}
          {empty ? <tr><td colSpan={compact ? 4 : 6} className={styles.emptyCell}>{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function StaffRow({ user, viewer, compact, selected, onOpen, onAction }: { user: UserAccount; viewer: { id: string; role: UserRole }; compact: boolean; selected: boolean; onOpen: (user: UserAccount) => void; onAction: (user: UserAccount, action: StaffAction) => void }) {
  const { t } = useTranslation();
  const name = displayName(user);
  const login = user.role ? roleInfo(user.role).login : 'password';
  const canUnblock = user.isBlocked && !staffPermissions(viewer, user).block;
  return (
    <tr className={styles.row} onClick={() => onOpen(user)} data-testid={`staff-row-${user.code}`} aria-selected={selected || undefined}>
      <td>
        <span className={styles.person}>
          <Avatar name={user.name || user.phone} />
          <span className={styles.personText}>
            <span className={styles.personName}>{name}{user.id === viewer.id ? <span className={styles.you}> {t('staff.you')}</span> : null}</span>
            <span className={styles.personCode}>{user.code}</span>
          </span>
        </span>
      </td>
      {compact ? null : (
        <td className={styles.loginCol}>
          {login === 'passwordCode'
            ? <span className={styles.loginStack}>{t('staff.login.password')}<span>{t('staff.loginCode')}</span></span>
            : t('staff.login.password')}
        </td>
      )}
      {compact ? null : <td className={styles.tfaCell}><TwoFactorCell user={user} /></td>}
      <td className={styles.numeric}>{user.lastLoginAt ? lastLoginText(user.lastLoginAt, t) : user.lastLoginAt === null ? t('staff.never') : '—'}</td>
      <td>
        <span className={styles.statusCell} data-stacked={user.isBlocked || undefined} data-unknown={user.role === null || undefined}>
          <AccountStatusBadge user={user} />
          {user.role === null ? (
            <button type="button" className={styles.outlineSmall} onClick={(event) => { event.stopPropagation(); onAction(user, 'role'); }}>{t('staff.giveRole')}</button>
          ) : canUnblock ? (
            <button type="button" className={styles.inlineLink} onClick={(event) => { event.stopPropagation(); onAction(user, 'unblock'); }}>{t('staff.unblock')}</button>
          ) : null}
        </span>
      </td>
      <td className={styles.actionsCol}>
        <StaffRowMenu user={user} viewer={viewer} onAction={(action) => onAction(user, action)} />
      </td>
    </tr>
  );
}
