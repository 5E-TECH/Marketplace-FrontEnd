import { App } from 'antd';
import { Check, ChevronDown, Info, ListFilter, Pencil, Search, SearchX, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOperatorsLiveQuery, useResendMemberSmsMutation, useSupervisorTeamQuery } from '../../../features/staff/api/staffQueries';
import { presenceLine } from '../../../features/staff/lib/operatorFormat';
import { displayName } from '../../../features/staff/lib/staffFormat';
import { MEMBER_STATES, type TeamMember } from '../../../features/staff/model/teamTypes';
import { Avatar } from '../../../features/staff/ui/StaffBadges';
import { ActivateMemberDialog, DeactivateMemberDialog, MemberFormDialog, MemberHistoryDialog, MemberRequestDialog } from '../../../features/staff/ui/TeamMemberDialogs';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentClock, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel } from '../../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { PillSelect, type PillOption } from '../../../shared/ui/PillSelect/PillSelect';
import { lastLoginValue, menuEntries, softphoneLabel, type MemberAction } from '../model/memberView';
import { buildMemberRows, matchesMember, parseMemberFilters, sortMembers, teamCounts, type MemberRow } from '../model/teamMembers';
import { AccountCell, MemberRowMenu, PresenceCell, SoftphoneCell, StateBadge, WorkspaceCell } from './MemberParts';
import styles from './TeamTab.module.css';

export type TeamLayout = 'desktop' | 'tablet' | 'phone';

type MemberDialog = { kind: Exclude<MemberAction, 'now'>; member: TeamMember; presence: string };

interface TeamTabProps {
  layout: TeamLayout;
  viewer: { id: string; code: string; name: string };
  /** Sahifa yuqorisidagi «Operator qo‘shish» bosilgan — oyna shu yerda ochiladi. */
  adding: boolean;
  onAddChange: (open: boolean) => void;
  onPassword: (value: { name: string; code: string; password: string }) => void;
  onShowNow: (operatorId: string) => void;
}

const IN_CALL = new Set(['CONNECTING', 'RINGING', 'IN_CALL', 'WRAP_UP']);

/**
 * Nazoratchining «Jamoa» yorlig'i (nazoratchi-jamoa + .planshet/.mobil/.holatlar; 15-qaror — asosiy variant): jamoa
 * kartasi (hisoblar, admin bloklagan, softfon; «Siz qilasiz» / «Admin qiladi»), operatorlar hisobi — holat, hozir,
 * softfon, ish joyi, oxirgi kirish; amallar — qo'shish, tahrirlash, nofaol qilish, faollashtirish, bloklash va blokdan
 * chiqarishni so'rash. Backend: taklif `GET /supervisor/team` va boshqalar (fe-15 §14); jonli holat — `queue-summary`.
 */
export function TeamTab({ layout, viewer, adding, onAddChange, onPassword, onShowNow }: TeamTabProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const [params, setParams] = useSearchParams();
  const filters = parseMemberFilters(params);
  const team = useSupervisorTeamQuery();
  const live = useOperatorsLiveQuery();
  const resend = useResendMemberSmsMutation();
  const [dialog, setDialog] = useState<MemberDialog | null>(null);
  const [sheet, setSheet] = useState<MemberRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const baseId = useId();
  const phone = layout === 'phone';
  const placement = phone ? 'top' : 'bottomRight';

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  if (team.isError) return <LoadError error={team.error} onRetry={() => void team.refetch()} variant="page" context={t('staff.sv.tab.team')} text={t('staff.sv.loadError')} />;
  if (team.isPending) return null;

  const teamInfo = team.data.team;
  const teamName = shortPersonName(teamInfo?.supervisorName ?? viewer.name);
  const rows = buildMemberRows(team.data.members, live.data);
  const shown = sortMembers(rows.filter((row) => matchesMember(row, filters)));
  const counts = teamCounts(rows);

  const presenceOf = (row: MemberRow) => {
    if (row.state === 'INACTIVE' || row.state === 'BLOCKED') return t(`staff.sv.state.${row.state}`).toLowerCase();
    if (row.state === 'NEVER_LOGGED_IN') return t('staff.sv.never');
    const state = row.live?.state ?? 'OFFLINE';
    const line = presenceLine(row.member.user, row.live, t);
    return [t(`staff.ops.state.${state}`).toLowerCase(), line].filter(Boolean).join(' ');
  };
  const inCallReason = (row: MemberRow) => {
    const kind = row.live?.activity?.kind;
    return kind && IN_CALL.has(kind) ? t('staff.sv.inCallDeny', { name: displayName(row.member.user), lead: row.live?.activity?.leadId ?? '—' }) : null;
  };
  const act = (row: MemberRow, action: MemberAction) => {
    setSheet(null);
    if (action === 'now') onShowNow(row.member.user.id);
    else setDialog({ kind: action, member: row.member, presence: presenceOf(row) });
  };
  const resendSms = (row: MemberRow) => {
    const name = displayName(row.member.user);
    resend.mutate(row.member.user.id, {
      onSuccess: () => notification.success({ title: t('staff.sv.toast.sms'), description: t('staff.sv.toast.smsText', { name, time: tashkentClock() }), placement, duration: 5 }),
      onError: (error) => notification.error({ title: t('staff.sv.toast.smsFailed'), description: getApiErrorMessage(error), placement }),
    });
  };

  /* ── Jamoa kartasi ── */
  const kpi = (label: string, value: number, unit: string, sub?: string) => (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}<span className={styles.kpiUnit}>{unit}</span></span>
      {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
    </div>
  );
  const duty = (title: string, items: TranslationKey[], icon: typeof Check) => {
    const Icon = icon;
    return (
      <div className={styles.duty}>
        <p className={styles.dutyTitle}>{title}</p>
        <ul>{items.map((key) => <li key={key}><Icon aria-hidden /><span>{t(key)}</span></li>)}</ul>
      </div>
    );
  };
  const card = teamInfo ? (
    <section className={styles.teamCard} aria-labelledby={`${baseId}-team`} data-testid="supervisor-team-card">
      <div className={styles.teamWho}>
        <Avatar name={teamInfo.supervisorName || viewer.name} size={48} />
        <div className={styles.teamText}>
          <h2 id={`${baseId}-team`} className={styles.teamTitle}>{t('staff.ops.teamName', { name: teamName })}</h2>
          <p className={styles.teamSub}>{t('staff.sv.teamSub', { code: viewer.code })}</p>
        </div>
      </div>
      <div className={styles.kpis}>
        {kpi(t('staff.sv.kpi.team'), counts.total, t('staff.sv.kpi.teamUnit'))}
        {kpi(t('staff.sv.kpi.accounts'), counts.active, t('staff.sv.kpi.accountsUnit'), t('staff.sv.kpi.accountsSub'))}
        {kpi(t('staff.sv.kpi.blocked'), counts.blocked.count, t('staff.sv.kpi.blockedUnit'), counts.blocked.names.join(', ') || undefined)}
        {kpi(t('staff.sv.kpi.softphone'), counts.softphones, t('staff.sv.kpi.softphoneUnit'), t('staff.ops.foot.workspaces', { browser: counts.browser, sip: counts.sip }))}
      </div>
      <div className={styles.duties}>
        {duty(t('staff.sv.you'), ['staff.sv.you.add', 'staff.sv.you.edit', 'staff.sv.you.active'], Check)}
        {duty(t('staff.sv.admin'), ['staff.sv.admin.block', 'staff.sv.admin.move', 'staff.sv.admin.password'], ShieldCheck)}
      </div>
    </section>
  ) : (
    <section className={styles.empty} data-testid="supervisor-no-team">
      <Users aria-hidden />
      <div>
        <p className={styles.emptyTitle}>{t('staff.sv.noTeam.title')}</p>
        <p className={styles.emptyText}>{t('staff.sv.noTeam.text')}</p>
      </div>
    </section>
  );

  /* ── Filtrlar ── */
  const label = (prefix: string) => (value: string) => t(`${prefix}.${value}` as TranslationKey);
  const options = (values: readonly string[], text: (value: string) => string): PillOption[] => [{ value: '', label: t('staff.filter.all') }, ...values.map((value) => ({ value, label: text(value) }))];
  const stateOptions = options(MEMBER_STATES, label('staff.sv.state'));
  const wsOptions = options(['BROWSER', 'SIP'], label('staff.ops.ws'));
  const spOptions = options(['REGISTERED', 'UNREGISTERED', 'DISABLED'], label('staff.ops.sp'));
  const searchBox = (
    <span className={styles.search}>
      <Search aria-hidden />
      <input type="search" aria-label={t('staff.ops.searchAria')} value={filters.search} placeholder={t('staff.search.placeholder')} onChange={(event) => update({ q: event.target.value || null })} />
    </span>
  );
  const filterCount = [filters.state, filters.workspace, filters.softphone].filter(Boolean).length;
  const filterBar = phone ? (
    <>
      <div className={styles.phoneFilters} role="search" aria-label={t('staff.ops.filters')}>
        {searchBox}
        <button type="button" className={styles.filtersButton} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
          <ListFilter aria-hidden />{t('staff.filters')}{filterCount ? <span className={styles.filtersCount}>{filterCount}</span> : null}
        </button>
      </div>
      {filterCount ? (
        <div className={styles.chips}>
          {([['account', filters.state, label('staff.sv.state')], ['ws', filters.workspace, label('staff.ops.ws')], ['sp', filters.softphone, label('staff.ops.sp')]] as const).map(([key, value, text]) => (value ? (
            <span key={key} className={styles.chip}>
              {text(value)}
              <button type="button" aria-label={t('staff.ops.filter.remove', { name: text(value) })} onClick={() => update({ [key]: null })}><X aria-hidden /></button>
            </span>
          ) : null))}
        </div>
      ) : null}
    </>
  ) : (
    <div className={styles.filters} role="search" aria-label={t('staff.ops.filters')}>
      {searchBox}
      <PillSelect label={t('staff.sv.filter.account')} value={filters.state} options={stateOptions} onChange={(value) => update({ account: value || null })} onClear={() => update({ account: null })} clearLabel={t('staff.sv.filter.accountClear')} />
      <PillSelect label={t('staff.ops.filter.workspace')} value={filters.workspace} options={wsOptions} onChange={(value) => update({ ws: value || null })} onClear={() => update({ ws: null })} clearLabel={t('staff.ops.filter.workspaceClear')} />
      <PillSelect label={t('staff.ops.filter.softphone')} value={filters.softphone} options={spOptions} onChange={(value) => update({ sp: value || null })} onClear={() => update({ sp: null })} clearLabel={t('staff.ops.filter.softphoneClear')} />
    </div>
  );

  /* ── Ro'yxat ── */
  const emptyList = rows.length ? (
    <div className={styles.emptyRow}>
      <span className={styles.emptyIcon} aria-hidden><SearchX /></span>
      <span className={styles.emptyTitle}>{t('staff.ops.empty')}</span>
      <button type="button" className={styles.ghost} onClick={() => update({ q: null, account: null, ws: null, sp: null })}>{t('staff.filter.reset')}</button>
    </div>
  ) : (
    <div className={styles.emptyRow} data-testid="supervisor-team-empty">
      <span className={styles.emptyIcon} aria-hidden><UserPlus /></span>
      <span className={styles.emptyText}>
        <span className={styles.emptyTitle}>{t('staff.sv.empty.title')}</span>
        <span>{t('staff.sv.empty.text')}</span>
      </span>
      {teamInfo && !phone ? <button type="button" className={styles.primary} onClick={() => onAddChange(true)}><UserPlus aria-hidden />{t('staff.ops.add')}</button> : null}
    </div>
  );

  const operatorCell = (row: MemberRow) => (
    <span className={styles.person}>
      <Avatar name={row.member.user.name || row.member.user.phone} />
      <span className={styles.personText}>
        <span className={styles.personName}>{displayName(row.member.user)}</span>
        <span className={styles.personCode}>{row.member.user.code}</span>
      </span>
    </span>
  );
  const actionsCell = (row: MemberRow) => {
    const name = displayName(row.member.user);
    return (
      <span className={styles.rowActions}>
        {row.state === 'INACTIVE' ? <button type="button" className={styles.outline} onClick={() => act(row, 'activate')}>{t('staff.sv.activate')}</button>
          : row.state === 'BLOCKED' ? null
            : <button type="button" className={styles.squareButton} aria-label={t('staff.sv.edit', { name })} title={t('staff.sv.edit', { name })} onClick={() => act(row, 'edit')}><Pencil aria-hidden /></button>}
        <MemberRowMenu label={t('staff.rowActions', { name })} groups={menuEntries(row, inCallReason(row))} onAction={(action) => act(row, action)} />
      </span>
    );
  };

  const table = () => {
    const tablet = layout === 'tablet';
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table} data-layout={layout} data-testid="supervisor-team-table">
          <caption className={styles.visuallyHidden}>{t('staff.sv.caption', { team: t('staff.ops.teamName', { name: teamName }) })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('staff.ops.col.operator')}</th>
              <th scope="col">{t(tablet ? 'staff.sv.col.accountLogin' : 'staff.sv.col.account')}</th>
              <th scope="col">{t('staff.ops.col.now')}</th>
              <th scope="col">{t(tablet ? 'staff.sv.col.softphoneWs' : 'staff.ops.col.softphone')}</th>
              {tablet ? null : <th scope="col">{t('staff.ops.col.workspace')}</th>}
              {tablet ? null : <th scope="col">{t('staff.col.lastLogin')}</th>}
              <th scope="col" className={styles.endCol}><span className={styles.visuallyHidden}>{t('staff.col.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.member.user.id} data-testid={`member-row-${row.member.user.code}`}>
                <td>{operatorCell(row)}</td>
                <td className={styles.tight}>
                  <AccountCell row={row} onResendSms={() => resendSms(row)} />
                  {tablet && row.state !== 'NEVER_LOGGED_IN' && row.member.user.lastLoginAt ? <span className={styles.sub}>{t('staff.sv.loggedIn', { when: lastLoginValue(row, t) })}</span> : null}
                </td>
                <td className={styles.tight}><PresenceCell row={row} split={tablet} /></td>
                <td><SoftphoneCell row={row} withWorkspace={tablet} /></td>
                {tablet ? null : <td><WorkspaceCell row={row} /></td>}
                {tablet ? null : <td className={styles.numeric}>{lastLoginValue(row, t)}</td>}
                <td className={styles.endCol}>{actionsCell(row)}</td>
              </tr>
            ))}
            {!shown.length ? <tr><td colSpan={tablet ? 5 : 7} className={styles.emptyCell}>{emptyList}</td></tr> : null}
          </tbody>
        </table>
      </div>
    );
  };

  const cards = () => (shown.length ? (
    <ul className={styles.cards} aria-label={t('staff.ops.listAria', { team: t('staff.ops.teamName', { name: teamName }), count: rows.length })} data-testid="supervisor-team-cards">
      {shown.map((row) => {
        const { user } = row.member;
        const spLabel = softphoneLabel(row, true);
        const state = row.live?.state ?? 'OFFLINE';
        const working = row.state === 'ACTIVE' || row.state === 'BLOCK_REQUESTED';
        return (
          <li key={user.id} className={styles.cardItem}>
            <button type="button" className={styles.card} aria-label={t('staff.sv.cardAria', { name: displayName(user) })} onClick={() => setSheet(row)}>
              <span className={styles.cardTop}>
                <Avatar name={user.name || user.phone} size={36} />
                <span className={styles.cardWho}>
                  <span className={styles.cardName}>{displayName(user)}</span>
                  <span className={styles.cardLine}>{[user.code, row.member.softphone && row.state !== 'BLOCKED' ? t(`staff.ops.ws.${row.member.softphone.workspace}`) : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={styles.cardState}>
                  {working ? <span className={styles.dot} data-tone={state === 'ONLINE' ? 'success' : state === 'BREAK' ? 'warning' : 'muted'}>{t(`staff.ops.state.${state}`)}</span> : <StateBadge state={row.state} />}
                </span>
              </span>
              {working ? <span className={styles.cardIndent}>{presenceLine(user, row.live, t, undefined, false)}</span>
                : row.state === 'BLOCKED' ? <span className={styles.cardIndent}>{t('staff.sv.blockedLine')}</span> : null}
              {row.member.softphone && spLabel ? (
                <span className={styles.cardIndent}>
                  {[t('staff.sv.cardSoftphone', { account: row.member.softphone.account, status: t(spLabel) }), user.lastLoginAt ? t('staff.sv.cardLogin', { when: lastLoginValue(row, t) }) : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  ) : <div className={styles.cardsEmpty}>{emptyList}</div>);

  /* ── Holat izohlari (nazoratchi-jamoa.holatlar) ── */
  const fresh = shown.find((row) => row.state === 'NEVER_LOGGED_IN');
  const blockedShown = filters.state === 'BLOCKED' ? shown.find((row) => row.state === 'BLOCKED') : undefined;
  const notes: ReactNode[] = [];
  if (fresh) notes.push(t('staff.sv.newNote', { name: displayName(fresh.member.user) }));
  if (shown.some((row) => row.state === 'BLOCK_REQUESTED')) notes.push(t('staff.sv.requestNote'));
  if (blockedShown) {
    const block = blockedShown.member.user.block;
    notes.push(t('staff.sv.blockedNote', {
      name: displayName(blockedShown.member.user),
      date: block ? tashkentDay(block.at) : t('staff.sv.blockedDate'),
      reason: block?.reason ? `«${block.reason}»` : t('staff.sv.blockedReason'),
    }));
  }
  const noteList = notes.map((note, index) => <p key={index} className={styles.note}><Info aria-hidden /><span>{note}</span></p>);

  /* ── Telefon: kartochka bosilsa — amallar varag'i ── */
  const sheetRow = sheet;
  const sheetGroups = sheetRow ? menuEntries(sheetRow, inCallReason(sheetRow)) : [];
  const sheetReason = sheetGroups.flat().find((entry) => entry.disabled)?.disabled;

  const sheetField = (labelText: string, value: string, opts: readonly PillOption[], key: string) => (
    <div className={styles.sheetField}>
      <label htmlFor={`${baseId}-${key}`}>{labelText}</label>
      <span className={styles.sheetSelect}>
        <select id={`${baseId}-${key}`} value={value} onChange={(event) => update({ [key]: event.target.value || null })}>
          {opts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </div>
  );

  return (
    <div className={styles.tab} data-testid="supervisor-team" data-layout={layout}>
      {card}
      {phone ? (
        <>
          {filterBar}
          {cards()}
          {noteList}
          {teamInfo ? <PageActionBar><button type="button" className={styles.primaryWide} onClick={() => onAddChange(true)}><UserPlus aria-hidden />{t('staff.ops.add')}</button></PageActionBar> : null}
        </>
      ) : (
        <div className={styles.panel}>
          {filterBar}
          {table()}
          {noteList}
        </div>
      )}

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('staff.filters')}
        icon={<ListFilter />}
        footer={(
          <>
            <DialogCancel onClick={() => update({ account: null, ws: null, sp: null })}>{t('staff.filters.clear')}</DialogCancel>
            <button type="button" className={styles.sheetPrimary} onClick={() => setFiltersOpen(false)}>{t('staff.ops.filtersShow', { count: shown.length })}</button>
          </>
        )}
      >
        {sheetField(t('staff.sv.filter.account'), filters.state, stateOptions, 'account')}
        {sheetField(t('staff.ops.filter.workspace'), filters.workspace, wsOptions, 'ws')}
        {sheetField(t('staff.ops.filter.softphone'), filters.softphone, spOptions, 'sp')}
      </Dialog>

      {sheetRow ? (
        <Dialog
          open
          onClose={() => setSheet(null)}
          title={displayName(sheetRow.member.user)}
          description={t('staff.sv.sheetSub', {
            code: sheetRow.member.user.code,
            state: t(`staff.sv.state.${sheetRow.state}`),
            presence: sheetRow.state === 'ACTIVE' || sheetRow.state === 'BLOCK_REQUESTED'
              ? [t(`staff.ops.state.${sheetRow.live?.state ?? 'OFFLINE'}`), presenceLine(sheetRow.member.user, sheetRow.live, t, undefined, false)].filter(Boolean).join(' ')
              : '—',
          })}
          icon={<Users />}
          testId="member-actions-sheet"
        >
          <ul className={styles.sheetMenu} role="menu" aria-label={t('staff.rowActions', { name: displayName(sheetRow.member.user) })}>
            {sheetGroups.flat().map((entry) => (
              <li key={entry.key} role="none">
                <button type="button" role="menuitem" className={styles.sheetItem} data-danger={entry.danger || undefined} disabled={entry.disabled !== undefined} onClick={() => act(sheetRow, entry.key)}>
                  <entry.icon aria-hidden />{t(entry.label)}
                </button>
              </li>
            ))}
          </ul>
          {sheetReason ? <p className={styles.note}><Info aria-hidden /><span>{sheetReason}</span></p> : null}
        </Dialog>
      ) : null}

      {adding ? <MemberFormDialog teamName={teamName} onClose={() => onAddChange(false)} onPassword={onPassword} /> : null}
      {dialog?.kind === 'edit' ? <MemberFormDialog member={dialog.member} teamName={teamName} presence={dialog.presence} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'deactivate' ? <DeactivateMemberDialog member={dialog.member} presence={dialog.presence} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'activate' ? <ActivateMemberDialog member={dialog.member} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'block' || dialog?.kind === 'unblock' ? <MemberRequestDialog member={dialog.member} kind={dialog.kind} presence={dialog.presence} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'history' ? <MemberHistoryDialog member={dialog.member} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
