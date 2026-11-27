import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import type { UserRole } from '../../auth/model/authTypes';
import { ROLE_LABEL_KEYS } from '../../auth/lib/roleLabels';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { roleMenuKeys } from '../lib/roleMenu';
import { ROLE_CHOICES, roleInfo } from '../model/roleCatalog';
import { canGrantRole, usesTwoFactor } from '../model/staffRules';
import type { StaffRole, Team } from '../model/staffTypes';
import styles from './staffUi.module.css';

interface RoleOptionsProps {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  viewerRole: UserRole;
  /** Rolni almashtirishda — «hozirgi rol» belgisi. */
  current?: UserRole | null;
  teams: readonly Team[];
  teamId: string;
  onTeamChange: (teamId: string) => void;
}

/**
 * «Rol *» kartalari: tanlanganida rolning ishi, menyusi (marshrut manifestidan) va operatorga «Jamoa». Moliya va
 * admin — «+ ilovadagi kod»; superadmin rolini faqat superadmin beradi.
 */
export function RoleOptions({ value, onChange, viewerRole, current, teams, teamId, onTeamChange }: RoleOptionsProps) {
  const { t } = useTranslation();
  const baseId = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('staff.role.legend')} <span className={styles.required} aria-hidden>*</span></legend>
      <div className={styles.options}>
        {ROLE_CHOICES.map((role) => {
          const selected = value === role;
          const disabled = !canGrantRole(viewerRole, role);
          const id = `${baseId}-${role}`;
          const tag = role === current ? t('staff.role.current')
            : disabled ? t('staff.role.superOnly')
              : usesTwoFactor(role) && role !== 'SUPERADMIN' ? t('staff.role.codeTag') : null;
          return (
            <div key={role} className={styles.option} data-selected={selected || undefined} data-disabled={disabled || undefined}>
              <div className={styles.optionRow}>
                <label htmlFor={id} className={styles.optionLabel}>
                  <span className={styles.radio}>
                    <input type="radio" id={id} name={`${baseId}-role`} checked={selected} disabled={disabled} aria-describedby={selected ? `${id}-d` : undefined} onChange={() => onChange(role)} />
                    <span />
                  </span>
                  <span className={styles.optionName}>{t(ROLE_LABEL_KEYS[role])}</span>
                </label>
                {tag ? <span className={styles.optionTag}>{tag}</span> : null}
              </div>
              {selected ? (
                <>
                  <p id={`${id}-d`} className={styles.optionText}>{t(roleInfo(role).job)}</p>
                  <div className={styles.optionBox}>
                    <div>
                      <p className={styles.boxLabel}>{t('staff.role.menu')}</p>
                      <p className={styles.boxValue}>{roleMenuKeys(role).map((key) => t(key)).join(' · ')}</p>
                    </div>
                    {role === 'OPERATOR_LEAD' ? (
                      <div>
                        <div className={styles.labelRow}><label htmlFor={`${baseId}-team`}>{t('staff.role.team')}</label></div>
                        <div className={styles.select}>
                          <select id={`${baseId}-team`} value={teamId} onChange={(event) => onTeamChange(event.target.value)}>
                            {teams.map((team) => <option key={team.id} value={team.id}>{t('staff.role.teamOption', { name: shortPersonName(team.supervisor.name) })}</option>)}
                            <option value="">{t('staff.role.noTeam')}</option>
                          </select>
                          <ChevronDown aria-hidden />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
