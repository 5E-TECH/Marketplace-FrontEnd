import type { ReactNode } from 'react';
import styles from './StatusPanel.module.css';

export interface StatusPanelRow {
  label: string;
  value: ReactNode;
}

interface StatusPanelProps {
  icon: ReactNode;
  /** Kichik yorliq: «Xato 403», «Noma’lum rol». */
  code: string;
  heading: string;
  text: string;
  actions?: ReactNode;
  /** O'ng blok: «Nima ochilmoqchi bo‘ldi», «Adminga yuboring». */
  aside?: { title: string; rows: StatusPanelRow[]; footer?: ReactNode };
  testId?: string;
}

/** Sahifa holati kartasi — umumiy-403, umumiy-404 taxtalari (karkas ichida). */
export function StatusPanel({ icon, code, heading, text, actions, aside, testId }: StatusPanelProps) {
  return (
    <section className={styles.panel} data-testid={testId}>
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden>{icon}</span>
        <p className={styles.code}>{code}</p>
        <h2 className={styles.heading}>{heading}</h2>
        <p className={styles.text}>{text}</p>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {aside ? (
        <div className={styles.aside}>
          <p className={styles.asideTitle}>{aside.title}</p>
          <dl className={styles.rows}>
            {aside.rows.map((row) => (
              <div key={row.label} className={styles.row}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {aside.footer}
        </div>
      ) : null}
    </section>
  );
}

/** Manzil «chip»i (Nima ochilmoqchi bo‘ldi → Manzil). */
export function StatusPanelChip({ children }: { children: ReactNode }) {
  return <span className={styles.chip}>{children}</span>;
}
