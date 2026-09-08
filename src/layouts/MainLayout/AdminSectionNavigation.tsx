import { useLocation, useNavigate } from 'react-router-dom';
import { adminNavigation } from '../../features/adminDashboard/model/adminNavigation';
import { useTranslation } from '../../shared/i18n/useTranslation';
import styles from './AdminSectionNavigation.module.css';

export function AdminSectionNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const group = adminNavigation.find(({ items }) => items.some(({ path }) => pathname === path || pathname.startsWith(`${path}/`)));
  if (!group || group.items.length < 2) return null;
  return <nav className={styles.navigation} aria-label={t('adminNav.sections', { name: t(group.label) })}><div className={styles.scroller}>{group.items.map((item) => { const active = pathname === item.path || pathname.startsWith(`${item.path}/`); return <button key={item.path} type="button" className={active ? styles.active : undefined} aria-current={active ? 'page' : undefined} onClick={() => void navigate(item.path)}>{t(item.label)}</button>; })}</div></nav>;
}
