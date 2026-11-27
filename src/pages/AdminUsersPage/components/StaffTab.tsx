import { ChevronDown, Info, ListFilter, RotateCcw, Search, SearchX, TriangleAlert, UserPlus, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROLE_LABEL_KEYS } from '../../../features/auth/lib/roleLabels';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { displayName } from '../../../features/staff/lib/staffFormat';
import { STAFF_ROLES, type UserAccount } from '../../../features/staff/model/staffTypes';
import type { StaffDialogState } from '../../../features/staff/ui/StaffDialogs';
import { useUnblockUser } from '../../../features/staff/ui/useUnblockUser';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDate, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel } from '../../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { PillSelect, type PillOption } from '../../../shared/ui/PillSelect/PillSelect';
import { groupStaff, hasFilters, matchesStaff, parseFilters, parseSort, PHONE_PAGE, phoneSlice, STATUS_FILTERS, type StaffFilters } from '../model/staffList';
import { MoreButton, StaffCards } from './StaffCards';
import type { StaffAction } from './StaffRowMenu';
import { groupLabel } from '../model/staffLabels';
import { StaffTable } from './StaffTable';
import styles from './StaffTab.module.css';

interface StaffTabProps {
  query: { data: UserAccount[] | undefined; isPending: boolean; isError: boolean; error: unknown; dataUpdatedAt: number; refetch: () => unknown };
  viewer: { id: string; role: UserRole };
  phone: boolean;
  /** Karta yoki «Yangi xodim» paneli ochiq (desktop): ro'yxat torayadi — banner, «Kirish», 2FA ustuni va izoh yo'q. */
  compact?: boolean;
  /** Kartasi ochiq xodim — qator belgilanadi. */
  selectedId?: string;
  onOpen: (user: UserAccount) => void;
  onDialog: (state: StaffDialogState) => void;
}

const FILTER_KEYS = { role: 'role', status: 'status', login: 'login' } as const;

/**
 * «Xodimlar» yorlig'i (FE-15, admin-foydalanuvchilar + .planshet/.mobil/.holatlar): roli noma'lum xodim banneri,
 * qidiruv va «Rol», «Holat», «Kirish» filtrlari (URL da; xodimlar soni kichik — brauzerda), rol bo'yicha guruhlangan
 * jadval yoki telefon kartalari, «Rol berish» va «Bloklash» oynalari, «Blokdan chiqarish».
 */
export function StaffTab({ query, viewer, phone, compact = false, selectedId, onOpen, onDialog }: StaffTabProps) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const unblock = useUnblockUser((user) => onDialog({ kind: 'password', user }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const searchId = useId();

  const filters = parseFilters(params);
  const sort = parseSort(params.get('sort'));
  // Joriy manzildan (ketma-ket ikki o'zgarishda birinchisi yo'qolmasin).
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const resetFilters = () => update({ q: null, role: null, status: null, login: null });

  const all = query.data ?? [];
  const rows = all.filter((user) => matchesStaff(user, filters));
  const groups = groupStaff(rows, sort);
  const filtered = hasFilters(filters);
  const blockedOnly = filters.status === 'BLOCKED';
  const unknown = all.find((user) => user.role === null);
  const caption = t(blockedOnly ? 'staff.caption.blocked' : filtered ? 'staff.caption.search' : 'staff.caption.all');

  const onAction = (user: UserAccount, action: StaffAction) => {
    if (action === 'open') onOpen(user);
    else if (action === 'unblock') unblock.run(user);
    else onDialog({ kind: action, user, session: null });
  };

  const anyOption: PillOption = { value: '', label: t('staff.filter.all') };
  const roleOptions: PillOption[] = [anyOption, ...STAFF_ROLES.map((role) => ({ value: role, label: t(ROLE_LABEL_KEYS[role]) }))];
  const statusOptions: PillOption[] = [anyOption, ...STATUS_FILTERS.map((status) => ({ value: status, label: t(STATUS_LABEL[status]) }))];
  const loginOptions: PillOption[] = [anyOption, { value: 'password', label: t('staff.login.password') }, { value: 'passwordCode', label: t('staff.login.passwordCode') }];
  const chips = ([
    ['role', filters.role ? t(ROLE_LABEL_KEYS[filters.role]) : null, 'staff.filter.roleRemove'],
    ['status', filters.status ? t(STATUS_LABEL[filters.status]) : null, 'staff.filter.statusRemove'],
    ['login', filters.login ? t(filters.login === 'password' ? 'staff.login.password' : 'staff.login.passwordCode') : null, 'staff.filter.loginRemove'],
  ] as const).filter(([, label]) => label);

  const searchBox = (
    <span className={styles.search}>
      <Search aria-hidden />
      <label htmlFor={searchId} className={styles.visuallyHidden}>{t('staff.search.aria')}</label>
      <input id={searchId} type="search" value={filters.search} placeholder={t('staff.search.placeholder')} onChange={(event) => update({ q: event.target.value || null })} />
    </span>
  );

  const emptyRow: ReactNode = rows.length ? null : (
    <div className={styles.emptyRow} data-testid="staff-empty">
      <span className={styles.emptyIcon} aria-hidden><SearchX /></span>
      <span className={styles.emptyText}>
        <span className={styles.emptyTitle}>{filters.search.trim() ? t('staff.empty.search', { query: filters.search.trim() }) : t('staff.empty.filter')}</span>
        <span className={styles.emptyHint}>{t(filters.search.trim() ? 'staff.empty.searchText' : 'staff.empty.filterText')}</span>
      </span>
      <button type="button" className={styles.ghostButton} onClick={filters.search.trim() ? () => update({ q: null }) : resetFilters}>
        {t(filters.search.trim() ? 'staff.empty.clearSearch' : 'staff.filter.reset')}
      </button>
    </div>
  );

  // Desktop va planshetda — panel ichida pastda; telefonda — kartalar ostida (admin-foydalanuvchilar).
  const footnote = all.length && !compact ? (
    <p className={styles.footnote}>
      {t('staff.footnote', { count: all.length })}
      <span className={styles.tabletOnly}> {t('staff.footnoteTablet')}</span>
    </p>
  ) : null;

  const list = (): ReactNode => {
    if (query.isPending) return <SkeletonTable />;
    if (phone) {
      if (!rows.length) return <div className={styles.cardsBox}>{emptyRow}</div>;
      const slice = showAll ? null : phoneSlice(groups, PHONE_PAGE);
      const more = slice && slice.remaining > 0 ? (
        <MoreButton
          label={slice.remainingGroup && slice.remainingGroup !== 'UNKNOWN'
            ? t('staff.more', { count: slice.remaining, group: groupLabel(slice.remainingGroup, t).toLocaleLowerCase() })
            : t('staff.moreStaff', { count: slice.remaining })}
          status={t('staff.shown', { shown: slice.shown, total: slice.total })}
          onClick={() => setShowAll(true)}
        />
      ) : null;
      return <StaffCards groups={slice?.groups ?? groups} viewerId={viewer.id} caption={caption} blockedOnly={blockedOnly} onGiveRole={(user) => onDialog({ kind: 'role', user })} more={more} />;
    }
    return (
      <StaffTable
        groups={groups}
        viewer={viewer}
        caption={caption}
        sort={sort}
        onSort={() => update({ sort: sort === 'name' ? 'lastLoginDesc' : sort === 'lastLoginDesc' ? 'lastLoginAsc' : null })}
        blockedOnly={blockedOnly}
        onOpen={onOpen}
        onAction={onAction}
        compact={compact}
        selectedId={selectedId}
        empty={emptyRow}
      />
    );
  };

  return (
    <>
      {unknown && !compact ? <UnknownRoleBanner user={unknown} onGiveRole={() => onDialog({ kind: 'role', user: unknown })} /> : null}

      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} variant="page" context={t('staff.loadError')} text={t('staff.loadErrorText')} />
      ) : phone ? (
        <>
          <div className={styles.phoneFilters} role="search" aria-label={t('staff.filters.aria')}>
            {searchBox}
            <button type="button" className={styles.filtersButton} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
              <ListFilter aria-hidden />
              {t('staff.filters')}
              {chips.length ? <span className={styles.filtersCount}>{chips.length}</span> : null}
            </button>
          </div>
          {chips.length ? (
            <div className={styles.chips}>
              {chips.map(([key, label, removeKey]) => (
                <span key={key} className={styles.chip}>
                  {label}
                  <button type="button" aria-label={t(removeKey)} title={t(removeKey)} onClick={() => update({ [FILTER_KEYS[key]]: null })}><X aria-hidden /></button>
                </span>
              ))}
            </div>
          ) : null}
          {list()}
          {blockedOnly && rows.length ? <p className={styles.note}><Info aria-hidden /><span>{t('staff.blockedNote')}</span></p> : null}
        </>
      ) : (
        <section className={styles.panel} aria-label={caption} data-testid="staff-list">
          <div className={styles.filters} role="search" aria-label={t('staff.filters.aria')}>
            {searchBox}
            <PillSelect label={t('staff.filter.role')} value={filters.role} onChange={(value) => update({ role: value || null })} options={roleOptions} onClear={() => update({ role: null })} clearLabel={t('staff.filter.roleClear')} />
            <PillSelect label={t('staff.filter.status')} value={filters.status} onChange={(value) => update({ status: value || null })} options={statusOptions} onClear={() => update({ status: null })} clearLabel={t('staff.filter.statusClear')} />
            {compact ? null : <PillSelect label={t('staff.filter.login')} value={filters.login} onChange={(value) => update({ login: value || null })} options={loginOptions} onClear={() => update({ login: null })} clearLabel={t('staff.filter.loginClear')} />}
            {filtered ? <button type="button" className={styles.resetButton} onClick={resetFilters}><RotateCcw aria-hidden />{t('staff.filter.reset')}</button> : null}
          </div>
          {list()}
          {blockedOnly && rows.length ? <p className={styles.note}><Info aria-hidden /><span>{t('staff.blockedNote')}</span></p> : null}
          {footnote}
        </section>
      )}

      {phone && footnote}

      {phone ? (
        <PageActionBar>
          <Link to="/admin/users/new" className={styles.barPrimary}><UserPlus aria-hidden />{t('staff.add')}</Link>
        </PageActionBar>
      ) : null}

      {phone ? (
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={t('staff.filters')}
          icon={<ListFilter />}
          footer={(
            <>
              <DialogCancel onClick={() => update({ role: null, status: null, login: null })}>{t('staff.filters.clear')}</DialogCancel>
              <button type="button" className={styles.sheetPrimary} onClick={() => setFiltersOpen(false)}>{t('staff.filters.show', { count: rows.length })}</button>
            </>
          )}
        >
          <SheetSelect label={t('staff.filter.role')} value={filters.role} options={roleOptions} onChange={(value) => update({ role: value || null })} />
          <SheetSelect label={t('staff.filter.status')} value={filters.status} options={statusOptions} onChange={(value) => update({ status: value || null })} />
          <SheetSelect label={t('staff.filter.login')} value={filters.login} options={loginOptions} hint={t('staff.filter.loginHint')} onChange={(value) => update({ login: value || null })} />
        </Dialog>
      ) : null}

    </>
  );
}

const STATUS_LABEL: Record<Exclude<StaffFilters['status'], ''>, TranslationKey> = {
  ACTIVE: 'staff.status.active',
  NEVER_LOGGED_IN: 'staff.status.neverLoggedIn',
  BLOCKED: 'staff.status.blocked',
};

/** «Laylo N. ning roli yo‘q — menyu ochilmaydi» (admin-foydalanuvchilar): kirgan payt va «Rol berish». */
function UnknownRoleBanner({ user, onGiveRole }: { user: UserAccount; onGiveRole: () => void }) {
  const { t } = useTranslation();
  const at = user.lastLoginAt;
  const text = !at ? t('staff.unknown.textNoLogin')
    : tashkentDate(Date.parse(at)) === tashkentDate() ? t('staff.unknown.textToday', { time: tashkentClock(Date.parse(at)) })
      : t('staff.unknown.textDate', { date: tashkentDay(at) });
  return (
    <div className={styles.banner} role="status" data-testid="staff-unknown-banner">
      <TriangleAlert aria-hidden />
      <div>
        <p className={styles.bannerTitle}>{t('staff.unknown.title', { name: displayName(user) })}</p>
        <p className={styles.bannerText}>{text}</p>
        <div className={styles.bannerAction}>
          <button type="button" className={styles.bannerLink} onClick={onGiveRole}>{t('staff.giveRole')}</button>
        </div>
      </div>
    </div>
  );
}

function SheetSelect({ label, value, options, hint, onChange }: { label: string; value: string; options: readonly PillOption[]; hint?: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className={styles.sheetField}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.sheetSelect}>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={hint ? `${id}-h` : undefined}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
      {hint ? <p id={`${id}-h`}>{hint}</p> : null}
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className={styles.tableWrap} aria-busy="true" data-testid="staff-loading">
      <table className={styles.table}>
        <tbody>
          {[0, 1, 2, 3].map((index) => (
            <tr key={index} className={styles.skeletonRow}>
              {Array.from({ length: 5 }, (_, cell) => <td key={cell}><span /><span /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
