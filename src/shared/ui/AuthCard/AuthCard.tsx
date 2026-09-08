import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import styles from './AuthCard.module.css';
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher';
import { useTranslation } from '../../i18n/useTranslation';

interface AuthCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function AuthCard({ title, description, icon, children, backTo = '/login', backLabel }: AuthCardProps) {
  const { t } = useTranslation();
  return <main className={styles.page}><div className={styles.language}><LanguageSwitcher /></div><Card className={styles.card}>{backTo ? <Link className={styles.back} to={backTo}><ArrowLeft size={16} /> {backLabel ?? t('auth.backDefault')}</Link> : null}<div className={styles.icon}>{icon}</div><Typography.Title level={2}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text><div className={styles.content}>{children}</div></Card></main>;
}
