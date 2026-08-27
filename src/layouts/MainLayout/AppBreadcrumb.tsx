import { Breadcrumb } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { findRouteMeta } from '../../app/router/appRouteConfig';
import styles from './MainLayout.module.css';
import { useTranslation } from '../../shared/i18n/useTranslation';

export function AppBreadcrumb() {
  const { pathname } = useLocation();
  const currentRoute = findRouteMeta(pathname);
  const { t } = useTranslation();

  const items =
    !currentRoute || currentRoute.path === '/'
      ? [{ title: t('nav.home') }]
      : [
          { title: <Link to="/">{t('nav.home')}</Link> },
          { title: t(currentRoute.label) },
        ];

  return (
    <Breadcrumb
      aria-label="Breadcrumb"
      className={styles.breadcrumb}
      items={items}
    />
  );
}
