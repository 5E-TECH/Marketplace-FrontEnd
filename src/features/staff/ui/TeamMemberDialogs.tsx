import { App } from 'antd';
import { CircleX, History, Info, LogOut, PauseCircle, Pencil, PhoneOff, Send, ShieldAlert, Inbox, UserCheck, UserPlus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { isUzMobileNumber } from '../../../shared/lib/phone';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { PhoneInput } from '../../../shared/ui/PhoneInput/PhoneInput';
import { existingUserOf } from '../api/staffApi';
import {
  useActivateMemberMutation, useAddMemberMutation, useDeactivateMemberMutation, useMemberHistoryQuery, useRequestBlockMutation, useRequestUnblockMutation,
  useUpdateMemberMutation,
} from '../api/staffQueries';
import { auditText } from '../lib/auditText';
import { softphoneAccountOf } from '../lib/operatorFormat';
import { displayName, momentText } from '../lib/staffFormat';
import { WORKSPACES, type Workspace } from '../model/operatorTypes';
import { userCode } from '../model/staffRules';
import type { TeamMember } from '../model/teamTypes';
import { AccountStatusBadge, PersonSummary } from './StaffBadges';
import styles from './operatorDialogs.module.css';
import ui from './staffUi.module.css';

type Field = 'firstName' | 'lastName' | 'phone';
const REASON_MAX = 500;
const usePlacement = () => (useMediaQuery('(max-width: 767.98px)') ? 'top' : 'bottomRight');

/** Telefon raqamining 9 raqami (`+998` siz) — forma qiymati. */
const localDigits = (phone: string) => phone.replace(/\D/g, '').slice(-9);

interface MemberFormDialogProps {
  /** add — yangi operator; edit — shu operator. */
  member?: TeamMember;
  teamName: string;
  /** «Operator · oflayn 14:20 dan · bugun 30 urinish» (tahrirlashda). */
  presence?: string;
  onClose: () => void;
  onPassword?: (value: { name: string; code: string; password: string }) => void;
}

/**
 * «Operator qo‘shish» va «Operatorni tahrirlash» (nazoratchi-jamoa.holatlar «Oynalar»): ism, familiya, telefon (band —
 * kimniki), jamoa (o'zgarmaydi), softfon hisobi (ID dan), ish joyi. Taklif: `POST|PATCH /supervisor/team/operators`.
 */
export function MemberFormDialog({ member, teamName, presence, onClose, onPassword }: MemberFormDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const placement = usePlacement();
  const add = useAddMemberMutation();
  const update = useUpdateMemberMutation();
  const saving = add.isPending || update.isPending;
  const formId = useId();
  const editing = Boolean(member);
  const [firstName, setFirstName] = useState(member?.user.firstName ?? '');
  const [lastName, setLastName] = useState(member?.user.lastName ?? '');
  const [phone, setPhone] = useState(member ? localDigits(member.user.phone) : '');
  const [workspace, setWorkspace] = useState<Exclude<Workspace, 'APP'>>(member?.softphone?.workspace === 'SIP' ? 'SIP' : 'BROWSER');
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [taken, setTaken] = useState<{ phone: string; text: string } | null>(null);

  const errors: Partial<Record<Field, string>> = {
    firstName: firstName.trim() ? undefined : t('staff.form.firstNameRequired'),
    lastName: lastName.trim() ? undefined : t('staff.form.lastNameRequired'),
    phone: !phone ? t('staff.form.phoneRequired') : !isUzMobileNumber(phone) ? t('staff.form.phoneInvalid') : taken?.phone === phone ? taken.text : undefined,
  };
  const shown = (field: Field) => (touched[field] ? errors[field] : undefined);

  const onError = (error: unknown) => {
    const owner = existingUserOf(error);
    if (owner) {
      setTaken({ phone, text: t('staff.sv.phoneTaken', { name: shortPersonName(owner.name), code: userCode(owner.id) }) });
      setTouched((state) => ({ ...state, phone: true }));
      return;
    }
    notification.error({ title: t(editing ? 'staff.sv.editDlg.failed' : 'staff.ops.addDlg.failed'), description: getApiErrorMessage(error), placement });
  };

  const submit = () => {
    setTouched({ firstName: true, lastName: true, phone: true });
    if (errors.firstName || errors.lastName || errors.phone || saving) return;
    const input = { firstName, lastName, phone: `+998${phone}`, workspace };
    if (member) {
      update.mutate({ id: member.user.id, ...input }, {
        onSuccess: (saved) => {
          notification.success({ title: t('staff.sv.toast.saved', { name: displayName(saved.user) }), description: t('staff.sv.toast.savedText'), placement, duration: 5 });
          onClose();
        },
        onError,
      });
      return;
    }
    add.mutate(input, {
      onSuccess: (result) => {
        const name = displayName(result.member.user);
        const account = result.member.softphone?.account ?? softphoneAccountOf(result.member.user.code);
        notification.success({ title: t('staff.ops.toast.added', { name }), description: t('staff.ops.toast.addedTeam', { team: teamName, account }), placement, duration: 5 });
        onClose();
        if (!result.smsSent && result.temporaryPassword) onPassword?.({ name, code: result.member.user.code, password: result.temporaryPassword });
      },
      onError,
    });
  };

  const field = (name: Field, label: string, control: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode, hint?: string, mark = true) => {
    const id = `${formId}-${name}`;
    const error = shown(name);
    return (
      <div className={styles.field}>
        <div className={ui.labelRow}><label htmlFor={id}>{label}{mark ? <> <span className={ui.required} aria-hidden>*</span></> : null}</label></div>
        {control({ id, invalid: Boolean(error), describedBy: error ? `${id}-error` : hint ? `${id}-hint` : undefined })}
        {error ? <p id={`${id}-error`} className={styles.error}><CircleX aria-hidden /><span>{error}</span></p> : hint ? <p id={`${id}-hint`} className={ui.hint}>{hint}</p> : null}
      </div>
    );
  };

  const fixed = (key: string, label: string, value: string, hint: string) => (
    <div className={styles.field}>
      <div className={ui.labelRow}><label htmlFor={`${formId}-${key}`}>{label}</label></div>
      <input id={`${formId}-${key}`} className={styles.input} value={value} disabled aria-describedby={`${formId}-${key}-hint`} />
      <p id={`${formId}-${key}-hint`} className={ui.hint}>{hint}</p>
    </div>
  );

  const name = member ? displayName(member.user) : '';
  return (
    <Dialog
      open
      title={t(editing ? 'staff.sv.editDlg.title' : 'staff.ops.add')}
      description={editing ? t('staff.sv.editDlg.sub', { name }) : t('staff.sv.addDlg.sub', { team: teamName })}
      icon={editing ? <Pencil /> : <UserPlus />}
      width={480}
      locked={saving}
      onClose={onClose}
      testId={editing ? 'member-edit-dialog' : 'member-add-dialog'}
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={saving} savingLabel={t(editing ? 'staff.ops.spDlg.saving' : 'staff.form.saving')} shortcut={false} icon={editing ? undefined : <UserPlus />}>
            {t(editing ? 'staff.ops.spDlg.submit' : 'staff.ops.addDlg.submit')}
          </DialogPrimary>
        </>
      )}
    >
      {member ? (
        <PersonSummary
          name={member.user.name || member.user.phone}
          title={`${name} · ${member.user.code}`}
          sub={t('staff.sv.editDlg.personSub', { presence: presence ?? '' })}
          badge={<AccountStatusBadge user={member.user} />}
        />
      ) : null}
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
        ), editing ? undefined : t('staff.sv.addDlg.phoneHint'), !editing)}
        <div className={styles.names}>
          {editing
            ? fixed('sf', t('staff.ops.addDlg.softphone'), member?.softphone?.account ?? softphoneAccountOf(member?.user.code ?? ''), t('staff.sv.editDlg.softphoneHint'))
            : fixed('team', t('staff.ops.addDlg.team'), teamName ? t('staff.ops.teamName', { name: teamName }) : '—', t('staff.sv.addDlg.teamHint'))}
          {editing
            ? fixed('team', t('staff.ops.addDlg.team'), teamName ? t('staff.ops.teamName', { name: teamName }) : '—', t('staff.sv.editDlg.teamHint'))
            : fixed('sf', t('staff.ops.addDlg.softphone'), t('staff.ops.addDlg.softphoneValue'), t('staff.sv.addDlg.softphoneHint'))}
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
                  {selected ? <p id={`${id}-d`} className={ui.optionText}>{t(editing ? `staff.sv.editDlg.wsHint.${value}` : `staff.ops.addDlg.wsHint.${value}`)}</p> : null}
                </div>
              );
            })}
          </div>
        </fieldset>
        {editing
          ? <p className={ui.note}><History aria-hidden /><span>{t('staff.sv.editDlg.audit')}</span></p>
          : <p className={styles.info}>{t('staff.sv.addDlg.footnote')}</p>}
      </div>
    </Dialog>
  );
}

function ReasonField({ id, value, invalid, placeholder, hint, error, onChange }: { id: string; value: string; invalid: boolean; placeholder?: string; hint?: string; error: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className={ui.labelRow}><label htmlFor={id}>{t('staff.block.reason')} <span className={ui.required} aria-hidden>*</span></label></div>
      <textarea id={id} className={ui.textarea} value={value} maxLength={REASON_MAX} placeholder={placeholder} required aria-invalid={invalid || undefined} aria-describedby={`${id}-hint`} onChange={(event) => onChange(event.target.value)} />
      {invalid ? <p id={`${id}-hint`} className={ui.error}>{error}</p> : hint ? <p id={`${id}-hint`} className={ui.hint}>{hint}</p> : <span id={`${id}-hint`} hidden />}
    </div>
  );
}

/** «… ni nofaol qilish» (nazoratchi-jamoa.holatlar): oqibatlar va sabab (majburiy); taklif `…/deactivate`. */
export function DeactivateMemberDialog({ member, presence, onClose }: { member: TeamMember; presence: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const placement = usePlacement();
  const deactivate = useDeactivateMemberMutation();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonId = useId();
  const name = displayName(member.user);
  const account = member.softphone?.account ?? softphoneAccountOf(member.user.code);
  const invalid = touched && !reason.trim();

  const submit = () => {
    setTouched(true);
    if (!reason.trim() || deactivate.isPending) return;
    deactivate.mutate({ id: member.user.id, reason }, {
      onSuccess: () => {
        notification.success({ title: t('staff.sv.toast.off', { name }), description: t('staff.sv.toast.offText', { account }), placement, duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.sv.offDlg.failed'), description: getApiErrorMessage(error), placement }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.sv.offDlg.title', { name })}
      description={t('staff.sv.offDlg.sub')}
      icon={<PauseCircle />}
      tone="warning"
      width={480}
      locked={deactivate.isPending}
      onClose={onClose}
      testId="member-deactivate-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={deactivate.isPending}>{t('staff.sv.offDlg.back')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={deactivate.isPending} savingLabel={t('staff.sv.offDlg.saving')} shortcut={false} icon={<PauseCircle />} danger>{t('staff.sv.offDlg.confirm')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary name={member.user.name || member.user.phone} title={`${name} · ${member.user.code}`} sub={t('staff.sv.editDlg.personSub', { presence })} badge={<AccountStatusBadge user={member.user} />} />
      <div className={`${ui.consequences} ${styles.warningBox}`}>
        <ul>
          <li><LogOut aria-hidden /><span>{t('staff.sv.offDlg.login')}</span></li>
          <li><Inbox aria-hidden /><span>{t('staff.sv.offDlg.queue', { decision: t('staff.ops.blockedDecision') })}</span></li>
          <li><PhoneOff aria-hidden /><span>{t('staff.sv.offDlg.softphone', { account })}</span></li>
          <li><History aria-hidden /><span>{t('staff.sv.offDlg.history')}</span></li>
        </ul>
      </div>
      <ReasonField id={reasonId} value={reason} invalid={invalid} hint={t('staff.sv.offDlg.reasonHint')} error={t('staff.sv.offDlg.reasonRequired')} onChange={setReason} />
    </Dialog>
  );
}

/** «… ni faollashtirish» (nazoratchi-jamoa.holatlar): kirish, navbat, softfon; taklif `…/activate`. */
export function ActivateMemberDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const placement = usePlacement();
  const activate = useActivateMemberMutation();
  const name = displayName(member.user);
  const account = member.softphone?.account ?? softphoneAccountOf(member.user.code);
  const inactive = member.inactive;

  const submit = () => {
    if (activate.isPending) return;
    activate.mutate(member.user.id, {
      onSuccess: () => {
        notification.success({ title: t('staff.sv.toast.on', { name }), description: t('staff.sv.toast.onText', { account }), placement, duration: 5 });
        onClose();
      },
      onError: (error) => notification.error({ title: t('staff.sv.onDlg.failed'), description: getApiErrorMessage(error), placement }),
    });
  };

  return (
    <Dialog
      open
      title={t('staff.sv.onDlg.title', { name })}
      description={t('staff.sv.onDlg.sub')}
      icon={<UserCheck />}
      tone="success"
      width={440}
      locked={activate.isPending}
      onClose={onClose}
      testId="member-activate-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={activate.isPending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={activate.isPending} savingLabel={t('staff.sv.onDlg.saving')} shortcut={false} icon={<UserCheck />}>{t('staff.sv.activate')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary
        name={member.user.name || member.user.phone}
        title={`${name} · ${member.user.code}`}
        sub={inactive ? t('staff.sv.onDlg.personSub', { time: momentText(inactive.at), reason: inactive.reason }) : t('staff.sv.state.INACTIVE')}
        badge={<AccountStatusBadge user={member.user} />}
      />
      <div className={ui.facts}>
        <dl>
          <div><dt>{t('staff.sv.onDlg.login')}</dt><dd>{t('staff.sv.onDlg.loginValue')}</dd></div>
          <div><dt>{t('staff.sv.onDlg.queue')}</dt><dd>{t('staff.sv.onDlg.queueValue')}</dd></div>
          <div><dt>{t('staff.sv.onDlg.softphone')}</dt><dd>{t('staff.sv.onDlg.softphoneValue', { account })}</dd></div>
        </dl>
      </div>
    </Dialog>
  );
}

/** «… ni bloklashni so‘rash» va «… ni blokdan chiqarishni so‘rash»: sabab (majburiy); taklif `…/block-request`, `…/unblock-request`. */
export function MemberRequestDialog({ member, kind, presence, onClose }: { member: TeamMember; kind: 'block' | 'unblock'; presence: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const placement = usePlacement();
  const block = useRequestBlockMutation();
  const unblock = useRequestUnblockMutation();
  const pending = block.isPending || unblock.isPending;
  const [reason, setReason] = useState('');
  const [deactivate, setDeactivate] = useState(false);
  const [touched, setTouched] = useState(false);
  const reasonId = useId();
  const checkId = useId();
  const name = displayName(member.user);
  const invalid = touched && !reason.trim();

  const submit = () => {
    setTouched(true);
    if (!reason.trim() || pending) return;
    const done = {
      onSuccess: () => {
        notification.success({ title: t('staff.sv.toast.request'), description: t(kind === 'block' ? 'staff.sv.toast.requestBlock' : 'staff.sv.toast.requestUnblock', { name }), placement, duration: 5 });
        onClose();
      },
      onError: (error: unknown) => notification.error({ title: t('staff.sv.reqDlg.failed'), description: getApiErrorMessage(error), placement }),
    };
    if (kind === 'block') block.mutate({ id: member.user.id, reason, deactivate }, done);
    else unblock.mutate({ id: member.user.id, reason }, done);
  };

  return (
    <Dialog
      open
      title={t(kind === 'block' ? 'staff.sv.reqDlg.blockTitle' : 'staff.sv.reqDlg.unblockTitle', { name })}
      description={t(kind === 'block' ? 'staff.sv.reqDlg.sub' : 'staff.sv.reqDlg.unblockSub')}
      icon={<ShieldAlert />}
      tone={kind === 'block' ? 'danger' : 'action'}
      width={480}
      locked={pending}
      onClose={onClose}
      testId="member-request-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={pending}>{t('staff.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={pending} savingLabel={t('staff.sv.reqDlg.saving')} shortcut={false} icon={<Send />}>{t('staff.sv.reqDlg.submit')}</DialogPrimary>
        </>
      )}
    >
      <PersonSummary name={member.user.name || member.user.phone} title={`${name} · ${member.user.code}`} sub={t('staff.sv.editDlg.personSub', { presence })} badge={<AccountStatusBadge user={member.user} />} />
      <ReasonField id={reasonId} value={reason} invalid={invalid} placeholder={t('staff.sv.reqDlg.placeholder')} error={t('staff.sv.reqDlg.reasonRequired')} onChange={setReason} />
      {kind === 'block' ? (
        <label htmlFor={checkId} className={styles.check}>
          <input id={checkId} type="checkbox" checked={deactivate} onChange={(event) => setDeactivate(event.target.checked)} />
          <span>{t('staff.sv.reqDlg.deactivate')}</span>
        </label>
      ) : null}
      <p className={ui.note}><Info aria-hidden /><span>{kind === 'block' ? t('staff.sv.reqDlg.note', { name }) : t('staff.sv.reqDlg.unblockNote')}</span></p>
    </Dialog>
  );
}

/** «O‘zgarishlar tarixi» (qator menyusi; alohida oyna chizilmagan): shu operator ustidagi audit yozuvlari. */
export function MemberHistoryDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { t } = useTranslation();
  const history = useMemberHistoryQuery(member.user.id);
  const name = displayName(member.user);
  const entries = history.data ?? [];
  return (
    <Dialog
      open
      title={t('staff.sv.historyDlg.title', { name })}
      description={t('staff.sv.historyDlg.sub')}
      icon={<History />}
      tone="neutral"
      width={480}
      onClose={onClose}
      testId="member-history-dialog"
      footer={<DialogCancel onClick={onClose}>{t('staff.sv.historyDlg.close')}</DialogCancel>}
    >
      {history.isError ? <p className={styles.empty}>{getApiErrorMessage(history.error)}</p>
        : history.isPending ? null
          : entries.length ? (
            <ul className={styles.history}>
              {entries.map((entry) => {
                const text = auditText(entry, t);
                return (
                  <li key={entry.id}>
                    <span className={styles.historyTitle}>{text.title}</span>
                    <span className={styles.historyMeta}>{[`${momentText(entry.createdAt)} · ${entry.actorName ? shortPersonName(entry.actorName) : '—'}`, text.detail].filter(Boolean).join(' · ')}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className={styles.empty}>{t('staff.sv.historyDlg.empty')}</p>}
    </Dialog>
  );
}
