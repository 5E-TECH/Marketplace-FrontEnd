import { Dropdown } from 'antd';
import { ArrowDown, ChevronDown, ChevronsUpDown, EllipsisVertical, FolderPlus, Info, ListFilter, Search, SearchX, UserCog, UserPlus, X } from 'lucide-react';
import { Fragment, useId, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOperatorsLiveQuery, useOperatorsStatsQuery, useSoftphonesQuery, useTeamsQuery } from '../../../features/staff/api/staffQueries';
import { presenceLine, supervisorPresence } from '../../../features/staff/lib/operatorFormat';
import { displayName, lastLoginText } from '../../../features/staff/lib/staffFormat';
import type { Team, UserAccount } from '../../../features/staff/model/staffTypes';
import { AssignTeamDialog } from '../../../features/staff/ui/AssignTeamDialog';
import { SoftphoneDialog } from '../../../features/staff/ui/SoftphoneDialog';
import { Avatar } from '../../../features/staff/ui/StaffBadges';
import type { StaffDialogState } from '../../../features/staff/ui/StaffDialogs';
import { TeamSupervisorDialog } from '../../../features/staff/ui/TeamSupervisorDialog';
import { useUnblockUser } from '../../../features/staff/ui/useUnblockUser';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { Dialog, DialogCancel } from '../../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { PillSelect, type PillOption } from '../../../shared/ui/PillSelect/PillSelect';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import {
  bookingsValue, buildRows, FILTER_WORKSPACES, matchesRow, parseTeamFilters, PRESENCES, sortRows, teamSummary,
  type OperatorRow, type TeamSummary,
} from '../model/operatorTeam';
import { Dot, OperatorRowMenu, PresenceCell, SoftphoneCell, StatsCell, WorkspaceCell, type OperatorAction } from './OperatorParts';
import styles from './OperatorsTab.module.css';

export type OperatorsLayout = 'desktop' | 'tablet' | 'phone';

type LocalDialog =
  | { kind: 'softphone'; row: OperatorRow }
  | { kind: 'assign'; user: UserAccount }
  | { kind: 'team'; mode: 'create' | 'change'; team?: Team };

interface OperatorsTabProps {
  layout: OperatorsLayout;
  /** Hamma xodim (operatorlar va nazoratchilar) — «Xodimlar» bilan bitta so'rov. */
  staff: readonly UserAccount[] | undefined;
  staffError: unknown;
  onRetry: () => void;
  onDialog: (state: StaffDialogState) => void;
  onOpenCard: (user: UserAccount) => void;
  onAdd: (teamId: string | null) => void;
}

const BAR_TONES = ['ONLINE', 'BREAK', 'OFFLINE', 'BLOCKED'] as const;

/**
 * «Operatorlar jamoasi» (admin-operatorlar-jamoasi + .planshet/.mobil/.holatlar): jamoa kartasi (nazoratchi, ko'rsatkichlar,
 * holat chizig'i), operatorlar — hozirgi holat, softfon hisobi, ish joyi, davr ko'rsatkichlari, bronlar. Jamoa bo'lmasa —
 * «Hali jamoa yo‘q» va jamoasiz operatorlar. Jonli holat — `queue-summary` (har 15 s); softfon, ko'rsatkichlar, jamoa —
 * taklif (fe-15 §13).
 */
export function OperatorsTab({ layout, staff, staffError, onRetry, onDialog, onOpenCard, onAdd }: OperatorsTabProps) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filters = parseTeamFilters(params);
  const [dialog, setDialog] = useState<LocalDialog | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchId = useId();
  const teams = useTeamsQuery();
  const live = useOperatorsLiveQuery();
  const softphones = useSoftphonesQuery();
  const stats = useOperatorsStatsQuery(filters.period);
  const unblock = useUnblockUser((user) => onDialog({ kind: 'password', user }));
  const phone = layout === 'phone';

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  if (staffError) return <LoadError error={staffError} onRetry={onRetry} variant="page" context={t('staff.tab.teams')} text={t('staff.ops.loadError')} />;

  const users = staff ?? [];
  const rows = buildRows(users.filter((user) => user.role === 'OPERATOR_LEAD'), live.data, softphones.data, stats.data);
  const teamList = teams.data ?? [];
  const teamIds = new Set(teamList.map((team) => team.id));
  const rowsOf = (team: Team) => rows.filter((row) => row.user.team?.id === team.id);
  const unassigned = rows.filter((row) => !row.user.team || !teamIds.has(row.user.team.id));
  const supervisors = users.filter((user) => user.role === 'SUPERVISOR');
  const candidates = supervisors.filter((user) => !user.isBlocked && !teamList.some((team) => team.supervisor.id === user.id));
  const onlineByTeam = Object.fromEntries(teamList.map((team) => [team.id, rowsOf(team).filter((row) => row.presence === 'ONLINE').length]));

  const act = (row: OperatorRow, action: OperatorAction) => {
    if (action === 'softphone') setDialog({ kind: 'softphone', row });
    else if (action === 'team') setDialog({ kind: 'assign', user: row.user });
    else if (action === 'card') onOpenCard(row.user);
    else if (action === 'unblock') unblock.run(row.user);
    else onDialog({ kind: action, user: row.user, session: null });
  };

  const periodLabel = t(filters.period === 'week' ? 'staff.ops.kpi.week' : 'staff.ops.kpi.today');
  const statsHeader = t(filters.period === 'week' ? 'staff.ops.col.week' : 'staff.ops.col.today');
  const stateLabel = (value: string) => t(`staff.ops.state.${value}` as TranslationKey);
  const wsLabel = (value: string) => t(`staff.ops.ws.${value}` as TranslationKey);
  const spLabel = (value: string) => t(`staff.ops.sp.${value}` as TranslationKey);
  const options = (values: readonly string[], label: (value: string) => string): PillOption[] => [{ value: '', label: t('staff.filter.all') }, ...values.map((value) => ({ value, label: label(value) }))];
  const stateOptions = options(PRESENCES, stateLabel);
  const wsOptions = options(FILTER_WORKSPACES, wsLabel);
  const spOptions = options(['REGISTERED', 'UNREGISTERED', 'DISABLED'], spLabel);

  /* ── Jamoa kartasi ── */
  const teamCard = (team: Team, summary: TeamSummary) => {
    const supervisor = supervisors.find((user) => user.id === team.supervisor.id);
    const name = shortPersonName(team.supervisor.name);
    const teamName = t('staff.ops.teamName', { name: name });
    const presence = supervisor ? supervisorPresence(supervisor, t) : t('staff.ops.neverIn');
    const code = supervisor?.code ?? team.supervisor.id;
    const titleId = `team-${team.id}`;
    const actions = phone ? (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        rootClassName={rowMenu.root}
        menu={{
          items: [
            { key: 'change', icon: <UserCog aria-hidden />, label: t('staff.ops.changeSupervisor') },
            { key: 'create', icon: <FolderPlus aria-hidden />, label: t('staff.ops.createTeam') },
          ],
          onClick: ({ key }) => setDialog({ kind: 'team', mode: key === 'create' ? 'create' : 'change', team: key === 'create' ? undefined : team }),
        }}
      >
        <button type="button" className={styles.squareButton} aria-label={t('staff.ops.teamActions')} title={t('staff.ops.teamActions')}><EllipsisVertical aria-hidden /></button>
      </Dropdown>
    ) : (
      <div className={styles.cardActions}>
        <button type="button" className={styles.outline} onClick={() => setDialog({ kind: 'team', mode: 'change', team })}><UserCog aria-hidden />{t('staff.ops.changeSupervisor')}</button>
        <button type="button" className={styles.outline} onClick={() => setDialog({ kind: 'team', mode: 'create' })}><FolderPlus aria-hidden />{t('staff.ops.createTeam')}</button>
      </div>
    );
    const kpi = (label: string, value: string, unit: string) => (
      <div className={styles.kpi}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value}<span className={styles.kpiUnit}>{unit}</span></span>
      </div>
    );
    const counts = summary.counts;
    return (
      <section className={styles.teamCard} aria-labelledby={titleId} data-testid={`team-card-${team.id}`}>
        <div className={styles.teamHead}>
          <div className={styles.teamWho}>
            <Avatar name={team.supervisor.name} size={48} />
            <div className={styles.teamText}>
              <h2 id={titleId} className={styles.teamTitle}>{teamName}</h2>
              <p className={styles.teamSub}>
                {phone ? t('staff.ops.supervisorLineShort', { code, presence }) : t('staff.ops.supervisorLine', { name, code, presence })}
              </p>
            </div>
          </div>
          {actions}
        </div>
        <div className={styles.kpis}>
          {kpi(t('staff.ops.kpi.team'), String(summary.total), t('staff.ops.kpi.teamUnit'))}
          {kpi(t('staff.ops.kpi.now'), String(counts.ONLINE), t('staff.ops.kpi.nowUnit'))}
          {kpi(periodLabel, summary.hasStats ? String(summary.attempts) : '—', t('staff.ops.kpi.attemptsUnit'))}
          {kpi(t('staff.ops.kpi.rate'), summary.rate === null ? '—' : `${summary.rate.toString()}%`, summary.hasStats ? `${summary.confirmed.toString()} / ${summary.valid.toString()}` : '')}
        </div>
        <div className={styles.bar} role="img" aria-label={t('staff.ops.bar', { online: counts.ONLINE, break: counts.BREAK, offline: counts.OFFLINE, blocked: counts.BLOCKED })}>
          {BAR_TONES.map((key) => (counts[key] ? <span key={key} data-tone={key} style={{ flexGrow: counts[key] }} /> : null))}
        </div>
        <div className={styles.legend}>
          {BAR_TONES.map((key) => <span key={key} className={styles.legendItem}><span data-tone={key} aria-hidden />{t(`staff.ops.legend.${key}`, { count: counts[key] })}</span>)}
        </div>
        <p className={styles.note}><Info aria-hidden /><span>{t('staff.ops.note')}</span></p>
      </section>
    );
  };

  /* ── Filtrlar ── */
  const periodSwitch = (
    <div className={styles.periodBox}>
      <span id={`${searchId}-period`} className={styles.visuallyHidden}>{t('staff.ops.period')}</span>
      <div className={styles.period} role="radiogroup" aria-labelledby={`${searchId}-period`}>
        {(['today', 'week'] as const).map((value) => (
          <button key={value} type="button" role="radio" aria-checked={filters.period === value} onClick={() => update({ period: value === 'week' ? 'week' : null })}>
            {t(`staff.ops.period.${value}`)}
          </button>
        ))}
      </div>
    </div>
  );
  const searchBox = (
    <span className={styles.search}>
      <Search aria-hidden />
      <input type="search" aria-label={t('staff.ops.searchAria')} value={filters.search} placeholder={t('staff.search.placeholder')} onChange={(event) => update({ q: event.target.value || null })} />
    </span>
  );
  const filterCount = [filters.presence, filters.workspace, filters.softphone].filter(Boolean).length;
  const filterBar = phone ? (
    <>
      <div className={styles.phoneFilters} role="search" aria-label={t('staff.ops.filters')}>
        {searchBox}
        <button type="button" className={styles.filtersButton} aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
          <ListFilter aria-hidden />{t('staff.filters')}{filterCount ? <span className={styles.filtersCount}>{filterCount}</span> : null}
        </button>
      </div>
      {filterCount ? (
        <div className={styles.chips}>
          {([['state', filters.presence, stateLabel], ['ws', filters.workspace, wsLabel], ['sp', filters.softphone, spLabel]] as const).map(([key, value, label]) => (value ? (
            <span key={key} className={styles.chip}>
              {label(value)}
              <button type="button" aria-label={t('staff.ops.filter.remove', { name: label(value) })} onClick={() => update({ [key]: null })}><X aria-hidden /></button>
            </span>
          ) : null))}
        </div>
      ) : null}
      {periodSwitch}
    </>
  ) : (
    <div className={styles.filters} role="search" aria-label={t('staff.ops.filters')}>
      {searchBox}
      <PillSelect label={t('staff.ops.filter.state')} value={filters.presence} options={stateOptions} onChange={(value) => update({ state: value || null })} onClear={() => update({ state: null })} clearLabel={t('staff.ops.filter.stateClear')} />
      <PillSelect label={t('staff.ops.filter.workspace')} value={filters.workspace} options={wsOptions} onChange={(value) => update({ ws: value || null })} onClear={() => update({ ws: null })} clearLabel={t('staff.ops.filter.workspaceClear')} />
      <PillSelect label={t('staff.ops.filter.softphone')} value={filters.softphone} options={spOptions} onChange={(value) => update({ sp: value || null })} onClear={() => update({ sp: null })} clearLabel={t('staff.ops.filter.softphoneClear')} />
      {periodSwitch}
    </div>
  );

  const emptyRow = (none: boolean) => (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden><SearchX /></span>
      <span className={styles.emptyTitle}>{t(none ? 'staff.ops.emptyNone' : 'staff.ops.empty')}</span>
      {none ? null : <button type="button" className={styles.ghost} onClick={() => update({ q: null, state: null, ws: null, sp: null })}>{t('staff.filter.reset')}</button>}
    </div>
  );

  /* ── Jadval (desktop 7 ustun, planshet 5) va telefon kartochkalari ── */
  const sortHeader = (
    <button type="button" className={styles.sortButton} title={t('staff.ops.sortAttempts')} onClick={() => update({ sort: filters.sort === 'attempts' ? null : 'attempts' })}>
      {statsHeader}{filters.sort === 'attempts' ? <ArrowDown aria-hidden /> : <ChevronsUpDown aria-hidden />}
    </button>
  );

  /** Telefon kartochkasi: holat qatori yoki bloklanganda — oxirgi kirish. */
  const cardPresence = (row: OperatorRow) => (row.user.isBlocked
    ? (row.user.lastLoginAt ? t('staff.ops.lastLogin', { when: lastLoginText(row.user.lastLoginAt, t) }) : null)
    : presenceLine(row.user, row.live, t));

  const operatorCell = (row: OperatorRow) => (
    <span className={styles.person}>
      <Avatar name={row.user.name || row.user.phone} />
      <span className={styles.personText}>
        <span className={styles.personName}>{displayName(row.user)}</span>
        <span className={styles.personCode}>{row.user.code}</span>
      </span>
    </span>
  );

  const menuCell = (row: OperatorRow) => (
    <OperatorRowMenu label={t('staff.rowActions', { name: displayName(row.user) })} blocked={row.user.isBlocked} onAction={(action) => act(row, action)} />
  );

  const teamTable = (caption: string, all: readonly OperatorRow[], summary: TeamSummary) => {
    const shown = sortRows(all.filter((row) => matchesRow(row, filters)), filters.sort);
    const desktop = layout === 'desktop';
    const columns = desktop ? 7 : 5;
    if (phone) {
      return shown.length ? (
        <ul className={styles.cards} aria-label={t('staff.ops.listAria', { team: caption, count: all.length })} data-testid="operators-cards">
          {shown.map((row) => (
            <li key={row.user.id} className={styles.cardItem}>
              <Link to={`/admin/users/${encodeURIComponent(row.user.id)}`} className={styles.card} aria-label={t('staff.ops.cardAria', { name: displayName(row.user), state: stateLabel(row.presence) })}>
                <span className={styles.cardTop}>
                  <Avatar name={row.user.name || row.user.phone} size={36} />
                  <span className={styles.cardWho}>
                    <span className={styles.cardName}>{displayName(row.user)}</span>
                    <span className={styles.cardLine}>
                      {[row.user.code, row.softphone && !row.user.isBlocked ? wsLabel(row.softphone.workspace) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={styles.cardState}>
                    {row.presence === 'BLOCKED' ? <PresenceCell row={row} /> : <Dot tone={row.presence === 'ONLINE' ? 'success' : row.presence === 'BREAK' ? 'warning' : 'muted'}>{stateLabel(row.presence)}</Dot>}
                  </span>
                </span>
                {cardPresence(row) ? <span className={styles.cardIndent}>{cardPresence(row)}</span> : null}
                <span className={`${styles.cardIndent} ${styles.cardBottom}`}>
                  <span>{row.softphone ? t('staff.ops.cardSoftphone', { account: row.softphone.account, status: t(`staff.ops.spLower.${row.softphone.status}`) }) : null}</span>
                  {row.stats && !row.user.isBlocked ? (
                    <span className={styles.cardStats}>
                      <span className={styles.cardStatsLabel}>{t(`staff.ops.periodShort.${filters.period}`)} </span>
                      <span className={styles.cardStatsValue}>{`${row.stats.attempts.toString()} · ${row.stats.approveRate === null ? '—' : `${row.stats.approveRate.toString()}%`}`}</span>
                    </span>
                  ) : <span className={styles.muted}>—</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : emptyRow(!all.length);
    }
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table} data-layout={layout} data-testid="operators-table">
          <caption className={styles.visuallyHidden}>{t('staff.ops.caption', { team: caption })}</caption>
          {desktop ? (
            <colgroup>
              <col style={{ width: '16%' }} /><col style={{ width: '22%' }} /><col style={{ width: '16%' }} /><col style={{ width: '19%' }} /><col style={{ width: '14%' }} /><col /><col style={{ width: 36 }} />
            </colgroup>
          ) : null}
          <thead>
            <tr>
              <th scope="col">{t('staff.ops.col.operator')}</th>
              <th scope="col">{t('staff.ops.col.now')}</th>
              <th scope="col">{t('staff.ops.col.softphone')}</th>
              {desktop ? <th scope="col">{t('staff.ops.col.workspace')}</th> : null}
              <th scope="col" aria-sort={filters.sort === 'attempts' ? 'descending' : undefined}>{sortHeader}</th>
              {desktop ? <th scope="col">{t('staff.ops.col.bookings')}</th> : null}
              <th scope="col" className={styles.menuCol}><span className={styles.visuallyHidden}>{t('staff.col.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.user.id} data-testid={`operator-row-${row.user.code}`}>
                <td>{operatorCell(row)}</td>
                <td className={styles.presenceCell}><PresenceCell row={row} split={!desktop} onUnblock={() => unblock.run(row.user)} /></td>
                <td><SoftphoneCell row={row} withWorkspace={!desktop} /></td>
                {desktop ? <td><WorkspaceCell row={row} /></td> : null}
                <td><StatsCell row={row} /></td>
                {desktop ? <td className={styles.numeric}>{bookingsValue(row)}</td> : null}
                <td className={styles.menuCol}>{menuCell(row)}</td>
              </tr>
            ))}
            {!shown.length ? <tr><td colSpan={columns} className={styles.emptyCell}>{emptyRow(!all.length)}</td></tr> : null}
          </tbody>
          {desktop && all.length ? (
            <tfoot>
              <tr>
                <td><span className={styles.footStrong}>{t('staff.ops.foot.team', { count: summary.total })}</span></td>
                <td>
                  <span className={styles.stack}>
                    <span>{t('staff.ops.foot.online', { count: summary.counts.ONLINE })}</span>
                    <span className={styles.footSub}>{t('staff.ops.foot.rest', { break: summary.counts.BREAK, offline: summary.counts.OFFLINE, blocked: summary.counts.BLOCKED })}</span>
                  </span>
                </td>
                <td>{summary.hasSoftphones ? t('staff.ops.foot.accounts', { count: summary.activeAccounts }) : '—'}</td>
                <td>{summary.hasSoftphones ? t('staff.ops.foot.workspaces', { browser: summary.browser, sip: summary.sip }) : '—'}</td>
                <td>
                  {summary.hasStats ? (
                    <span className={styles.stack}>
                      <span className={styles.numeric}>{t('staff.ops.stats', { attempts: summary.attempts, rate: summary.rate === null ? '—' : `${summary.rate.toString()}%` })}</span>
                      <span className={styles.footSub}>
                        {summary.median === null
                          ? t('staff.ops.statsSubNoMedian', { confirmed: summary.confirmed, valid: summary.valid })
                          : t('staff.ops.statsSub', { confirmed: summary.confirmed, valid: summary.valid, median: summary.median })}
                      </span>
                    </span>
                  ) : '—'}
                </td>
                <td className={styles.numeric}>{summary.scheduled ? `${summary.bookings.toString()} · +${summary.scheduled.toString()}` : String(summary.bookings)}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    );
  };

  /* ── Jamoasiz operatorlar (admin-operatorlar-jamoasi.holatlar «Jamoa yo‘q») ── */
  const unassignedSection = () => {
    if (!unassigned.length) return null;
    const titleId = `${searchId}-unassigned`;
    const assignButton = (row: OperatorRow) => (
      <button type="button" className={styles.linkButton} onClick={() => setDialog({ kind: 'assign', user: row.user })}>{t('staff.ops.assign')}</button>
    );
    return (
      <section className={styles.panel} aria-labelledby={titleId} data-testid="operators-unassigned">
        <div className={styles.panelHead}>
          <h2 id={titleId} className={styles.panelTitle}>{t('staff.ops.unassigned.title', { count: unassigned.length })}</h2>
          <span className={styles.panelSub}>{t('staff.ops.unassigned.sub')}</span>
        </div>
        {phone ? (
          <ul className={styles.cards}>
            {sortRows(unassigned, 'name').map((row) => (
              <li key={row.user.id} className={styles.cardItem}>
                <div className={styles.card}>
                  <Avatar name={row.user.name || row.user.phone} size={36} />
                  <span className={styles.cardBody}>
                    <span className={styles.cardName}>{displayName(row.user)}</span>
                    <span className={styles.cardLine}>{[row.user.code, row.softphone ? wsLabel(row.softphone.workspace) : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  {assignButton(row)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="operators-unassigned-table">
              <caption className={styles.visuallyHidden}>{t('staff.ops.unassigned.title', { count: unassigned.length })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('staff.ops.col.operator')}</th>
                  <th scope="col">{t('staff.ops.col.softphone')}</th>
                  <th scope="col">{t('staff.ops.col.workspace')}</th>
                  <th scope="col">{t('staff.ops.col.team')}</th>
                  <th scope="col" className={styles.menuCol}><span className={styles.visuallyHidden}>{t('staff.col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {sortRows(unassigned, 'name').map((row) => (
                  <tr key={row.user.id}>
                    <td>{operatorCell(row)}</td>
                    <td><SoftphoneCell row={row} /></td>
                    <td><WorkspaceCell row={row} /></td>
                    <td><span className={styles.teamless}><span className={styles.muted}>{t('staff.ops.unassigned.value')}</span>{assignButton(row)}</span></td>
                    <td className={styles.menuCol}>{menuCell(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  };

  const noTeam = !teams.isPending && !teamList.length ? (
    <section className={styles.noTeam} data-testid="operators-no-team">
      <div>
        <p className={styles.noTeamTitle}>{t('staff.ops.noTeam.title')}</p>
        <p className={styles.noTeamText}>{t('staff.ops.noTeam.text')}</p>
      </div>
      <button type="button" className={styles.primary} onClick={() => setDialog({ kind: 'team', mode: 'create' })}><FolderPlus aria-hidden />{t('staff.ops.createTeam')}</button>
    </section>
  ) : null;

  const body: ReactNode[] = teamList.map((team, index) => {
    const all = rowsOf(team);
    const summary = teamSummary(all);
    const caption = t('staff.ops.teamName', { name: shortPersonName(team.supervisor.name) });
    return (
      <Fragment key={team.id}>
        {teamCard(team, summary)}
        {phone ? (
          <>
            {index === 0 ? filterBar : null}
            {teamTable(caption, all, summary)}
          </>
        ) : (
          <div className={styles.panel}>
            {index === 0 ? filterBar : null}
            {teamTable(caption, all, summary)}
            {filters.presence === 'BLOCKED' ? (
              <p className={styles.note}><Info aria-hidden /><span>{t('staff.ops.blockedNote', { decision: t('staff.ops.blockedDecision') })}</span></p>
            ) : null}
          </div>
        )}
      </Fragment>
    );
  });

  const sheetField = (label: string, value: string, opts: readonly PillOption[], key: string) => (
    <div className={styles.sheetField}>
      <label htmlFor={`${searchId}-${key}`}>{label}</label>
      <span className={styles.sheetSelect}>
        <select id={`${searchId}-${key}`} value={value} onChange={(event) => update({ [key]: event.target.value || null })}>
          {opts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </div>
  );
  const filteredCount = rows.filter((row) => matchesRow(row, filters)).length;

  return (
    <div className={styles.tab} data-testid="operators-tab" data-layout={layout}>
      {noTeam}
      {body}
      {unassignedSection()}
      {!phone && teamList.length ? <p className={styles.legendNote}>{t('staff.ops.legendNote')}</p> : null}
      {phone ? <PageActionBar><button type="button" className={styles.primaryWide} onClick={() => onAdd(teamList[0]?.id ?? null)}><UserPlus aria-hidden />{t('staff.ops.add')}</button></PageActionBar> : null}

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('staff.filters')}
        icon={<ListFilter />}
        footer={(
          <>
            <DialogCancel onClick={() => update({ state: null, ws: null, sp: null })}>{t('staff.filters.clear')}</DialogCancel>
            <button type="button" className={styles.sheetPrimary} onClick={() => setSheetOpen(false)}>{t('staff.ops.filtersShow', { count: filteredCount })}</button>
          </>
        )}
      >
        {sheetField(t('staff.ops.filter.state'), filters.presence, stateOptions, 'state')}
        {sheetField(t('staff.ops.filter.workspace'), filters.workspace, wsOptions, 'ws')}
        {sheetField(t('staff.ops.filter.softphone'), filters.softphone, spOptions, 'sp')}
      </Dialog>

      {dialog?.kind === 'softphone' ? (
        <SoftphoneDialog user={dialog.row.user} softphone={dialog.row.softphone ?? null} live={dialog.row.live} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'assign' ? (
        <AssignTeamDialog user={dialog.user} teams={teamList} onlineByTeam={onlineByTeam} onClose={() => setDialog(null)} onCreateTeam={() => setDialog({ kind: 'team', mode: 'create' })} />
      ) : null}
      {dialog?.kind === 'team' ? (
        <TeamSupervisorDialog mode={dialog.mode} team={dialog.team} candidates={candidates} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
