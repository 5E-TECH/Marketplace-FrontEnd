import { ArrowDown, Ban, ChevronDown, ChevronRight, CircleCheck, ExternalLink, Info, ListFilter, Lock, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { useAccountsQuery } from '../../../features/staff/api/staffQueries';
import { displayName, lastLoginText } from '../../../features/staff/lib/staffFormat';
import type { SellerStatus, UserAccount } from '../../../features/staff/model/staffTypes';
import { Avatar } from '../../../features/staff/ui/StaffBadges';
import type { StaffDialogState } from '../../../features/staff/ui/StaffDialogs';
import { useUnblockUser } from '../../../features/staff/ui/useUnblockUser';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { Dialog, DialogCancel } from '../../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { Pager } from '../../../shared/ui/Pager/Pager';
import { PillSelect, type PillOption } from '../../../shared/ui/PillSelect/PillSelect';
import { AccountRowMenu } from './AccountRowMenu';
import { MoreButton } from './StaffCards';
import styles from './StaffTab.module.css';

const PAGE_SIZE = 10;
const SELLERS_PATH = '/admin/sellers';
const STATUSES: readonly SellerStatus[] = ['ACTIVE', 'WARNING', 'HOLD', 'BLOCKED'];
const parseStatus = (value: string | null): SellerStatus | '' => ((STATUSES as readonly string[]).includes(value ?? '') ? value as SellerStatus : '');

const STATUS_VIEW: Record<SellerStatus, { tone: 'success' | 'warning' | 'danger'; icon: typeof Ban; key: TranslationKey; line: TranslationKey | null }> = {
  ACTIVE: { tone: 'success', icon: CircleCheck, key: 'staff.status.active', line: null },
  WARNING: { tone: 'warning', icon: TriangleAlert, key: 'staff.sellers.status.WARNING', line: 'staff.sellers.line.WARNING' },
  HOLD: { tone: 'warning', icon: Lock, key: 'staff.sellers.status.HOLD', line: 'staff.sellers.line.HOLD' },
  BLOCKED: { tone: 'danger', icon: Ban, key: 'staff.status.blocked', line: 'staff.sellers.line.BLOCKED' },
};

/** Hisob holati: blok ustun, keyin jazo (taklif `sanction`, «Sotuvchilar» bo'limi bilan bir xil); qachondan. */
function sellerStatus(user: UserAccount): { status: SellerStatus; since: string | null } {
  if (user.isBlocked) return { status: 'BLOCKED', since: user.block?.at ?? null };
  if (user.sanction) return { status: user.sanction.kind, since: user.sanction.since };
  return { status: 'ACTIVE', since: null };
}

interface SellersTabProps {
  viewer: { id: string; role: UserRole };
  phone: boolean;
  onDialog: (state: StaffDialogState) => void;
  onImpersonate: (user: UserAccount) => void;
}

/**
 * «Sotuvchilar» yorlig'i (admin-foydalanuvchilar.holatlar «Tablar»): hisob ko'rinishi — kirish, holat, bloklash;
 * lidlar, balans va jazolar «Sotuvchilar» bo'limida. Backend: `GET /admin/users?role=AFFILIATE` (sahifalangan); sahifalar
 * soni, jazo va oxirgi kirish — taklif (fe-15 §11).
 */
export function SellersTab({ viewer, phone, onDialog, onImpersonate }: SellersTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [phoneLimit, setPhoneLimit] = useState(PAGE_SIZE);
  const searchId = useId();
  const search = params.get('q') ?? '';
  const status = parseStatus(params.get('status'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = useAccountsQuery({ role: 'AFFILIATE', search, status: status || undefined, page: phone ? 1 : page, limit: phone ? phoneLimit : PAGE_SIZE });
  const unblock = useUnblockUser();
  const superadmin = viewer.role === 'SUPERADMIN';

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Filtr yoki qidiruv o'zgarsa — ro'yxat boshidan (telefonda «Yana 10 ta» ham qaytadan).
    if (!('page' in patch)) {
      next.delete('page');
      setPhoneLimit(PAGE_SIZE);
    }
    setParams(next, { replace: true });
  };

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const statusOptions: PillOption[] = [{ value: '', label: t('staff.filter.all') }, ...STATUSES.map((value) => ({ value, label: t(STATUS_VIEW[value].key) }))];
  const onAction = (user: UserAccount, action: 'card' | 'impersonate' | 'block' | 'unblock') => {
    if (action === 'impersonate') onImpersonate(user);
    else if (action === 'block') onDialog({ kind: 'block', user });
    else if (action === 'unblock') unblock.run(user);
  };

  const pagesText = (user: UserAccount) => {
    if (!user.affiliate) return null;
    const { streams, stoppedStreams } = user.affiliate;
    return t(streams > 0 && stoppedStreams === streams ? 'staff.sellers.pagesStopped' : 'staff.sellers.pages', { count: streams });
  };

  const searchBox = (
    <span className={styles.search}>
      <Search aria-hidden />
      <label htmlFor={searchId} className={styles.visuallyHidden}>{t('staff.sellers.searchAria')}</label>
      <input id={searchId} type="search" value={search} placeholder={t(phone ? 'staff.sellers.searchPhone' : 'staff.sellers.search')} onChange={(event) => update({ q: event.target.value || null })} />
    </span>
  );

  const empty = (
    <div className={styles.emptyRow} data-testid="sellers-empty">
      <span className={styles.emptyIcon} aria-hidden><SearchX /></span>
      <span className={styles.emptyText}>
        <span className={styles.emptyTitle}>{search.trim() ? t('staff.sellers.emptySearch', { query: search.trim() }) : t('staff.sellers.empty')}</span>
      </span>
      {search || status ? <button type="button" className={styles.ghostButton} onClick={() => update({ q: null, status: null })}>{t('staff.filter.reset')}</button> : null}
    </div>
  );

  const statusCell = (user: UserAccount): ReactNode => {
    const { status: value, since } = sellerStatus(user);
    const view = STATUS_VIEW[value];
    return (
      <>
        <Badge tone={view.tone} icon={view.icon}>{t(view.key)}</Badge>
        {since ? <span className={styles.since}>{t('staff.sellers.since', { date: tashkentDay(since) })}</span> : null}
      </>
    );
  };

  const note = <p className={styles.note}><Info aria-hidden /><span>{t('staff.sellers.note')}</span></p>;

  const body = (): ReactNode => {
    if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} variant="page" context={t('staff.sellers.caption')} text={t('staff.loadErrorText')} />;
    if (phone) {
      return (
        <div className={styles.cardsBox}>
          {rows.length ? (
            <ul className={styles.cards} aria-label={t('staff.sellers.caption')} data-testid="sellers-cards">
              {rows.map((user) => {
                const name = displayName(user);
                const { status: value, since } = sellerStatus(user);
                const line = STATUS_VIEW[value].line;
                return (
                  <li key={user.id} className={styles.cardItem}>
                    <Link to={SELLERS_PATH} className={styles.cardLink} aria-label={t('staff.sellers.cardAria', { name })}>
                      <Avatar name={user.name || user.phone} size={36} />
                      <span className={styles.cardBody}>
                        <span className={styles.cardTop}>
                          <span className={styles.cardName}>{name}</span>
                          <Badge tone={STATUS_VIEW[value].tone} icon={STATUS_VIEW[value].icon}>{t(STATUS_VIEW[value].key)}</Badge>
                        </span>
                        <span className={styles.cardLine}>{[pagesText(user), user.lastLoginAt ? t('staff.sellers.lastLogin', { when: lastLoginText(user.lastLoginAt, t) }) : null].filter(Boolean).join(' · ')}</span>
                        {line && since ? <span className={styles.cardLine}>{t(line, { date: tashkentDay(since) })}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : query.isPending ? null : empty}
          {rows.length && total > rows.length ? (
            <MoreButton
              label={t('staff.sellers.more', { count: Math.min(PAGE_SIZE, total - rows.length) })}
              status={t('staff.sellers.shown', { shown: rows.length, total })}
              onClick={() => setPhoneLimit((limit) => Math.min(100, limit + PAGE_SIZE))}
            />
          ) : null}
        </div>
      );
    }
    return (
      <>
        <div className={styles.tableWrap}>
          <table className={styles.table} data-testid="sellers-table">
            <caption className={styles.visuallyHidden}>{t('staff.sellers.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('staff.sellers.col.seller')}</th>
                <th scope="col">{t('staff.col.status')}</th>
                <th scope="col" className={styles.loginCol}>{t('staff.col.login')}</th>
                <th scope="col" aria-sort="descending"><span className={styles.sortStatic}>{t('staff.col.lastLogin')}<ArrowDown aria-hidden /></span></th>
                <th scope="col" className={styles.endCol}><span className={styles.visuallyHidden}>{t('staff.col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const name = displayName(user);
                const blocked = user.isBlocked;
                return (
                  <tr key={user.id} data-testid={`seller-row-${user.code}`}>
                    <td>
                      <span className={styles.person}>
                        <Avatar name={user.name || user.phone} />
                        <span className={styles.personText}>
                          <span className={styles.personName}>{name}</span>
                          <span className={styles.personCode}>{pagesText(user) ?? user.code}</span>
                        </span>
                      </span>
                    </td>
                    <td className={styles.tfaCell}>{statusCell(user)}</td>
                    <td className={styles.loginCol}>{t('staff.login.sms')}</td>
                    <td className={styles.numeric}>{user.lastLoginAt ? lastLoginText(user.lastLoginAt, t) : '—'}</td>
                    <td className={styles.endCol}>
                      <span className={styles.rowEnd}>
                        <Link to={SELLERS_PATH} className={styles.groupLink}>{t('staff.sellers.card')}<ChevronRight aria-hidden /></Link>
                        <AccountRowMenu
                          label={t('staff.rowActions', { name })}
                          cardLabel={t('staff.sellers.card')}
                          canImpersonate={superadmin && !blocked}
                          block={blocked ? 'unblock' : 'block'}
                          onAction={(action) => (action === 'card' ? void navigate(SELLERS_PATH) : onAction(user, action))}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && !query.isPending ? <tr><td colSpan={5} className={styles.emptyCell}>{empty}</td></tr> : null}
            </tbody>
          </table>
        </div>
        {total > PAGE_SIZE ? (
          <Pager page={page} pageSize={PAGE_SIZE} total={total} totalLabel={t('staff.sellers.total', { total })} onPage={(next) => update({ page: next > 1 ? String(next) : null })} />
        ) : null}
      </>
    );
  };

  if (phone) {
    return (
      <>
        {note}
        <div className={styles.phoneFilters} role="search" aria-label={t('staff.sellers.filters')}>
          {searchBox}
          <button type="button" className={styles.filtersButton} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            <ListFilter aria-hidden />
            {t('staff.filters')}
            {status ? <span className={styles.filtersCount}>1</span> : null}
          </button>
        </div>
        {status ? (
          <div className={styles.chips}>
            <span className={styles.chip}>
              {t(STATUS_VIEW[status].key)}
              <button type="button" aria-label={t('staff.filter.statusRemove')} title={t('staff.filter.statusRemove')} onClick={() => update({ status: null })}><X aria-hidden /></button>
            </span>
          </div>
        ) : null}
        {body()}
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={t('staff.filters')}
          icon={<ListFilter />}
          footer={(
            <>
              <DialogCancel onClick={() => update({ status: null })}>{t('staff.filters.clear')}</DialogCancel>
              <button type="button" className={styles.sheetPrimary} onClick={() => setFiltersOpen(false)}>{t('staff.sellers.filtersShow', { count: total })}</button>
            </>
          )}
        >
          <SheetStatus value={status} options={statusOptions} onChange={(value) => update({ status: value || null })} />
        </Dialog>
      </>
    );
  }

  return (
    <section className={styles.panel} aria-label={t('staff.sellers.caption')} data-testid="sellers-list">
      {note}
      <div className={styles.filters} role="search" aria-label={t('staff.sellers.filters')}>
        {searchBox}
        <PillSelect label={t('staff.filter.status')} value={status} onChange={(value) => update({ status: value || null })} options={statusOptions} onClear={() => update({ status: null })} clearLabel={t('staff.filter.statusClear')} />
      </div>
      {body()}
    </section>
  );
}

function SheetStatus({ value, options, onChange }: { value: string; options: readonly PillOption[]; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.sheetField}>
      <label htmlFor={id}>{t('staff.filter.status')}</label>
      <span className={styles.sheetSelect}>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </div>
  );
}

/** «Sotuvchilar» bo'limiga havola (sarlavha qatorida, o'ngda). */
export function SellersSectionLink() {
  const { t } = useTranslation();
  return <Link to={SELLERS_PATH} className={styles.sectionLink}>{t('staff.sellers.link')}<ExternalLink aria-hidden /></Link>;
}
