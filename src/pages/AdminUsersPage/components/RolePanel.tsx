import { Check, ChevronRight, CircleCheck, CircleMinus, Clock, History, Info, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getNavGroups } from '../../../app/router/routeAccess';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { useUserHistoryQuery } from '../../../features/staff/api/staffQueries';
import { displayName, lastLoginText } from '../../../features/staff/lib/staffFormat';
import { MENU_PLAN, type MenuStage } from '../../../features/staff/model/menuPlan';
import { grantOf, hasOwnVariant, rolePermissions } from '../../../features/staff/model/permissions';
import { LOGIN_LABEL_KEYS, roleInfo } from '../../../features/staff/model/roleCatalog';
import { AccountStatusBadge, Avatar } from '../../../features/staff/ui/StaffBadges';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge/Badge';
import { PEOPLE_IN_PANEL, peopleSummary, roleGrantedAt, type RoleStat } from '../model/roleStats';
import { AUDIT_PATH, peoplePath } from '../model/rolesLinks';
import styles from './RolePanel.module.css';

const STAGE_VIEW: Record<MenuStage, { tone: BadgeTone; icon: typeof Check }> = {
  M1: { tone: 'success', icon: CircleCheck },
  M2: { tone: 'neutral', icon: CircleMinus },
  TBD: { tone: 'warning', icon: Clock },
};

interface RolePanelProps {
  role: UserRole;
  stat: RoleStat;
  viewerId: string;
  /** drawer — desktop va planshet (o'ngda 480 px); page — telefonda ichki sahifa. */
  variant: 'drawer' | 'page';
  onClose?: () => void;
}

/**
 * Rol paneli (admin-rollar.holatlar «Rol tanlandi», telefonda «Rol sahifasi»): kim, ruxsatlar, menyu (karkas-E §2
 * bosqichi bilan), shu roldagi odamlar. Faqat ko'rish — rol «Xodimlar» tabida beriladi.
 */
export function RolePanel({ role, stat, viewerId, variant, onClose }: RolePanelProps) {
  const { t } = useTranslation();
  const info = roleInfo(role);
  const label = t(info.label);
  const titleId = `role-panel-${role}`;
  const single = stat.users.length === 1 ? stat.users[0] : undefined;
  const history = useUserHistoryQuery(single?.id ?? '', Boolean(single));
  const grantedAt = single ? roleGrantedAt(history.data, role) : null;
  const navIcons = new Map(getNavGroups(role).flatMap((group) => group.routes.map((route) => [route.label, route.navIcon] as const)));
  const permissions = rolePermissions(role);
  const menu = MENU_PLAN[role];
  const external = !info.staff;

  const viewLabel = role === 'AFFILIATE' ? 'staff.rolePanel.viewSellers' : role === 'WHOLESALER' ? 'staff.rolePanel.viewWholesalers' : 'staff.rolePanel.viewStaff';
  const note = external
    ? t('staff.rolePanel.noteExternal')
    : [t('staff.rolePanel.note'), grantedAt ? t('staff.rolePanel.noteGranted', { date: tashkentDay(grantedAt) }) : t('staff.rolePanel.noteAudit')].join(' ');

  const people = (): ReactNode => {
    if (stat.users.length && stat.users.length <= PEOPLE_IN_PANEL) {
      return (
        <ul className={styles.people}>
          {stat.users.map((user) => (
            <li key={user.id} className={styles.person}>
              <Avatar name={user.name || user.phone} size={32} tone="dark" />
              <span className={styles.personText}>
                <span className={styles.personName}>{user.id === viewerId ? `${displayName(user)} ${t('staff.you')}` : displayName(user)}</span>
                <span className={styles.personSub}>
                  {user.lastLoginAt ? t('staff.rolePanel.userLine', { code: user.code, when: lastLoginText(user.lastLoginAt, t) }) : user.lastLoginAt === null ? t('staff.rolePanel.userNever', { code: user.code }) : user.code}
                </span>
              </span>
              <AccountStatusBadge user={user} />
            </li>
          ))}
        </ul>
      );
    }
    const summary = peopleSummary(role, stat, viewerId, t);
    return (
      <div className={styles.summary}>
        {summary ? <p className={styles.summaryText}>{summary}</p> : null}
        {role === 'OPERATOR_LEAD' ? <Link to="/admin/users?tab=teams" className={styles.link}>{t('staff.toTeams')}<ChevronRight aria-hidden /></Link> : null}
      </div>
    );
  };

  const body = (
    <div className={styles.body}>
      <dl className={styles.facts}>
        <div><dt>{t('staff.rolePanel.who')}</dt><dd>{t(info.who)}</dd></div>
        <div><dt>{t('staff.rolePanel.job')}</dt><dd>{t(info.job)}</dd></div>
        <div><dt>{t('staff.rolePanel.login')}</dt><dd>{t(LOGIN_LABEL_KEYS[info.login])}</dd></div>
        <div><dt>{t('staff.rolePanel.code')}</dt><dd>{role}</dd></div>
      </dl>

      <div>
        <p className={styles.blockTitle}>{t('staff.rolePanel.perms', { count: permissions.length })}</p>
        <ul className={styles.perms}>
          {permissions.map((permission) => {
            const grant = grantOf(permission, role);
            const reason = grant === 'own' ? permission.own?.[role] : undefined;
            return (
              <li key={permission.id}>
                <Check aria-hidden />
                <span>
                  {t(permission.label)}
                  {grant === 'own' ? <span className={styles.permSuffix}> {t('staff.rolePanel.permOwn')}</span>
                    : hasOwnVariant(permission) ? <span className={styles.permSuffix}> {t('staff.rolePanel.permAll')}</span> : null}
                  {reason ? <span className={styles.permReason}>{t(reason)}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className={styles.blockTitle}>{t('staff.rolePanel.menu', { count: menu.length })}</p>
        <ul className={styles.menu}>
          {menu.map((item) => {
            const Icon = item.icon;
            const stage = STAGE_VIEW[item.stage];
            return (
              <li key={item.label}>
                <span className={styles.menuIcon} aria-hidden>{Icon ? <Icon /> : navIcons.get(item.label)}</span>
                <span className={styles.menuLabel}>{t(item.label)}</span>
                <Badge tone={stage.tone} icon={stage.icon}>{t(`staff.stage.${item.stage}`)}</Badge>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className={styles.blockTitle}>{t('staff.rolePanel.users', { count: stat.count ?? '—' })}</p>
        {people()}
      </div>

      <p className={styles.note}><Info aria-hidden /><span>{note}</span></p>
    </div>
  );


  if (variant === 'page') {
    return (
      <div className={styles.page} data-testid="role-page" aria-labelledby={titleId}>
        <div className={styles.pageHead}>
          <span className={styles.pageIcon} aria-hidden><Users /></span>
          <div>
            <p id={titleId} className={styles.pageSub}>{t('staff.rolePanel.pageSub')}</p>
            <p className={styles.pageCode}>{role}</p>
          </div>
        </div>
        <div className={styles.card}>{body}</div>
        <nav className={styles.pageActions} aria-label={label}>
          <Link to={peoplePath(role)} className={styles.pageAction}>{t(viewLabel)}<ChevronRight aria-hidden /></Link>
          <Link to={AUDIT_PATH} className={styles.pageAction}>{t('staff.roles.audit')}<History aria-hidden /></Link>
        </nav>
      </div>
    );
  }

  return (
    <aside className={styles.panel} aria-labelledby={titleId} data-testid="role-panel">
      <div className={styles.head}>
        <span className={styles.headIcon} aria-hidden><Users /></span>
        <div className={styles.headText}>
          <h3 id={titleId} className={styles.title}>{label}</h3>
          <p className={styles.sub}>{t('staff.rolePanel.sub')}</p>
        </div>
        <button type="button" className={styles.close} aria-label={t('staff.rolePanel.close')} title={t('staff.rolePanel.close')} onClick={onClose}><X aria-hidden /></button>
      </div>
      <div className={styles.scroll}>{body}</div>
      <div className={styles.foot}>
        <Link to={AUDIT_PATH} className={styles.link}>{t('staff.roles.audit')}<History aria-hidden /></Link>
        <Link to={peoplePath(role)} className={styles.outline}>{t(viewLabel)}</Link>
      </div>
    </aside>
  );
}
