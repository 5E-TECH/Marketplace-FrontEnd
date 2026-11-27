import { App } from 'antd';
import { ChevronDown, CircleX, UserPlus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { isUzMobileNumber } from '../../../shared/lib/phone';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { PhoneInput } from '../../../shared/ui/PhoneInput/PhoneInput';
import { existingUserOf } from '../api/staffApi';
import { useCreateStaffMutation } from '../api/staffQueries';
import { softphoneAccountOf } from '../lib/operatorFormat';
import { displayName } from '../lib/staffFormat';
import { WORKSPACES, type Workspace } from '../model/operatorTypes';
import { userCode } from '../model/staffRules';
import type { Team } from '../model/staffTypes';
import styles from './operatorDialogs.module.css';
import ui from './staffUi.module.css';

type Field = 'firstName' | 'lastName' | 'phone';

interface AddOperatorDialogProps {
  teams: readonly Team[];
  /** Jamoa kartasidan ochilganda — shu jamoa tanlangan. */
  defaultTeamId?: string | null;
  onClose: () => void;
  /** SMS ketmagan — vaqtinchalik parol adminga bir marta ko'rsatiladi. */
  onPassword: (value: { name: string; code: string; password: string }) => void;
}

/**
 * «Operator qo‘shish» (admin-operatorlar-jamoasi.holatlar «Oynalar»): ism, familiya, telefon, jamoa, ish joyi (brauzer
 * softfoni yoki stol telefoni; mobil ilova — 2-bosqich), softfon hisobi ID dan. Backend: `POST /admin/team` rol
 * OPERATOR_LEAD; jamoa va ish joyi — taklif (fe-15 §2, §13).
 */
export function AddOperatorDialog({ teams, defaultTeamId, onClose, onPassword }: AddOperatorDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phoneLayout = useMediaQuery('(max-width: 767.98px)');
  const create = useCreateStaffMutation();
  const formId = useId();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [teamId, setTeamId] = useState(defaultTeamId ?? teams[0]?.id ?? '');
  const [workspace, setWorkspace] = useState<Exclude<Workspace, 'APP'>>('BROWSER');
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [taken, setTaken] = useState<{ phone: string; text: string } | null>(null);
  const placement = phoneLayout ? 'top' : 'bottomRight';

  const errors: Partial<Record<Field, string>> = {
    firstName: firstName.trim() ? undefined : t('staff.form.firstNameRequired'),
    lastName: lastName.trim() ? undefined : t('staff.form.lastNameRequired'),
    phone: !phone ? t('staff.form.phoneRequired') : !isUzMobileNumber(phone) ? t('staff.form.phoneInvalid') : taken?.phone === phone ? taken.text : undefined,
  };
  const shown = (field: Field) => (touched[field] ? errors[field] : undefined);

  const submit = () => {
    setTouched({ firstName: true, lastName: true, phone: true });
    if (errors.firstName || errors.lastName || errors.phone || create.isPending) return;
    const team = teams.find((item) => item.id === teamId) ?? null;
    create.mutate({ firstName, lastName, phone: `+998${phone}`, role: 'OPERATOR_LEAD', teamId: team?.id ?? null, workspace }, {
      onSuccess: (result) => {
        const name = displayName(result.user);
        const account = softphoneAccountOf(result.user.code);
        const shownPassword = !result.smsSent && result.temporaryPassword;
        notification.success({
          title: t('staff.ops.toast.added', { name }),
          description: shownPassword
            ? t('staff.ops.toast.addedShown', { account })
            : team ? t('staff.ops.toast.addedTeam', { team: shortPersonName(team.supervisor.name), account }) : t('staff.ops.toast.addedNoTeam', { account }),
          placement,
          duration: 5,
        });
        onClose();
        if (shownPassword && result.temporaryPassword) onPassword({ name, code: result.user.code, password: result.temporaryPassword });
      },
      onError: (error) => {
        const owner = existingUserOf(error);
        if (owner) {
          setTaken({ phone, text: t('staff.form.phoneTaken', { name: shortPersonName(owner.name), code: userCode(owner.id) }) });
          return;
        }
        notification.error({ title: t('staff.ops.addDlg.failed'), description: getApiErrorMessage(error), placement });
      },
    });
  };

  const field = (name: Field, label: string, control: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode) => {
    const id = `${formId}-${name}`;
    const error = shown(name);
    return (
      <div className={styles.field}>
        <div className={ui.labelRow}><label htmlFor={id}>{label} <span className={ui.required} aria-hidden>*</span></label></div>
        {control({ id, invalid: Boolean(error), describedBy: error ? `${id}-error` : undefined })}
        {error ? <p id={`${id}-error`} className={styles.error}><CircleX aria-hidden /><span>{error}</span></p> : null}
      </div>
    );
  };

  return (
    <Dialog
      open
      title={t('staff.ops.add')}
      description={t('staff.ops.addDlg.sub')}
      icon={<UserPlus />}
      width={480}
      locked={create.isPending}
      onClose={onClose}
      testId="add-operator-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={create.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={create.isPending} savingLabel={t('staff.form.saving')} shortcut={false} icon={<UserPlus />}>{t('staff.ops.addDlg.submit')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.form}>
        <div className={styles.names}>
          {field('firstName', t('staff.form.firstName'), ({ id, invalid, describedBy }) => (
            <input id={id} className={styles.input} value={firstName} autoComplete="given-name" aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => setFirstName(event.target.value)} onBlur={() => setTouched((state) => ({ ...state, firstName: true }))} />
          ))}
          {field('lastName', t('staff.form.lastName'), ({ id, invalid, describedBy }) => (
            <input id={id} className={styles.input} value={lastName} autoComplete="family-name" aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => setLastName(event.target.value)} onBlur={() => setTouched((state) => ({ ...state, lastName: true }))} />
          ))}
        </div>
        {field('phone', t('staff.form.phone'), ({ id, invalid, describedBy }) => (
          <PhoneInput id={id} className={styles.phone} value={phone} placeholder="90 123 45 67" status={invalid ? 'error' : undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={setPhone} onBlur={() => setTouched((state) => ({ ...state, phone: true }))} />
        ))}
        <div className={styles.field}>
          <div className={ui.labelRow}><label htmlFor={`${formId}-team`}>{t('staff.ops.addDlg.team')}</label></div>
          <div className={ui.select}>
            <select id={`${formId}-team`} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              {teams.map((team) => <option key={team.id} value={team.id}>{t('staff.ops.addDlg.teamOption', { name: shortPersonName(team.supervisor.name) })}</option>)}
              <option value="">{t('staff.ops.addDlg.noTeam')}</option>
            </select>
            <ChevronDown aria-hidden />
          </div>
        </div>
        <fieldset className={ui.fieldset}>
          <legend className={ui.legend}>{t('staff.ops.addDlg.workspace')}</legend>
          <div className={ui.options}>
            {WORKSPACES.map((value) => {
              const disabled = value === 'APP';
              const selected = workspace === value;
              const id = `${formId}-ws-${value}`;
              return (
                <div key={value} className={ui.option} data-selected={selected || undefined} data-disabled={disabled || undefined}>
                  <div className={ui.optionRow}>
                    <label htmlFor={id} className={ui.optionLabel}>
                      <span className={ui.radio}>
                        <input type="radio" id={id} name={`${formId}-ws`} checked={selected} disabled={disabled} aria-describedby={selected ? `${id}-d` : undefined} onChange={() => { if (value !== 'APP') setWorkspace(value); }} />
                        <span />
                      </span>
                      <span className={ui.optionName}>{t(value === 'SIP' ? 'staff.ops.wsChoice.SIP' : `staff.ops.ws.${value}`)}</span>
                    </label>
                    {disabled ? <span className={styles.stage}>{t('staff.stage.M2')}</span> : null}
                  </div>
                  {selected ? <p id={`${id}-d`} className={ui.optionText}>{t(`staff.ops.addDlg.wsHint.${value}`)}</p> : null}
                </div>
              );
            })}
          </div>
        </fieldset>
        <div className={styles.field}>
          <div className={ui.labelRow}><label htmlFor={`${formId}-sf`}>{t('staff.ops.addDlg.softphone')}</label></div>
          <input id={`${formId}-sf`} className={styles.input} value={t('staff.ops.addDlg.softphoneValue')} disabled aria-describedby={`${formId}-sf-hint`} />
          <p id={`${formId}-sf-hint`} className={ui.hint}>{t('staff.ops.addDlg.softphoneHint')}</p>
        </div>
        <p className={styles.info}>{t('staff.ops.addDlg.footnote')}</p>
      </div>
    </Dialog>
  );
}
