import { Breadcrumb } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { findRouteMeta } from '../../app/router/appRouteConfig';
import styles from './MainLayout.module.css';

export function AppBreadcrumb() {
  const { pathname } = useLocation();
  const currentRoute = findRouteMeta(pathname);

  const items =
    !currentRoute || currentRoute.path === '/'
      ? [{ title: 'Bosh sahifa' }]
      : [
          { title: <Link to="/">Bosh sahifa</Link> },
          { title: currentRoute.label },
        ];

  return (
    <Breadcrumb
      aria-label="Breadcrumb"
      className={styles.breadcrumb}
      items={items}
    />
  );
}
