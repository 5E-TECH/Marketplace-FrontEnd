import { App } from 'antd';
import { CircleX, UserPlus, X } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { existingUserOf } from '../../../features/staff/api/staffApi';
import { useCreateStaffMutation, useTeamsQuery } from '../../../features/staff/api/staffQueries';
import { userCode } from '../../../features/staff/model/staffRules';
import type { CreateStaffResult, StaffRole } from '../../../features/staff/model/staffTypes';
import { RoleOptions } from '../../../features/staff/ui/RoleOptions';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { isUzMobileNumber } from '../../../shared/lib/phone';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { PhoneInput } from '../../../shared/ui/PhoneInput/PhoneInput';
import type { CardVariant } from './StaffCard';
import styles from './NewStaffPanel.module.css';

type Field = 'firstName' | 'lastName' | 'phone';

interface NewStaffPanelProps {
  viewerRole: UserRole;
  variant: CardVariant;
  onClose: () => void;
  onCreated: (result: CreateStaffResult) => void;
}

/**
 * «Yangi xodim» (admin-foydalanuvchi-karta K1): ism, familiya, telefon (band — kimniki, taklif `existingUser`), rol
 * kartalari (operatorga jamoa), «Kirish» izohi. Backend: `POST /admin/team` — vaqtinchalik parol SMS bilan (taklif) yoki
 * javobda bir marta (fe-15 §4). Desktopda panel, planshetda drawer, telefonda ichki sahifa (pastda tugmalar).
 */
export function NewStaffPanel({ viewerRole, variant, onClose, onCreated }: NewStaffPanelProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phoneLayout = useMediaQuery('(max-width: 767.98px)');
  const create = useCreateStaffMutation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('OPERATOR_LEAD');
  const [teamChoice, setTeamChoice] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [taken, setTaken] = useState<{ phone: string; text: string } | null>(null);
  const teams = useTeamsQuery(role === 'OPERATOR_LEAD');
  const teamId = teamChoice ?? teams.data?.[0]?.id ?? '';
  const formId = useId();

  const errors: Partial<Record<Field, string>> = {
    firstName: firstName.trim() ? undefined : t('staff.form.firstNameRequired'),
    lastName: lastName.trim() ? undefined : t('staff.form.lastNameRequired'),
    phone: !phone ? t('staff.form.phoneRequired') : !isUzMobileNumber(phone) ? t('staff.form.phoneInvalid') : taken?.phone === phone ? taken.text : undefined,
  };
  const shown = (field: Field) => (touched[field] ? errors[field] : undefined);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setTouched({ firstName: true, lastName: true, phone: true });
    if (errors.firstName || errors.lastName || errors.phone || create.isPending) return;
    create.mutate({ firstName, lastName, phone: `+998${phone}`, role, teamId: role === 'OPERATOR_LEAD' ? teamId || null : null }, {
      onSuccess: onCreated,
      onError: (error) => {
        const owner = existingUserOf(error);
        if (owner) {
          setTaken({ phone, text: t('staff.form.phoneTaken', { name: shortPersonName(owner.name), code: userCode(owner.id) }) });
          return;
        }
        notification.error({ title: t('staff.form.failed'), description: getApiErrorMessage(error), placement: phoneLayout ? 'top' : 'bottomRight' });
      },
    });
  };

  const field = (name: Field, label: string, control: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode) => {
    const id = `${formId}-${name}`;
    const error = shown(name);
    return (
      <div className={styles.field}>
        <div className={styles.labelRow}><label htmlFor={id}>{label} <span className={styles.required} aria-hidden>*</span></label></div>
        {control({ id, invalid: Boolean(error), describedBy: error ? `${id}-error` : undefined })}
        {error ? <p id={`${id}-error`} className={styles.error}><CircleX aria-hidden /><span>{error}</span></p> : null}
      </div>
    );
  };

  const buttons = (
    <>
      <button type="button" className={styles.secondary} onClick={onClose} disabled={create.isPending}>{t('staff.cancel')}</button>
      <button type="submit" form={formId} className={styles.primary} disabled={create.isPending} aria-busy={create.isPending || undefined}>
        {create.isPending ? t('staff.form.saving') : t('staff.form.submit')}
      </button>
    </>
  );

  return (
    <aside className={styles.panel} data-variant={variant} aria-labelledby={variant === 'page' ? undefined : `${formId}-title`} data-testid="staff-new">
      {variant === 'page' ? null : (
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden><UserPlus /></span>
          <div className={styles.headText}>
            <h2 id={`${formId}-title`}>{t('staff.form.title')}</h2>
            <p>{t('staff.form.sub')}</p>
          </div>
          <button type="button" className={styles.close} aria-label={t('staff.form.close')} title={t('staff.form.close')} onClick={onClose}><X aria-hidden /></button>
        </div>
      )}
      <form id={formId} className={styles.form} aria-label={t('staff.form.title')} noValidate onSubmit={submit}>
        <div className={styles.body}>
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
          <RoleOptions value={role} onChange={setRole} viewerRole={viewerRole} teams={teams.data ?? []} teamId={teamId} onTeamChange={setTeamChoice} />
          <div className={styles.info}>
            <p className={styles.infoTitle}>{t('staff.form.loginTitle')}</p>
            <p className={styles.infoText}>{t('staff.form.loginText', { term: t('staff.form.term') })}</p>
          </div>
        </div>
        {variant === 'page' ? null : <div className={styles.footer}>{buttons}</div>}
      </form>
      {variant === 'page' ? <PageActionBar>{buttons}</PageActionBar> : null}
    </aside>
  );
}
