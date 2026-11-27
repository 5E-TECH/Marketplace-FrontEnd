import { Ban, CircleCheck, CircleDot, CircleMinus, Clock, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { initials } from '../../../shared/lib/initials';
import { tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { displayName, momentText } from '../lib/staffFormat';
import { accountStatus, twoFactorState } from '../model/staffRules';
import type { AccountStatus, UserAccount } from '../model/staffTypes';
import styles from './staffUi.module.css';

const STATUS_BADGE: Record<AccountStatus, { tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; icon: typeof Ban; key: 'staff.status.active' | 'staff.status.blocked' | 'staff.status.unknownRole' | 'staff.status.neverLoggedIn' | 'staff.status.inactive' }> = {
  ACTIVE: { tone: 'success', icon: CircleCheck, key: 'staff.status.active' },
  BLOCKED: { tone: 'danger', icon: Ban, key: 'staff.status.blocked' },
  UNKNOWN_ROLE: { tone: 'warning', icon: TriangleAlert, key: 'staff.status.unknownRole' },
  NEVER_LOGGED_IN: { tone: 'info', icon: CircleDot, key: 'staff.status.neverLoggedIn' },
  INACTIVE: { tone: 'neutral', icon: CircleMinus, key: 'staff.status.inactive' },
};

/** Hisob holati: «Faol», «Bloklangan», «Noma’lum rol», «Hali kirmagan», «Nofaol» (admin-foydalanuvchilar). */
export function AccountStatusBadge({ user }: { user: UserAccount }) {
  const { t } = useTranslation();
  const entry = STATUS_BADGE[accountStatus(user)];
  return <Badge tone={entry.tone} icon={entry.icon}>{t(entry.key)}</Badge>;
}

/**
 * «Ikki bosqichli kirish» ustuni: ulangan (sana), tiklangan (qachon · kim), birinchi kirishda ulaydi; 2FA siz rollar —
 * «—» (ekran o'quvchiga «talab qilinmaydi»).
 */
export function TwoFactorCell({ user }: { user: UserAccount }) {
  const { t } = useTranslation();
  const state = twoFactorState(user);
  if (state === 'NOT_REQUIRED') {
    return <><span className={styles.dash}>—</span><span className={styles.visuallyHidden}>{t('staff.tfa.notRequired')}</span></>;
  }
  if (state === 'CONNECTED') {
    return (
      <span className={styles.stack}>
        <Badge tone="success" icon={CircleCheck}>{t('staff.tfa.connected')}</Badge>
        <span className={styles.subtle}>{tashkentDay(user.totpEnabledAt ?? '')}</span>
      </span>
    );
  }
  if (state === 'RESET' && user.twoFactorReset) {
    return (
      <span className={styles.stack}>
        <Badge tone="warning" icon={Clock}>{t('staff.tfa.reset')}</Badge>
        <span className={styles.subtle}>{`${momentText(user.twoFactorReset.at)} · ${displayName({ name: user.twoFactorReset.by, phone: '' })}`}</span>
      </span>
    );
  }
  return <Badge tone="neutral" icon={Clock}>{t('staff.tfa.pending')}</Badge>;
}

/** Telefon kartasidagi 2FA qatori: «2FA ulangan · 28.12.2026» yoki to'q sariq «2FA tiklandi — …». */
export function TwoFactorLine({ user }: { user: UserAccount }) {
  const { t } = useTranslation();
  const state = twoFactorState(user);
  if (state === 'CONNECTED') return <span className={styles.tfaLine}><ShieldCheck aria-hidden />{t('staff.card.tfaConnected', { date: tashkentDay(user.totpEnabledAt ?? '') })}</span>;
  if (state === 'RESET' && user.twoFactorReset) {
    return (
      <span className={styles.tfaLine} data-tone="warning">
        <Clock aria-hidden />
        {t('staff.card.tfaReset', { when: momentText(user.twoFactorReset.at), by: displayName({ name: user.twoFactorReset.by, phone: '' }) })}
      </span>
    );
  }
  return null;
}

export function Avatar({ name, size = 32, tone }: { name: string; size?: 32 | 36 | 48; tone?: 'dark' }) {
  return <span className={styles.avatar} data-size={size} data-tone={tone} aria-hidden>{initials(name)}</span>;
}

/** Oynalardagi kim qatori (admin-foydalanuvchilar «Rol berish», «Bloklash»): avatar, ism · ID, izoh, holat. */
export function PersonSummary({ name, title, sub, badge }: { name: string; title: ReactNode; sub: ReactNode; badge?: ReactNode }) {
  return (
    <div className={styles.person}>
      <Avatar name={name} size={36} />
      <span className={styles.personText}>
        <span className={styles.personTitle}>{title}</span>
        <span className={styles.personSub}>{sub}</span>
      </span>
      {badge}
    </div>
  );
}
