import { CircleCheck, CircleDot, CircleMinus, CircleX, Clock, PhoneOff, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LeadStatus } from '../model/operatorTypes';
import { statusLabel } from '../lib/leadFormat';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from './OperatorChip.module.css';

export type ChipTone = 'warning' | 'info' | 'danger' | 'success' | 'neutral' | 'plain' | 'action' | 'muted';

export function OperatorChip({ tone, icon: Icon, children, title, testId }: { tone: ChipTone; icon?: LucideIcon; children: ReactNode; title?: string; testId?: string }) {
  return (
    <span className={styles.chip} data-tone={tone} title={title} data-testid={testId}>
      {Icon ? <Icon aria-hidden strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

const STATUS: Record<LeadStatus, { tone: ChipTone; icon: LucideIcon }> = {
  NEW: { tone: 'info', icon: CircleDot },
  BOOKED: { tone: 'warning', icon: Clock },
  CALLBACK: { tone: 'warning', icon: Clock },
  CONFIRMED: { tone: 'success', icon: CircleCheck },
  REJECTED: { tone: 'danger', icon: CircleX },
  INVALID: { tone: 'neutral', icon: CircleMinus },
  MERGED: { tone: 'neutral', icon: CircleMinus },
  NO_CONTACT: { tone: 'neutral', icon: PhoneOff },
};

/** Lid holati belgisi: «Yangi», «Bronda», «Qayta qo'ng'iroq», «Rad etildi»… (dizayndagi ikonka va rang). */
export function LeadStatusChip({ status }: { status: LeadStatus }) {
  const { t } = useTranslation();
  const { tone, icon } = STATUS[status];
  const label = statusLabel(status, t);
  return <OperatorChip tone={tone} icon={icon} title={`${t('opw.statusTitle')}: ${label}`}>{label}</OperatorChip>;
}
