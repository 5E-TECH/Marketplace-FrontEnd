import { X } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findNavSection, getNavGroups, prefetchRoute } from '../../app/router/routeAccess';
import type { UserRole } from '../../features/auth/model/authTypes';
import { BRAND } from '../../shared/config/brand';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';
import styles from './AppShell.module.css';

const BRAND_ICON = '/brand/elchi-app-icon.png';

/** Brend qatori (karkas-E 1.2): ilova belgisi 32 px va nom. */
export function BrandRow({ children }: { children?: React.ReactNode }) {
  return (
    <div className={styles.brand}>
      <img className={styles.brandIcon} src={BRAND_ICON} alt="" width={32} height={32} />
      <span className={styles.brandName}>{BRAND.name}</span>
      {children}
    </div>
  );
}

/** Rol menyusi bandlari (1.3–1.4); admin'da guruh sarlavhalari bilan. */
function NavItems({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = findNavSection(pathname)?.path;
  return (
    <div className={styles.menu}>
      {getNavGroups(role).map((group, index) => (
        <Fragment key={group.label ?? index}>
          {group.label ? <p className={styles.groupLabel}>{t(group.label)}</p> : null}
          <ul className={styles.items}>
            {group.routes.map((route) => (
              <li key={route.path}>
                <Link
                  to={route.path}
                  className={styles.item}
                  aria-current={route.path === active ? 'page' : undefined}
                  onPointerEnter={() => prefetchRoute(route.path)}
                  onFocus={() => prefetchRoute(route.path)}
                  onClick={onNavigate}
                >
                  {route.navIcon}
                  <span>{t(route.label)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </div>
  );
}

/** Desktop menyusi: 260 px navy ustun. */
export function SideNav({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  return (
    <nav className={styles.nav} aria-label={t('shell.mainMenu')}>
      <BrandRow />
      <NavItems role={role} />
    </nav>
  );
}

/** Planshet va telefon chap paneli (4.3): yopish ×, bandlar, pastda til. */
export function DrawerNav({ role, onClose }: { role: UserRole; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className={styles.drawerNav} aria-label={t('shell.mainMenu')}>
      <BrandRow>
        <button type="button" className={styles.drawerClose} aria-label={t('shell.closeMenu')} onClick={onClose}>
          <X aria-hidden />
        </button>
      </BrandRow>
      <NavItems role={role} onNavigate={onClose} />
      <div className={styles.drawerLanguage}>
        <span className={styles.drawerLanguageLabel}>{t('shell.language')}</span>
        <LanguageSwitcher variant="full" />
      </div>
    </nav>
  );
}

/** Omborchi relsi (5.5): 96 px, band 64 px, ikonka 22 va qisqa yorliq. */
export function WarehouseRail({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = findNavSection(pathname)?.path;
  const routes = getNavGroups(role).flatMap(({ routes: groupRoutes }) => groupRoutes);
  return (
    <nav className={styles.rail} aria-label={t('shell.mainMenu')}>
      <div className={styles.railBrand}>
        <img className={styles.brandIcon} src={BRAND_ICON} alt={BRAND.name} width={32} height={32} />
      </div>
      <ul className={styles.railItems}>
        {routes.map((route) => (
          <li key={route.path}>
            <Link
              to={route.path}
              className={styles.railItem}
              aria-current={route.path === active ? 'page' : undefined}
              aria-label={t(route.label)}
              onPointerEnter={() => prefetchRoute(route.path)}
            >
              {route.navIcon}
              <span aria-hidden>{t(route.railLabel ?? route.label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
