import type { ReactNode } from 'react';
import styles from './TablePanel.module.css';

interface TablePanelProps {
  title: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TablePanel({ title, caption, action, children, className }: TablePanelProps) {
  return (
    <section className={`${styles.panel}${className ? ` ${className}` : ''}`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <strong>{title}</strong>
          {caption ? <span>{caption}</span> : null}
        </div>
        {action ? <div className={styles.action}>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
