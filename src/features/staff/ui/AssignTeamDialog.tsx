import { App } from 'antd';
import { FolderPlus, UsersRound } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useAssignTeamMutation } from '../api/staffQueries';
import { supervisorPresence } from '../lib/operatorFormat';
import { displayName } from '../lib/staffFormat';
import type { Team, UserAccount } from '../model/staffTypes';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import styles from './operatorDialogs.module.css';
import ui from './staffUi.module.css';

const teamLabel = (team: Team) => shortPersonName(team.supervisor.name);

interface AssignTeamDialogProps {
  user: UserAccount;
  teams: readonly Team[];
  /** Har jamoada hozir onlayn operatorlar («bugun 7 onlayn»). */
  onlineByTeam: Readonly<Record<string, number>>;
  onClose: () => void;
  onCreateTeam: () => void;
}

/**
 * «Jamoaga biriktirish» (admin-operatorlar-jamoasi.holatlar): operator, jamoa tanlovi (nazoratchi, operatorlar soni,
 * bugun onlayn). Backend: taklif `PATCH /admin/users/{id}/team` (fe-15 §13). Boshqa jamoa bo'lmasa — izoh va
 * «Jamoa yaratish».
 */
export function AssignTeamDialog({ user, teams, onlineByTeam, onClose, onCreateTeam }: AssignTeamDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const assign = useAssignTeamMutation();
  const baseId = useId();
  const current = user.team?.id ?? null;
  const [teamId, setTeamId] = useState(current ?? teams[0]?.id ?? '');
  const name = displayName(user);
  const placement = phone ? 'top' : 'bottomRight';
  const presence = user.lastLoginAt === null ? t('staff.ops.neverIn') : supervisorPresence(user, t);
  const teamText = user.team ? t('staff.ops.teamName', { name: shortPersonName(user.team.supervisorName) }) : t('staff.ops.unassigned.value');

  const submit = () => {
    const team = teams.find((item) => item.id === teamId);
    if (!team || assign.isPending) return;
    assign.mutate({ id: user.id, teamId: team.id }, {
      onSuccess: () => {
        notification.success({ title: t('staff.ops.toast.assigned', { name, team: teamLabel(team) }), description: t('staff.ops.toast.assignedText'), placement, duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.ops.assignDlg.failed'), description: getApiErrorMessage(error), placement }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.ops.assign')}
      description={t('staff.ops.assignDlg.sub')}
      icon={<UsersRound />}
      width={480}
      locked={assign.isPending}
      onClose={onClose}
      testId="assign-team-dialog"
      footer={(
        <>
          <button type="button" className={styles.footLink} onClick={onCreateTeam}><FolderPlus aria-hidden />{t('staff.ops.createTeam')}</button>
          <DialogCancel onClick={onClose} disabled={assign.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} disabled={!teamId || teamId === current} saving={assign.isPending} savingLabel={t('staff.ops.assignDlg.saving')} shortcut={false}>{t('staff.ops.assignDlg.submit')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary
        name={user.name || user.phone}
        title={`${name} · ${user.code}`}
        sub={t('staff.ops.assignDlg.personSub', { status: presence, team: teamText })}
        badge={<AccountStatusBadge user={user} />}
      />
      <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>{t('staff.ops.col.team')} <span className={ui.required} aria-hidden>*</span></legend>
        <div className={ui.options}>
          {teams.map((team) => {
            const selected = teamId === team.id;
            const id = `${baseId}-${team.id}`;
            return (
              <div key={team.id} className={ui.option} data-selected={selected || undefined}>
                <div className={ui.optionRow}>
                  <label htmlFor={id} className={ui.optionLabel}>
                    <span className={ui.radio}>
                      <input type="radio" id={id} name={`${baseId}-team`} checked={selected} aria-describedby={selected ? `${id}-d` : undefined} onChange={() => setTeamId(team.id)} />
                      <span />
                    </span>
                    <span className={ui.optionName}>{t('staff.ops.teamName', { name: teamLabel(team) })}</span>
                  </label>
                  <span className={styles.optionMeta}>{team.id === current ? t('staff.ops.assignDlg.current') : t('staff.ops.assignDlg.count', { count: team.operatorCount })}</span>
                </div>
                {selected ? (
                  <p id={`${id}-d`} className={ui.optionText}>
                    {t('staff.ops.assignDlg.desc', { name: shortPersonName(team.supervisor.name), online: onlineByTeam[team.id] ?? 0 })}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      {teams.length <= 1 ? <p className={styles.empty}>{t('staff.ops.assignDlg.onlyOne')}</p> : null}
    </Dialog>
  );
}
