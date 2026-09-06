import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import styles from './AuthCard.module.css';

interface AuthCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function AuthCard({ title, description, icon, children, backTo = '/login', backLabel = 'Login sahifasiga qaytish' }: AuthCardProps) {
  return <main className={styles.page}><Card className={styles.card}>{backTo ? <Link className={styles.back} to={backTo}><ArrowLeft size={16} /> {backLabel}</Link> : null}<div className={styles.icon}>{icon}</div><Typography.Title level={2}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text><div className={styles.content}>{children}</div></Card></main>;
}
