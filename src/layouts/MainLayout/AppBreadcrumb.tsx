import { Breadcrumb } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { findRouteMeta } from '../../app/router/appRouteConfig';
import styles from './MainLayout.module.css';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { adminNavigation } from '../../features/adminDashboard/model/adminNavigation';

export function AppBreadcrumb() {
  const { pathname } = useLocation();
  const currentRoute = findRouteMeta(pathname);
  const { t } = useTranslation();
  const adminGroup = pathname.startsWith('/admin/')
    ? adminNavigation.find(({ items: groupItems }) =>
        groupItems.some(({ path }) => pathname === path || pathname.startsWith(`${path}/`)),
      )
    : undefined;
  const adminItem = adminGroup?.items.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const items = adminGroup && adminItem
    ? adminGroup.items.length === 1
      ? [{ title: adminGroup.label }]
      : [
          { title: <Link to={adminGroup.items[0].path}>{adminGroup.label}</Link> },
          { title: adminItem.label },
        ]
    : !currentRoute || currentRoute.path === '/'
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
