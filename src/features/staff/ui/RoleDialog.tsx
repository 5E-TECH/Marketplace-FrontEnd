import { App } from 'antd';
import axios from 'axios';
import { CircleX, Info, UserCog } from 'lucide-react';
import { useState } from 'react';
import type { UserRole } from '../../auth/model/authTypes';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../../shared/lib/phone';
import { shortPersonName } from '../../../shared/lib/personName';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useChangeRoleMutation, useTeamsQuery } from '../api/staffQueries';
import { displayName, enteredText } from '../lib/staffFormat';
import { ROLE_CHOICES } from '../model/roleCatalog';
import type { StaffRole, UserAccount } from '../model/staffTypes';
import { RoleOptions } from './RoleOptions';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import styles from './staffUi.module.css';


interface RoleDialogProps {
  user: UserAccount;
  viewer: { id: string; role: UserRole };
  /** Ro'yxatdagi yagona faol superadmin — kim qatorida «oxirgi superadmin». */
  lastSuperadmin?: boolean;
  onClose: () => void;
}

/**
 * Rol berish (roli noma'lum xodim — admin-foydalanuvchilar «Rol berish») va rolni almashtirish (admin-foydalanuvchi-karta
 * D1): rol kartalari, tanlangan rolning ishi va menyusi (marshrut manifestidan), operatorga «Jamoa». Superadmin rolini
 * faqat superadmin beradi. Oxirgi superadmin o'zini pasaytirsa backend 409 qaytaradi (D2) — oynada xabar.
 */
export function RoleDialog({ user, viewer, lastSuperadmin = false, onClose }: RoleDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const change = useChangeRoleMutation();
  const assign = user.role === null;
  const current = user.role;
  const [role, setRole] = useState<StaffRole>(current && (ROLE_CHOICES as readonly string[]).includes(current) ? current as StaffRole : 'OPERATOR_LEAD');
  const teams = useTeamsQuery(role === 'OPERATOR_LEAD');
  const [teamChoice, setTeamChoice] = useState<string | null>(null);
  const [lastSuperError, setLastSuperError] = useState(false);

  const name = displayName(user);
  const self = viewer.id === user.id;
  const teamOptions = teams.data ?? [];
  // Tanlanmagan bo'lsa — xodimning hozirgi jamoasi yoki birinchi jamoa (pilotda bitta).
  const teamId = teamChoice ?? user.team?.id ?? teamOptions[0]?.id ?? '';
  const team = teamOptions.find((item) => item.id === teamId) ?? null;
  const roleLabel = (value: UserRole) => t(ROLE_LABEL_KEYS[value]);
  const unchanged = !assign && role === current && (role !== 'OPERATOR_LEAD' || teamId === (user.team?.id ?? ''));

  const submit = () => {
    if (unchanged || change.isPending) return;
    setLastSuperError(false);
    change.mutate({ id: user.id, role, teamId: role === 'OPERATOR_LEAD' ? teamId || null : null }, {
      onSuccess: () => {
        const placement = phone ? 'top' : 'bottomRight';
        if (assign) {
          // «Jamoa: Rustam Q. Keyingi…» — qisqa ism nuqta bilan tugaydi, shablondagi nuqta takrorlanmasin.
          const supervisor = role === 'OPERATOR_LEAD' && team ? shortPersonName(team.supervisor.name).replace(/\.$/, '') : null;
          const time = tashkentClock();
          notification.success({
            title: t('staff.toast.roleGiven', { name, role: roleLabel(role) }),
            description: supervisor ? t('staff.toast.roleGivenTeam', { team: supervisor, time }) : t('staff.toast.roleGivenText', { time }),
            placement,
            duration: 5,
          });
        } else {
          notification.success({ title: t('staff.toast.roleChanged', { name, role: roleLabel(role) }), description: t('staff.toast.roleChangedText'), placement, duration: 5 });
        }
        onClose();
      },
      onError: (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 409 && current === 'SUPERADMIN') {
          setLastSuperError(true);
          return;
        }
        notification.error({ title: t('staff.role.failedTitle'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
      },
    });
  };

  const personTitle = `${name}${self ? ` ${t('staff.you')}` : ''} · ${user.code}`;
  const personSub = assign
    ? [formatUzPhone(user.phone), user.lastLoginAt ? enteredText(user.lastLoginAt, t) : null].filter(Boolean).join(' · ')
    : [current ? roleLabel(current) : null, lastSuperadmin && current === 'SUPERADMIN' ? t('staff.role.lastSuper') : null].filter(Boolean).join(' · ');

  const leavesTeam = !assign && current === 'OPERATOR_LEAD' && role !== 'OPERATOR_LEAD' && user.team;
  const joinsTeam = role === 'OPERATOR_LEAD' && current !== 'OPERATOR_LEAD' && team;
  const primary = assign ? t('staff.role.give') : self ? t('staff.role.save') : t('staff.role.make', { role: roleLabel(role) });

  return (
    <Dialog
      open
      title={assign ? t('staff.role.giveTitle', { name }) : t('staff.role.changeTitle')}
      description={assign ? t('staff.role.giveSub') : t('staff.role.changeSub', { name, role: current ? roleLabel(current) : '—' })}
      icon={<UserCog />}
      locked={change.isPending}
      onClose={onClose}
      testId="staff-role-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={change.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={change.isPending} savingLabel={t('staff.role.saving')} shortcut={false} disabled={unchanged}>{primary}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary name={user.name || user.phone} title={personTitle} sub={personSub} badge={<AccountStatusBadge user={user} />} />
      {lastSuperError ? (
        <div className={styles.alert} role="alert">
          <CircleX aria-hidden />
          <div>
            <p className={styles.alertTitle}>{t('staff.role.lastSuperTitle')}</p>
            <p className={styles.alertText}>{t('staff.role.lastSuperText')}</p>
          </div>
        </div>
      ) : null}
      <RoleOptions
        value={role}
        onChange={setRole}
        viewerRole={viewer.role}
        current={assign ? null : current}
        teams={teamOptions}
        teamId={teamId}
        onTeamChange={setTeamChoice}
      />
      {assign ? (
        <p className={styles.note}><Info aria-hidden /><span>{t('staff.role.note')}</span></p>
      ) : role !== current ? (
        <div className={styles.after}>
          <p>{t('staff.role.after')}</p>
          <dl>
            <div><dt>{t('staff.role.afterMenu')}</dt><dd>{t('staff.role.afterMenuText')}</dd></div>
            {leavesTeam ? <div><dt>{t('staff.role.afterTeam')}</dt><dd>{t('staff.role.afterTeamLeave', { name: shortPersonName(user.team?.supervisorName ?? '') })}</dd></div> : null}
            {joinsTeam ? <div><dt>{t('staff.role.afterTeam')}</dt><dd>{t('staff.role.afterTeamJoin', { name: shortPersonName(team.supervisor.name) })}</dd></div> : null}
          </dl>
        </div>
      ) : null}
    </Dialog>
  );
}
