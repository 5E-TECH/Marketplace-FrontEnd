import { Tooltip } from 'antd';
import {
  AudioLines, Ban, Check, ChevronRight, Eye, History, Info, KeyRound, Lock, Printer, ShieldAlert, TriangleAlert, UserCog,
  UserRound, type LucideIcon,
} from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { displayName, enteredText } from '../../../features/staff/lib/staffFormat';
import { menuStats } from '../../../features/staff/model/menuPlan';
import { grantOf, MATRIX_ROLES, PERMISSIONS, rolePermissions, type Permission } from '../../../features/staff/model/permissions';
import { LOGIN_LABEL_KEYS, ROLE_CATALOG, roleInfo } from '../../../features/staff/model/roleCatalog';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { rich } from '../../../shared/i18n/richText';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { usePageHeaderSlot } from '../../../shared/ui/PageHeader/pageTitle';
import { countText, peopleSummary, type RoleStat } from '../model/roleStats';
import { AUDIT_PATH, rolePath } from '../model/rolesLinks';
import styles from './RolesTab.module.css';

export type RolesLayout = 'desktop' | 'tablet' | 'phone';

const STAFF_ROLES = ROLE_CATALOG.filter((info) => info.staff).map((info) => info.role);
const EXTERNAL_ROLES = ROLE_CATALOG.filter((info) => !info.staff).map((info) => info.role);
/** «superadmin uchun — [13-qaror]», «kirish usuli — [13-qaror]»: kirish usuli hali qaror kutmoqda (dizayn belgisi). */
const LOGIN_DECISION: Partial<Record<UserRole, TranslationKey>> = { SUPERADMIN: 'staff.roles.decision.superadmin', AFFILIATE: 'staff.roles.decision.affiliate' };

const RULES: readonly { icon: LucideIcon; title: TranslationKey; text: TranslationKey }[] = [
  { icon: Ban, title: 'staff.rules.block', text: 'staff.rules.blockText' },
  { icon: ShieldAlert, title: 'staff.rules.otherRole', text: 'staff.rules.otherRoleText' },
  { icon: KeyRound, title: 'staff.rules.twoFactor', text: 'staff.rules.twoFactorText' },
  { icon: Eye, title: 'staff.rules.phone', text: 'staff.rules.phoneText' },
  { icon: AudioLines, title: 'staff.rules.recordings', text: 'staff.rules.recordingsText' },
  { icon: History, title: 'staff.rules.audit', text: 'staff.rules.auditText' },
  { icon: UserRound, title: 'staff.rules.customer', text: 'staff.rules.customerText' },
  { icon: UserCog, title: 'staff.rules.grant', text: 'staff.rules.grantText' },
];

interface RolesTabProps {
  layout: RolesLayout;
  stats: Record<UserRole, RoleStat>;
  /** Roli frontendga noma'lum xodimlar (eski rol): «Noma’lum rol» qatori. */
  unknown: readonly UserAccount[];
  staffCount: number | null;
  /** Sonlar qachon olingani («14:37 holatida»). */
  updatedAt: number;
  viewerId: string;
  selected: UserRole | null;
  onSelect: (role: UserRole) => void;
}

/**
 * «Rollar va ruxsatlar» yorlig'i (admin-rollar, .planshet, .mobil): faqat ko'rish — sakkiz rol, «Kim nima qila oladi»
 * matritsasi va qoidalar. Ruxsatlar tizimda belgilangan (backend guard'lari), sonlar — foydalanuvchilar ro'yxatidan.
 */
export function RolesTab({ layout, stats, unknown, staffCount, updatedAt, viewerId, selected, onSelect }: RolesTabProps) {
  const { t } = useTranslation();
  const headerSlot = usePageHeaderSlot();
  const time = tashkentClock(updatedAt || Date.now());
  const roleLabel = (role: UserRole) => t(roleInfo(role).label);

  const readonly = (
    <span className={styles.readonly}>
      <Lock aria-hidden />
      {t('staff.roles.readonlyLabel')}
      <span>{t('staff.roles.readonlyValue')}</span>
    </span>
  );

  const loginCell = (role: UserRole) => {
    const info = roleInfo(role);
    const decision = LOGIN_DECISION[role];
    return (
      <>
        <span className={styles.login}><KeyRound aria-hidden />{t(LOGIN_LABEL_KEYS[info.login])}</span>
        {decision ? <span className={styles.decision}>{t(decision)} <span className={styles.nowrap}>{t('staff.roles.decision.mark')}</span></span> : null}
      </>
    );
  };

  const menuCell = (role: UserRole) => {
    const stats_ = menuStats(role);
    return (
      <span className={styles.stack}>
        <span className={styles.stackMain}>{t('staff.roles.menuItems', { count: stats_.total })}</span>
        <span className={styles.stackSub}>{stats_.current ? t('staff.roles.menuCurrent', { count: stats_.current }) : t('staff.stage.M2')}</span>
      </span>
    );
  };

  const usersCell = (role: UserRole) => (
    <span className={`${styles.stack} ${styles.stackEnd}`}>
      <span className={styles.stackCount}>{countText(role, stats[role])}</span>
      <span className={styles.stackSub}>{peopleSummary(role, stats[role], viewerId, t)}</span>
    </span>
  );

  const unknownLine = (user: UserAccount) => {
    const at = user.lastLoginAt ? Date.parse(user.lastLoginAt) : Number.NaN;
    const entered = Number.isNaN(at) || !user.lastLoginAt
      ? null
      : tashkentDate(at) === tashkentDate() ? t('staff.roles.enteredToday', { time: tashkentClock(at) }) : enteredText(user.lastLoginAt, t);
    const text = entered
      ? t('staff.roles.unknownLine', { code: user.code, entered })
      : t('staff.roles.unknownLineNoLogin', { code: user.code });
    return rich(text, { name: <strong>{displayName(user)}</strong> });
  };

  const unknownBadge = <Badge tone="warning" icon={TriangleAlert}>{t('staff.status.unknownRole')}</Badge>;
  const giveRoleLink = <Link to="/admin/users" className={styles.link}>{t('staff.roles.giveRole')}<ChevronRight aria-hidden /></Link>;
  const staffGroup = t('staff.roles.group.staff', { roles: STAFF_ROLES.length, people: staffCount ?? '—' });
  const externalGroup = t('staff.roles.group.external', { roles: EXTERNAL_ROLES.length });
  const roleName = (role: UserRole) => (
    <>
      <span className={styles.roleName}>{roleLabel(role)}</span>
      <span className={styles.roleCode}>{role}</span>
    </>
  );

  /* ── Sakkiz rol ── */
  const rolesTable = () => {
    const tablet = layout === 'tablet';
    const columns = tablet ? 5 : 6;
    const row = (role: UserRole, last: boolean) => {
      const info = roleInfo(role);
      return (
        <tr key={role} data-testid={`role-row-${role}`} data-last={last || undefined}>
          <td>
            {tablet ? (
              <button type="button" className={styles.roleButton} aria-label={t('staff.roles.openPanel', { role: roleLabel(role) })} aria-pressed={selected === role} onClick={() => onSelect(role)}>
                {roleName(role)}
              </button>
            ) : <span className={styles.roleStack}>{roleName(role)}</span>}
          </td>
          {tablet ? (
            <td className={styles.wrap}>{t(info.job)}<span className={styles.whoLine}>{t(info.who)}</span></td>
          ) : (
            <>
              <td className={`${styles.wrap} ${styles.whoCol}`}>{t(info.who)}</td>
              <td className={`${styles.wrap} ${styles.jobCol}`}>{t(info.job)}</td>
            </>
          )}
          <td className={styles.wrap}>{loginCell(role)}</td>
          <td className={styles.end}>{menuCell(role)}</td>
          <td className={styles.end}>{usersCell(role)}</td>
        </tr>
      );
    };
    return (
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${tablet ? styles.tableTablet : ''}`} data-testid="roles-table">
          <caption className={styles.visuallyHidden}>{t('staff.roles.title')}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.colRole}>{t('staff.roles.col.role')}</th>
              {tablet ? <th scope="col">{t('staff.roles.col.jobWho')}</th> : <><th scope="col">{t('staff.roles.col.who')}</th><th scope="col">{t('staff.roles.col.job')}</th></>}
              <th scope="col" className={styles.colLogin}>{t('staff.roles.col.login')}</th>
              <th scope="col" className={`${styles.end} ${styles.colMenu}`}>{t('staff.roles.col.menu')}</th>
              <th scope="col" className={`${styles.end} ${styles.colPeople}`}>{t(tablet ? 'staff.roles.col.people' : 'staff.roles.col.users')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.groupRow}><td colSpan={columns}>{staffGroup}</td></tr>
            {STAFF_ROLES.map((role) => row(role, false))}
            {unknown.map((user) => (
              <tr key={user.id} data-testid="role-unknown-row">
                <td colSpan={columns} className={styles.unknownCell}>
                  <div className={styles.unknown}>
                    {unknownBadge}
                    <span className={styles.unknownText}>{unknownLine(user)}</span>
                    <span className={styles.unknownLink}>{giveRoleLink}</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className={styles.groupRow}><td colSpan={columns}>{externalGroup}</td></tr>
            {EXTERNAL_ROLES.map((role, index) => row(role, index === EXTERNAL_ROLES.length - 1))}
          </tbody>
        </table>
      </div>
    );
  };

  const rolesList = () => (
    <ul className={styles.roleCards} aria-label={t('staff.roles.title')} data-testid="roles-cards">
      <li className={styles.cardGroup}>{staffGroup}</li>
      {STAFF_ROLES.map(roleCard)}
      {unknown.map((user) => (
        <li key={user.id} className={styles.cardUnknown} data-testid="role-unknown-row">
          {unknownBadge}
          <span className={styles.unknownText}>{unknownLine(user)}</span>
          {giveRoleLink}
        </li>
      ))}
      <li className={styles.cardGroup}>{externalGroup}</li>
      {EXTERNAL_ROLES.map(roleCard)}
    </ul>
  );

  function roleCard(role: UserRole) {
    const info = roleInfo(role);
    const stat = stats[role];
    const menu = menuStats(role);
    const decision = LOGIN_DECISION[role];
    const login = t(LOGIN_LABEL_KEYS[info.login]);
    return (
      <li key={role} className={styles.cardItem}>
        <Link to={rolePath(role)} className={styles.card} aria-label={t('staff.roles.cardAria', { role: roleLabel(role), count: countText(role, stat) })}>
          <span className={styles.cardTop}>
            <span className={styles.cardName}>{roleLabel(role)} <span className={styles.roleCode}>{role}</span></span>
            <span className={styles.cardCount}>{countText(role, stat)}</span>
          </span>
          <span className={styles.cardMeta}>
            <span>{t(info.who)}</span>
            <span className={styles.cardPeople}>{peopleSummary(role, stat, viewerId, t)}</span>
          </span>
          <span className={styles.cardJob}>{t(info.job)}</span>
          <span className={styles.cardLogin}>
            <KeyRound aria-hidden />
            <span>{menu.current ? t('staff.roles.cardLine', { login, total: menu.total, current: menu.current }) : t('staff.roles.cardLineLater', { login, total: menu.total })}</span>
          </span>
          {decision ? <span className={styles.decision}>{t(decision)} <span className={styles.nowrap}>{t('staff.roles.decision.mark')}</span></span> : null}
        </Link>
      </li>
    );
  }

  /* ── Kim nima qila oladi ── */
  const ownChip = (permission: Permission, role: UserRole, withName = false) => {
    const reason = permission.own?.[role];
    const more = reason ? (`${reason}More` as TranslationKey) : null;
    const chip = (
      <span className={withName ? styles.ownRoleChip : styles.ownChip} tabIndex={withName ? undefined : 0} aria-describedby={withName ? undefined : `own-${permission.id}-${role}`}>
        {withName ? t('staff.perm.roleOwn', { role: roleLabel(role) }) : t('staff.perm.own')}
        {withName ? null : <Info aria-hidden />}
      </span>
    );
    if (withName) return chip;
    return (
      <>
        <Tooltip title={more ? t(more) : null} trigger={['hover', 'focus']} color="var(--color-text)" rootClassName={styles.tooltip}>{chip}</Tooltip>
        {reason ? <span id={`own-${permission.id}-${role}`} className={styles.visuallyHidden}>{t(reason)}</span> : null}
      </>
    );
  };

  const yesMark = <span className={styles.yes} role="img" aria-label={t('staff.perm.yes')}><Check aria-hidden /></span>;
  const noMark = <><span className={styles.no} aria-hidden>—</span><span className={styles.visuallyHidden}>{t('staff.perm.no')}</span></>;

  const matrixTable = () => (
    <div className={styles.matrixWrap}>
      <table className={styles.matrix} data-testid="permissions-matrix">
        <caption className={styles.visuallyHidden}>{t('staff.perm.title')}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.actionCol}>{t('staff.perm.col.action')}</th>
            {MATRIX_ROLES.map((role) => (
              <th key={role} scope="col" className={styles.roleCol} data-selected={selected === role || undefined}>
                <button type="button" className={styles.colButton} aria-pressed={selected === role} onClick={() => onSelect(role)}>
                  <span className={styles.colName}>{roleLabel(role)}</span>
                  <span className={styles.colCount}>{role === 'SUPERADMIN' ? t('staff.perm.allActions') : t('staff.perm.count', { count: countText(role, stats[role]) })}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission.id} data-testid={`perm-row-${permission.id}`}>
              <th scope="row" className={styles.actionCell}>
                {t(permission.label)}
                {permission.note ? <span className={styles.actionNote}>{t(permission.note)}</span> : null}
              </th>
              {MATRIX_ROLES.map((role) => {
                const grant = grantOf(permission, role);
                return (
                  <td key={role} data-selected={selected === role || undefined}>
                    {grant === 'yes' ? yesMark : grant === 'own' ? ownChip(permission, role) : noMark}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const whoCan = (permission: Permission) => {
    const allowed = MATRIX_ROLES.filter((role) => grantOf(permission, role));
    const denied = MATRIX_ROLES.filter((role) => !grantOf(permission, role));
    const ownReasons = allowed.map((role) => (grantOf(permission, role) === 'own' ? permission.own?.[role] : undefined)).filter((key): key is TranslationKey => Boolean(key));
    return (
      <>
        <div className={styles.chips}>
          {allowed.map((role) => (grantOf(permission, role) === 'own'
            ? <Fragment key={role}>{ownChip(permission, role, true)}</Fragment>
            : <span key={role} className={styles.roleChip}><Check aria-hidden />{roleLabel(role)}</span>))}
        </div>
        {ownReasons.map((key) => <span key={key} className={styles.ownReason}>{t(key)}</span>)}
        {denied.length ? <span className={styles.visuallyHidden}>{t('staff.perm.denied', { roles: denied.map(roleLabel).join(', ') })}</span> : null}
      </>
    );
  };

  const matrixNarrow = () => (layout === 'phone' ? (
    <ul className={styles.permList} aria-label={t('staff.perm.title')} data-testid="permissions-list">
      {PERMISSIONS.map((permission) => (
        <li key={permission.id}>
          <span className={styles.permTitle}>
            {t(permission.label)}
            {permission.note ? <span className={styles.actionNote}>{t(permission.note)}</span> : null}
          </span>
          <div>{whoCan(permission)}</div>
        </li>
      ))}
    </ul>
  ) : (
    <div className={styles.tableWrap}>
      <table className={styles.whoTable} data-testid="permissions-list">
        <caption className={styles.visuallyHidden}>{t('staff.perm.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('staff.perm.col.action')}</th>
            <th scope="col">{t('staff.perm.col.who')}</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission.id}>
              <th scope="row">
                {t(permission.label)}
                {permission.note ? <span className={styles.actionNote}>{t(permission.note)}</span> : null}
              </th>
              <td>{whoCan(permission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ));

  const desktop = layout === 'desktop';
  const legend = (
    <div className={styles.legend}>
      {desktop ? (
        <>
          <span className={styles.legendItem}>{yesMark}{t('staff.perm.yes')}</span>
          <span className={styles.legendItem}><span className={styles.ownChip}>{t('staff.perm.own')}</span>{t('staff.perm.ownLegend')}</span>
          <span className={styles.legendItem}><span className={styles.no} aria-hidden>—</span>{t('staff.perm.no')}</span>
        </>
      ) : (
        <>
          <span className={styles.legendItem}><span className={styles.roleChip}><Check aria-hidden />{roleLabel('ADMIN')}</span>{t('staff.perm.yes')}</span>
          <span className={styles.legendItem}><span className={styles.ownRoleChip}>{t('staff.perm.roleOwn', { role: roleLabel('OPERATOR_LEAD') })}</span>{t('staff.perm.ownLegend')}</span>
          <span>{t('staff.perm.missingRole')}</span>
        </>
      )}
      <span>{t('staff.perm.superadminAll')}</span>
    </div>
  );

  const matrixSub = desktop && selected
    ? t('staff.perm.selected', { role: roleLabel(selected), count: rolePermissions(selected).length })
    : t(desktop ? 'staff.perm.sub' : 'staff.perm.subNarrow');

  const section = (id: string, title: string, sub: string, content: ReactNode, action?: ReactNode, className?: string) => (
    <section className={`${styles.section} ${className ?? ''}`} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionText}>
          <h2 id={id} className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionSub}>{sub}</p>
        </div>
        {action}
      </div>
      {content}
    </section>
  );

  return (
    <div className={styles.tab} data-testid="roles-tab" data-layout={layout}>
      {desktop ? (headerSlot ? createPortal(readonly, headerSlot) : null) : (
        <div className={styles.narrowBar}>
          {readonly}
          <Link to={AUDIT_PATH} className={styles.link}>{t('staff.roles.audit')}<History aria-hidden /></Link>
        </div>
      )}
      <div className={styles.note} role="note">
        <Info aria-hidden />
        <div>
          <p className={styles.noteTitle}>{t('staff.roles.noteTitle')}</p>
          <p className={styles.noteText}>{t('staff.roles.noteText')}</p>
        </div>
      </div>

      {section('roles-title', t('staff.roles.title'), t(desktop ? 'staff.roles.sub' : 'staff.roles.subNarrow', { time }), layout === 'phone' ? rolesList() : rolesTable())}

      {section(
        'matrix-title', t('staff.perm.title'), matrixSub,
        <>{legend}{desktop ? matrixTable() : matrixNarrow()}</>,
        <button type="button" className={styles.outlineButton} onClick={() => window.print()}><Printer aria-hidden />{t('staff.perm.print')}</button>,
        styles.printable,
      )}

      {section('rules-title', t('staff.rules.title'), t('staff.rules.sub'), (
        <div className={styles.rules}>
          {RULES.map(({ icon: Icon, title, text }) => (
            <div key={title} className={styles.rule}>
              <span className={styles.ruleIcon} aria-hidden><Icon /></span>
              <div>
                <p className={styles.ruleTitle}>{t(title)}</p>
                <p className={styles.ruleText}>{t(text)}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
