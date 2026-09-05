import { memo, type HTMLAttributes, type PropsWithChildren } from 'react';
import styles from './FilterPanel.module.css';

type FilterPanelProps = PropsWithChildren<HTMLAttributes<HTMLElement>>;

export const FilterPanel = memo(function FilterPanel({ children, className = '', ...props }: FilterPanelProps) {
  return <section className={`${styles.panel} ${className}`.trim()} {...props}>{children}</section>;
});
