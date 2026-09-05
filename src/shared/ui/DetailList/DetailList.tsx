import type { ReactNode } from 'react';
import styles from './DetailList.module.css';

export interface DetailItem { label: ReactNode; value: ReactNode }

export function DetailList({ items }: { items: DetailItem[] }) {
  return <dl className={styles.list}>{items.map((item, index) => <div className={styles.item} key={index}><dt>{item.label}</dt><dd>{item.value || '—'}</dd></div>)}</dl>;
}
