import { Dropdown } from 'antd';
import { Ban, Ellipsis, Headset, KeyRound, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { presenceParts, statsText } from '../../../features/staff/lib/operatorFormat';
import type { Softphone } from '../../../features/staff/model/operatorTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge } from '../../../shared/ui/Badge/Badge';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import type { OperatorRow, Presence } from '../model/operatorTeam';
import styles from './OperatorsTab.module.css';

export type OperatorAction = 'softphone' | 'team' | 'card' | 'password' | 'block' | 'unblock';

/** Nuqta + so'z (Onlayn, Tanaffus, Oflayn; Ro‘yxatda, Ulanmagan, O‘chirilgan). */
export function Dot({ tone, children }: { tone: 'success' | 'warning' | 'muted' | 'danger'; children: string }) {
  return <span className={styles.dot} data-tone={tone}>{children}</span>;
}

const PRESENCE_TONE: Record<Exclude<Presence, 'BLOCKED'>, 'success' | 'warning' | 'muted'> = { ONLINE: 'success', BREAK: 'warning', OFFLINE: 'muted' };
const SOFTPHONE_TONE: Record<Softphone['status'], 'success' | 'muted' | 'danger'> = { REGISTERED: 'success', UNREGISTERED: 'muted', DISABLED: 'danger' };

/** «Hozir»: holat va qachondan; bloklangan — belgi va «Blokdan chiqarish». `split` — planshetda ikki qator. */
export function PresenceCell({ row, split = false, onUnblock }: { row: OperatorRow; split?: boolean; onUnblock?: () => void }) {
  const { t } = useTranslation();
  if (row.presence === 'BLOCKED') {
    return (
      <span className={styles.blockedCell}>
        <Badge tone="danger" icon={Ban}>{t('staff.status.blocked')}</Badge>
        {onUnblock ? <button type="button" className={styles.linkButton} onClick={onUnblock}>{t('staff.unblock')}</button> : null}
      </span>
    );
  }
  const { since, detail } = presenceParts(row.user, row.live, t);
  // Planshetda onlayn — ikki qator («13:15 dan» va «suhbatda 01:12 · L-1284»); tanaffus va oflayn — bitta.
  const lines = split && row.presence === 'ONLINE' ? [since, detail] : [[since, detail].filter(Boolean).join(' · ')];
  return (
    <span className={styles.presence}>
      <Dot tone={PRESENCE_TONE[row.presence]}>{t(`staff.ops.state.${row.presence}`)}</Dot>
      {lines.filter(Boolean).map((line) => <span key={line} className={styles.presenceLine}>{line}</span>)}
    </span>
  );
}

export function SoftphoneCell({ row, withWorkspace = false }: { row: OperatorRow; withWorkspace?: boolean }) {
  const { t } = useTranslation();
  const phone = row.softphone;
  if (!phone) return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.softphoneStack}>
      <span className={styles.softphone}>
        <span className={styles.account}>{phone.account}</span>
        <Dot tone={SOFTPHONE_TONE[phone.status]}>{t(`staff.ops.sp.${phone.status}`)}</Dot>
      </span>
      {withWorkspace ? <span className={styles.sub}>{row.user.isBlocked ? '—' : t(`staff.ops.ws.${phone.workspace}`)}</span> : null}
    </span>
  );
}

export function WorkspaceCell({ row }: { row: OperatorRow }) {
  const { t } = useTranslation();
  const phone = row.softphone;
  if (!phone || row.user.isBlocked) return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.stack}>
      <span className={styles.main}>{t(`staff.ops.ws.${phone.workspace}`)}</span>
      <span className={styles.sub}>
        {phone.pendingWorkspace ? t('staff.ops.wsPending', { workspace: t(`staff.ops.ws.${phone.pendingWorkspace}`) }) : t(`staff.ops.wsSub.${phone.workspace}`)}
      </span>
    </span>
  );
}

export function StatsCell({ row }: { row: OperatorRow }) {
  const { t } = useTranslation();
  if (!row.stats || row.user.isBlocked) return <span className={styles.muted}>—</span>;
  const text = statsText(row.stats, t);
  return (
    <span className={styles.stack}>
      <span className={styles.statsMain}>{text.main}</span>
      <span className={styles.statsSub}>{text.sub}</span>
    </span>
  );
}

/** Qator menyusi (admin-operatorlar-jamoasi.holatlar «Qator menyusi»): softfon, jamoa, karta, parol; bloklash — oxirida. */
export function OperatorRowMenu({ label, blocked, onAction }: { label: string; blocked: boolean; onAction: (action: OperatorAction) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const items = [
    { key: 'softphone', icon: <Headset aria-hidden />, label: t('staff.ops.menu.softphone') },
    { key: 'team', icon: <UsersRound aria-hidden />, label: t('staff.ops.menu.team') },
    { key: 'card', icon: <UserRound aria-hidden />, label: t('staff.ops.menu.card') },
    { key: 'password', icon: <KeyRound aria-hidden />, label: t('staff.menu.password') },
    { type: 'divider' as const },
    blocked
      ? { key: 'unblock', icon: <ShieldCheck aria-hidden />, label: t('staff.menu.unblock') }
      : { key: 'block', icon: <Ban aria-hidden />, label: t('staff.menu.block'), danger: true },
  ];
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
          window.setTimeout(() => onAction(key as OperatorAction));
        },
      }}
    >
      <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-expanded={open} onClick={(event) => event.stopPropagation()}>
        <Ellipsis aria-hidden />
      </button>
    </Dropdown>
  );
}
