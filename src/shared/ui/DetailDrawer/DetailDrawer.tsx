import { Drawer, type DrawerProps } from 'antd';
import type { ReactNode } from 'react';
import styles from './DetailDrawer.module.css';

interface DetailDrawerProps extends Omit<DrawerProps, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
}

export function DetailDrawer({ title, subtitle, children, rootClassName = '', width = 'min(520px, 100vw)', ...props }: DetailDrawerProps) {
  return <Drawer rootClassName={`${styles.drawer} ${rootClassName}`.trim()} width={width} title={<div className={styles.heading}><strong>{title}</strong>{subtitle ? <span>{subtitle}</span> : null}</div>} {...props}>{children}</Drawer>;
}
