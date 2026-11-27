import { Dropdown, Tooltip } from 'antd';
import { Ellipsis, Send } from 'lucide-react';
import { useState } from 'react';
import { presenceParts } from '../../../features/staff/lib/operatorFormat';
import { momentText } from '../../../features/staff/lib/staffFormat';
import type { MemberState } from '../../../features/staff/model/teamTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { Badge } from '../../../shared/ui/Badge/Badge';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import { softphoneLabel, STATE_VIEW, type MemberAction, type MenuEntry } from '../model/memberView';
import type { MemberRow } from '../model/teamMembers';
import styles from './TeamTab.module.css';

export function StateBadge({ state }: { state: MemberState }) {
  const { t } = useTranslation();
  return <Badge tone={STATE_VIEW[state].tone} icon={STATE_VIEW[state].icon}>{t(`staff.sv.state.${state}`)}</Badge>;
}

export function Dot({ tone, children }: { tone: 'success' | 'warning' | 'muted' | 'danger'; children: string }) {
  return <span className={styles.dot} data-tone={tone}>{children}</span>;
}

/** «Hisob» ustuni: holat belgisi va ostida kim, qachon (nazoratchi-jamoa.holatlar). */
export function AccountCell({ row, onResendSms }: { row: MemberRow; onResendSms?: () => void }) {
  const { t } = useTranslation();
  const { member, state } = row;
  const by = (name: string) => shortPersonName(name);
  const line = state === 'NEVER_LOGGED_IN'
    ? t('staff.sv.added', { time: momentText(member.user.createdAt), by: by(member.user.createdBy?.name ?? '—') })
    : state === 'INACTIVE' && member.inactive ? t('staff.sv.inactiveLine', { time: momentText(member.inactive.at), by: by(member.inactive.by), reason: member.inactive.reason })
      : state === 'BLOCK_REQUESTED' && member.request ? t('staff.sv.requestLine', { time: momentText(member.request.at) })
        : state === 'BLOCKED' ? (member.request?.kind === 'UNBLOCK' ? t('staff.sv.unblockRequested') : t('staff.sv.blockedLine'))
          : null;
  return (
    <span className={styles.account}>
      <StateBadge state={state} />
      {line ? <span className={styles.sub}>{line}</span> : null}
      {state === 'NEVER_LOGGED_IN' && onResendSms ? <button type="button" className={styles.linkButton} onClick={onResendSms}><Send aria-hidden />{t('staff.sv.resendSms')}</button> : null}
    </span>
  );
}

const PRESENCE_TONE = { ONLINE: 'success', BREAK: 'warning', OFFLINE: 'muted' } as const;

/** «Hozir»: faqat kira oladigan operatorda; `split` — planshetda ikki qator. */
export function PresenceCell({ row, split = false }: { row: MemberRow; split?: boolean }) {
  const { t } = useTranslation();
  if (row.state === 'BLOCKED' || row.state === 'INACTIVE' || row.state === 'NEVER_LOGGED_IN') return <span className={styles.muted}>—</span>;
  const state = row.live?.state ?? 'OFFLINE';
  const { since, detail } = presenceParts(row.member.user, row.live, t, undefined, false);
  const lines = split && state === 'ONLINE' ? [since, detail] : [[since, detail].filter(Boolean).join(' · ')];
  return (
    <span className={styles.presence}>
      <Dot tone={PRESENCE_TONE[state]}>{t(`staff.ops.state.${state}`)}</Dot>
      {lines.filter(Boolean).map((line) => <span key={line} className={styles.presenceLine}>{line}</span>)}
    </span>
  );
}

export function SoftphoneCell({ row, withWorkspace = false }: { row: MemberRow; withWorkspace?: boolean }) {
  const { t } = useTranslation();
  const phone = row.member.softphone;
  const label = softphoneLabel(row);
  if (!phone || !label) return <span className={styles.muted}>—</span>;
  const tone = phone.status === 'REGISTERED' ? 'success' : phone.status === 'DISABLED' && row.state === 'BLOCKED' ? 'danger' : 'muted';
  return (
    <span className={styles.softphoneStack}>
      <span className={styles.softphone}><span className={styles.chip}>{phone.account}</span><Dot tone={tone}>{t(label)}</Dot></span>
      {withWorkspace ? <span className={styles.sub}>{row.state === 'BLOCKED' ? '—' : t(`staff.ops.ws.${phone.workspace}`)}</span> : null}
    </span>
  );
}

export function WorkspaceCell({ row }: { row: MemberRow }) {
  const { t } = useTranslation();
  const phone = row.member.softphone;
  if (!phone || row.state === 'BLOCKED') return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.stack}>
      <span className={styles.main}>{t(`staff.ops.ws.${phone.workspace}`)}</span>
      <span className={styles.sub}>{phone.pendingWorkspace ? t('staff.ops.wsPending', { workspace: t(`staff.ops.ws.${phone.pendingWorkspace}`) }) : t(`staff.ops.wsSub.${phone.workspace}`)}</span>
    </span>
  );
}

export function MemberRowMenu({ label, groups, onAction }: { label: string; groups: MenuEntry[][]; onAction: (action: MemberAction) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const items = groups.flatMap((group, index) => [
    ...(index ? [{ type: 'divider' as const }] : []),
    ...group.map((entry) => {
      const text = t(entry.label);
      return {
        key: entry.key,
        icon: <entry.icon aria-hidden />,
        danger: entry.danger,
        disabled: entry.disabled !== undefined,
        label: entry.disabled ? <Tooltip title={entry.disabled} placement="left">{text}</Tooltip> : text,
      };
    }),
  ]);
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      rootClassName={`${rowMenu.root} ${styles.menu}`}
      open={open}
      onOpenChange={setOpen}
      menu={{
        items,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          setOpen(false);
          window.setTimeout(() => onAction(key as MemberAction));
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-expanded={open} onClick={(event) => event.stopPropagation()}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}
