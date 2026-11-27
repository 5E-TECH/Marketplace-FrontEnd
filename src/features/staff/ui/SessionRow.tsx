import { Monitor, Smartphone } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { lastLoginText, sessionDevice } from '../lib/staffFormat';
import type { StaffSession } from '../model/staffTypes';
import styles from './staffUi.module.css';

/** Oxirgi faollik shu daqiqalar ichida bo'lsa — «hozir faol». */
const ACTIVE_MS = 5 * 60_000;
const MOBILE_OS = ['iPhone', 'Android'];

/**
 * Sessiya qatori (admin-foydalanuvchi-karta «Faol sessiyalar», D6): qurilma ikonkasi, «Chrome · Windows», IP va
 * kirgan/oxirgi faollik payti; o'ngda — amal yoki «Hozir faol».
 */
export function SessionRow({ session, trailing }: { session: StaffSession; trailing?: ReactNode }) {
  const { t } = useTranslation();
  const Icon = MOBILE_OS.includes(session.os) ? Smartphone : Monitor;
  const [now] = useState(() => Date.now());
  const active = now - Date.parse(session.lastSeenAt) < ACTIVE_MS;
  const line = session.current
    ? t('staff.card.sessionThis', { ip: session.ip, when: lastLoginText(session.createdAt, t) })
    : active
      ? t('staff.card.sessionNow', { ip: session.ip, when: lastLoginText(session.createdAt, t) })
      : t('staff.card.sessionLast', { ip: session.ip, when: tashkentDateTime(session.lastSeenAt) });
  return (
    <div className={styles.session}>
      <span className={styles.sessionIcon} aria-hidden><Icon /></span>
      <span className={styles.sessionText}>
        <span className={styles.sessionName}>{sessionDevice(session)}</span>
        <span className={styles.sessionLine}>{line}</span>
      </span>
      {trailing}
    </div>
  );
}
