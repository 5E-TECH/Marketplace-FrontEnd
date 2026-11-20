import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'muted' | 'plain' | 'action' | 'yellow' | 'orange' | 'unnamed';

interface BadgeProps {
  tone: BadgeTone;
  icon?: LucideIcon | null;
  title?: string;
  testId?: string;
  children: ReactNode;
}

/** Holat belgisi (komponentlar-E §2): so'z doim yoziladi — rang yolg'iz kelmaydi. */
export function Badge({ tone, icon: Icon, title, testId, children }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone} title={title} data-testid={testId}>
      {Icon ? <Icon aria-hidden strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

/** Kod belgisi: sahifa kodi (k7m2qa), lid raqami. */
export function CodeBadge({ children }: { children: ReactNode }) {
  return <span className={styles.code}>{children}</span>;
}

/** Nuqta + so'z (operator holati: Onlayn · Tanaffus · Oflayn). */
export function DotLabel({ tone, children }: { tone: 'success' | 'warning' | 'neutral'; children: ReactNode }) {
  return <span className={styles.dot} data-tone={tone}>{children}</span>;
}
