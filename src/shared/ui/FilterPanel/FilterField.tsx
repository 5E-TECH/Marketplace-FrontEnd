import type { ReactNode } from 'react';
import styles from './FilterPanel.module.css';

interface FilterFieldProps {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FilterField({ label, htmlFor, children, className = '' }: FilterFieldProps) {
  return (
    <div className={`${styles.field} ${className}`.trim()}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
