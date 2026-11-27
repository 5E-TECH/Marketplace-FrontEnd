import { App } from 'antd';
import { Headset, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { useUpdateSoftphoneMutation } from '../api/staffQueries';
import { activityText } from '../lib/operatorFormat';
import { displayName } from '../lib/staffFormat';
import type { OperatorLive, Softphone, Workspace } from '../model/operatorTypes';
import type { UserAccount } from '../model/staffTypes';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import styles from './operatorDialogs.module.css';
import ui from './staffUi.module.css';

const CHOICES: readonly Exclude<Workspace, 'APP'>[] = ['BROWSER', 'SIP'];
const IN_CALL = new Set(['CONNECTING', 'RINGING', 'IN_CALL', 'WRAP_UP']);

interface SoftphoneDialogProps {
  user: UserAccount;
  /** null — hisob ma'lumoti yo'q (taklif endpointi backendda hali yo'q). */
  softphone: Softphone | null;
  live: OperatorLive | null;
  onClose: () => void;
}

/**
 * «Softfon hisobi» (admin-operatorlar-jamoasi.holatlar): hisob, server ro'yxati holati, mijozga ko'rinadigan raqam,
 * yozuv; ish joyi — brauzer softfoni yoki stol telefoni. Operator suhbatda bo'lsa — yangi sozlama suhbat tugagach
 * (taklif `PATCH /admin/operators/{id}/softphone`, fe-15 §13). Ko'prik raqami — 2-bosqich.
 */
export function SoftphoneDialog({ user, softphone, live, onClose }: SoftphoneDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const update = useUpdateSoftphoneMutation();
  const baseId = useId();
  const initial: Exclude<Workspace, 'APP'> = softphone?.workspace === 'SIP' ? 'SIP' : 'BROWSER';
  const [workspace, setWorkspace] = useState(initial);
  const name = displayName(user);
  const busy = IN_CALL.has(live?.activity?.kind ?? '');
  const placement = phone ? 'top' : 'bottomRight';

  const state = live?.state ?? 'OFFLINE';
  const presence = [
    `${t(`staff.ops.state.${state}`).toLowerCase()}${live?.since ? ` ${t('staff.ops.since', { time: tashkentClock(Date.parse(live.since)) })}` : ''}`,
    busy && live?.activity ? t('staff.ops.spDlg.nowBusy', { lead: live.activity.leadId ?? '—' }) : activityText(live, t),
  ].filter(Boolean).join(' · ');

  const statusValue = !softphone ? '—'
    : softphone.status === 'REGISTERED' && softphone.since
      ? t('staff.ops.spDlg.statusValue', { status: t('staff.ops.sp.REGISTERED'), client: t(`staff.ops.spDlg.client.${softphone.workspace}`), time: tashkentClock(Date.parse(softphone.since)) })
      : softphone.neverConnected && softphone.status === 'UNREGISTERED' ? `${t('staff.ops.sp.UNREGISTERED')} · ${t('staff.ops.spFirst')}` : t(`staff.ops.sp.${softphone.status}`);

  const submit = () => {
    if (update.isPending) return;
    update.mutate({ id: user.id, workspace }, {
      onSuccess: (saved) => {
        const later = Boolean(saved?.pendingWorkspace) || busy;
        notification.success({
          title: t('staff.ops.toast.softphone'),
          description: later ? t('staff.ops.toast.softphoneLater', { name }) : t('staff.ops.toast.softphoneNow', { name, workspace: t(`staff.ops.ws.${workspace}`) }),
          placement,
          duration: 5,
        });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.ops.spDlg.failed'), description: getApiErrorMessage(error), placement }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.ops.menu.softphone')}
      description={t('staff.ops.spDlg.sub')}
      icon={<Headset />}
      width={480}
      locked={update.isPending}
      onClose={onClose}
      testId="softphone-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={update.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} disabled={workspace === initial} saving={update.isPending} savingLabel={t('staff.ops.spDlg.saving')} shortcut={false}>{t('staff.ops.spDlg.submit')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary
        name={user.name || user.phone}
        title={`${name} · ${user.code}`}
        sub={t('staff.ops.spDlg.personSub', { presence })}
        badge={<AccountStatusBadge user={user} />}
      />
      <div className={`${ui.facts} ${styles.wideFacts}`}>
        <dl>
          <div><dt>{t('staff.ops.spDlg.account')}</dt><dd>{softphone ? <span className={styles.chip}>{softphone.account}</span> : '—'}</dd></div>
          <div><dt>{t('staff.ops.spDlg.status')}</dt><dd>{softphone ? <span className={styles.status} data-tone={softphone.status}>{statusValue}</span> : statusValue}</dd></div>
          <div><dt>{t('staff.ops.spDlg.server')}</dt><dd><span className={styles.decision}>{t('staff.ops.spDlg.serverValue')}</span></dd></div>
          <div><dt>{t('staff.ops.spDlg.caller')}</dt><dd>{t('staff.ops.spDlg.callerValue')}<span className={styles.subValue}>{t('staff.ops.spDlg.callerSub')}</span></dd></div>
          <div><dt>{t('staff.ops.spDlg.recording')}</dt><dd>{t('staff.ops.spDlg.recordingValue')}</dd></div>
        </dl>
      </div>
      <fieldset className={ui.fieldset}>
        <legend className={ui.legend}>{t('staff.ops.addDlg.workspace')}</legend>
        <div className={ui.options}>
          {CHOICES.map((value) => {
            const selected = workspace === value;
            const id = `${baseId}-${value}`;
            return (
              <div key={value} className={ui.option} data-selected={selected || undefined}>
                <div className={ui.optionRow}>
                  <label htmlFor={id} className={ui.optionLabel}>
                    <span className={ui.radio}>
                      <input type="radio" id={id} name={`${baseId}-ws`} checked={selected} aria-describedby={selected ? `${id}-d` : undefined} onChange={() => setWorkspace(value)} />
                      <span />
                    </span>
                    <span className={ui.optionName}>{t(value === 'SIP' ? 'staff.ops.wsChoice.SIP' : 'staff.ops.ws.BROWSER')}</span>
                  </label>
                </div>
                {selected ? <p id={`${id}-d`} className={ui.optionText}>{t(`staff.ops.spDlg.wsHint.${value}`)}</p> : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.field}>
        <div className={ui.labelRow}>
          <label htmlFor={`${baseId}-bridge`}>{t('staff.ops.spDlg.bridge')}</label>
          <span className={styles.labelStage}>{t('staff.stage.M2')}</span>
        </div>
        <input id={`${baseId}-bridge`} className={styles.input} placeholder="+998 __ ___ __ __" disabled aria-describedby={`${baseId}-bridge-hint`} />
        <p id={`${baseId}-bridge-hint`} className={ui.hint}>{t('staff.ops.spDlg.bridgeHint')}</p>
      </div>
      {busy ? (
        <div className={styles.busy} role="note">
          <TriangleAlert aria-hidden />
          <div>
            <p className={styles.busyTitle}>{t('staff.ops.spDlg.busyTitle', { name })}</p>
            <p className={styles.busyText}>{t('staff.ops.spDlg.busyText')}</p>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
