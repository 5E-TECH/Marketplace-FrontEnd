import { App } from 'antd';
import { ChevronRight, UserCog, UsersRound } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useChangeSupervisorMutation, useCreateTeamMutation } from '../api/staffQueries';
import { supervisorPresence } from '../lib/operatorFormat';
import { displayName } from '../lib/staffFormat';
import type { Team, UserAccount } from '../model/staffTypes';
import styles from './operatorDialogs.module.css';
import ui from './staffUi.module.css';

interface TeamSupervisorDialogProps {
  /** create — yangi jamoa; change — shu jamoa nazoratchisini almashtirish. */
  mode: 'create' | 'change';
  team?: Team;
  /** Tanlash mumkin bo'lgan nazoratchilar: SUPERVISOR roli, faol, hali jamoasi yo'q. */
  candidates: readonly UserAccount[];
  onClose: () => void;
}

/**
 * «Jamoa yaratish» va «Nazoratchini almashtirish» (admin-operatorlar-jamoasi: jamoa kartasidagi tugmalar; alohida oyna
 * chizilmagan — «Jamoaga biriktirish» oynasi uslubida). Backend: taklif `POST /admin/teams`, `PATCH /admin/teams/{id}`
 * (fe-15 §13). Bo'sh nazoratchi bo'lmasa — «Xodimlar» tabiga havola.
 */
export function TeamSupervisorDialog({ mode, team, candidates, onClose }: TeamSupervisorDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const create = useCreateTeamMutation();
  const change = useChangeSupervisorMutation();
  const pending = create.isPending || change.isPending;
  const baseId = useId();
  const [supervisorId, setSupervisorId] = useState(candidates[0]?.id ?? '');
  const placement = phone ? 'top' : 'bottomRight';
  const creating = mode === 'create';

  const submit = () => {
    const chosen = candidates.find((item) => item.id === supervisorId);
    if (!chosen || pending) return;
    const name = displayName(chosen);
    const onError = (error: unknown) => notification.error({ title: t('staff.ops.teamDlg.failed'), description: getApiErrorMessage(error), placement });
    if (creating) {
      create.mutate(chosen.id, {
        onSuccess: () => {
          notification.success({ title: t('staff.ops.toast.teamCreated', { team: name }), description: t('staff.ops.toast.teamCreatedText'), placement, duration: 5 });
          onClose();
        },
        onError,
      });
      return;
    }
    if (!team) return;
    change.mutate({ teamId: team.id, supervisorId: chosen.id }, {
      onSuccess: () => {
        notification.success({ title: t('staff.ops.toast.supervisorChanged'), description: t('staff.ops.toast.supervisorChangedText', { name }), placement, duration: 5 });
        onClose();
      },
      onError,
    });
  };

  return (
    <Dialog
      open
      title={t(creating ? 'staff.ops.createTeam' : 'staff.ops.changeSupervisor')}
      description={t(creating ? 'staff.ops.teamDlg.createSub' : 'staff.ops.teamDlg.changeSub')}
      icon={creating ? <UsersRound /> : <UserCog />}
      width={480}
      locked={pending}
      onClose={onClose}
      testId="team-supervisor-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={pending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} disabled={!supervisorId} saving={pending} savingLabel={t('staff.ops.teamDlg.saving')} shortcut={false}>
            {t(creating ? 'staff.ops.teamDlg.createSubmit' : 'staff.ops.teamDlg.changeSubmit')}
          </DialogPrimary>
        </>
      )}
    >
      {team ? <p className={styles.empty}>{t('staff.ops.teamName', { name: shortPersonName(team.supervisor.name) })}</p> : null}
      {candidates.length ? (
        <fieldset className={ui.fieldset}>
          <legend className={ui.legend}>{t('staff.ops.teamDlg.legend')} <span className={ui.required} aria-hidden>*</span></legend>
          <div className={ui.options}>
            {candidates.map((user) => {
              const selected = supervisorId === user.id;
              const id = `${baseId}-${user.id}`;
              return (
                <div key={user.id} className={ui.option} data-selected={selected || undefined}>
                  <div className={ui.optionRow}>
                    <label htmlFor={id} className={ui.optionLabel}>
                      <span className={ui.radio}>
                        <input type="radio" id={id} name={`${baseId}-sv`} checked={selected} aria-describedby={selected ? `${id}-d` : undefined} onChange={() => setSupervisorId(user.id)} />
                        <span />
                      </span>
                      <span className={ui.optionName}>{displayName(user)}</span>
                    </label>
                  </div>
                  {selected ? <p id={`${id}-d`} className={ui.optionText}>{t('staff.ops.teamDlg.optionSub', { code: user.code, presence: supervisorPresence(user, t) })}</p> : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className={styles.info}>
          <p className={styles.empty}>{t('staff.ops.teamDlg.none')}</p>
          <Link to="/admin/users?role=SUPERVISOR" className={styles.footLink} onClick={onClose}>{t('staff.ops.teamDlg.toStaff')}<ChevronRight aria-hidden /></Link>
        </div>
      )}
    </Dialog>
  );
}
