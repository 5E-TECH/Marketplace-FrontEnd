import { shortPersonName } from '../../shared/lib/personName';
import { App, Drawer } from 'antd';
import { MonitorSmartphone, RefreshCw } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { findNavSection, findRoute, getRoleShell } from '../../app/router/routeAccess';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { ROLE_LABEL_KEYS } from '../../features/auth/lib/roleLabels';
import { UnknownRoleError } from '../../features/auth/lib/unknownRoleError';
import { selectAuthUser, selectSessionExpired } from '../../features/auth/model/authSlice';
import { SessionExpiredDialog } from '../../features/auth/ui/SessionExpiredDialog/SessionExpiredDialog';
import { NotificationBell } from '../../features/notifications/ui/NotificationBell/NotificationBell';
import { OperatorBookingsClock, OperatorStateSwitch } from '../../features/operator/ui/OperatorStatusBar';
import { ConnectionBanner } from '../../shared/ui/ConnectionBanner/ConnectionBanner';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../shared/lib/phone';
import { PageHeaderSlotContext, PageStatusContext, PageTitleContext, type PageStatus } from '../../shared/ui/PageHeader/pageTitle';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { DrawerNav, SideNav, WarehouseRail } from './NavMenu';
import { TopBar, UserMenu, type ShellLayout } from './TopBar';
import { UnknownRoleShell } from './UnknownRoleShell';
import { useShellLayout } from './useShellLayout';
import styles from './AppShell.module.css';

const LAYOUT_CLASS: Record<ShellLayout, string | undefined> = {
  desktop: undefined,
  // Omborchi relsi bilan yuqori qator planshetdagidek: tugmalar 44 px.
  rail: styles.tablet,
  tablet: styles.tablet,
  phone: styles.phone,
};

/** Operator «Ish joyi» telefonda ochilmaydi (karkas-E 4.7, operator-karkas.mobil). */
function DesktopOnlyNotice() {
  const { t } = useTranslation();
  return (
    <section className={styles.desktopOnly} data-testid="desktop-only">
      <span className={styles.desktopOnlyIcon} aria-hidden><MonitorSmartphone /></span>
      <h2>{t('shell.desktopOnlyTitle')}</h2>
      <p>{t('shell.desktopOnlyText')}</p>
    </section>
  );
}

/**
 * Barcha rollar uchun yagona panel karkasi (FE-01, docs/dizayn/karkas-E.md).
 * Rolga qarab faqat menyu bandlari va `roleShells` ko'rinishi farq qiladi.
 * Sahifa nomi faqat yuqori qatordagi `h1` da — sahifa uni `usePageTitle` orqali beradi.
 */
export default function AppShell() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAppSelector(selectAuthUser);
  const sessionExpired = useAppSelector(selectSessionExpired);
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();
  const shell = user ? getRoleShell(user.role) : null;
  const layout = useShellLayout(shell?.variant);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  // Panel qaysi manzilda ochilgan bo'lsa, faqat o'sha yerda ochiq: boshqa sahifaga o'tganda o'zi yopiladi.
  const [drawerPath, setDrawerPath] = useState<string | null>(null);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onError: () => void message.warning(t('auth.localSessionCleared')),
    });
  };

  if (currentUserQuery.error instanceof UnknownRoleError) {
    return (
      <UnknownRoleShell
        error={currentUserQuery.error}
        checkedAt={currentUserQuery.errorUpdatedAt}
        onRecheck={() => void currentUserQuery.refetch()}
        onLogout={handleLogout}
      />
    );
  }

  if (!user || !shell) return <PageLoader />;

  const route = findRoute(pathname);
  const section = route?.section ? findNavSection(pathname) : undefined;
  const back = section ? { path: section.path, label: t(section.label) } : undefined;
  const title = pageTitle ?? (route ? t(route.label) : '');
  const usesDrawer = layout === 'tablet' || layout === 'phone';
  const touch = layout !== 'desktop';
  const closeDrawer = () => setDrawerPath(null);

  return (
    <div
      className={`${styles.shell} ${LAYOUT_CLASS[layout] ?? ''}`.trim()}
      data-testid={shell.area === 'admin' ? 'admin-layout' : 'app-layout'}
      data-shell={shell.variant}
      data-layout={layout}
    >
      {layout === 'desktop' ? <SideNav role={user.role} /> : null}
      {layout === 'rail' ? <WarehouseRail role={user.role} /> : null}
      {usesDrawer ? (
        <Drawer
          placement="left"
          size="min(296px, 86%)"
          open={drawerPath === pathname}
          onClose={closeDrawer}
          closable={false}
          rootClassName={styles.drawerRoot}
        >
          <DrawerNav role={user.role} onClose={closeDrawer} />
        </Drawer>
      ) : null}

      <div className={styles.column}>
        <TopBar
          layout={layout}
          title={title}
          back={back}
          onMenuOpen={usesDrawer ? () => setDrawerPath(pathname) : undefined}
          afterTitle={user.role === 'OPERATOR_LEAD' ? <OperatorStateSwitch /> : (
            <>
              {/* Sahifa boshqaruvi (desktop): «Davr:» pilli va hokazo — `usePageHeaderSlot`. */}
              {layout === 'desktop' ? <span ref={setHeaderSlot} className={styles.headerSlot} /> : null}
              {pageStatus ? <PageStatusLine status={pageStatus} /> : null}
            </>
          )}
          beforeTools={user.role === 'OPERATOR_LEAD' ? <OperatorBookingsClock /> : undefined}
          bell={
            <NotificationBell
              role={user.role}
              onNavigate={(path) => void navigate(path)}
              badgeClassName={styles.bellBadge}
              buttonClassName={styles.bellButton}
            />
          }
          user={
            <UserMenu
              // Yangi sotuvchida ism yo'q (ro'yxat faqat telefon bilan, FE-04) — Profilda kiritadi.
              name={user.name.trim() && user.role !== 'WHOLESALER' ? shortPersonName(user.name) : user.name.trim() || formatUzPhone(user.phone)}
              roleLabel={t(ROLE_LABEL_KEYS[user.role])}
              touch={touch}
              profilePath={shell.profilePath}
              onLogout={handleLogout}
            />
          }
        />
        <ConnectionBanner />
        {sessionExpired ? <SessionExpiredDialog panelName={title} /> : null}
        <main className={styles.main} data-app-main>
          <PageTitleContext value={setPageTitle}>
            <PageStatusContext value={setPageStatus}>
              <PageHeaderSlotContext value={layout === 'desktop' ? headerSlot : null}>
                {shell.variant === 'workspace' && layout === 'phone' && pathname === shell.home ? <DesktopOnlyNotice /> : null}
                {/* Telefonda yuqori qator 56 px — sahifa holati mazmun tepasida. */}
                {layout === 'phone' && pageStatus ? <PageStatusLine status={pageStatus} /> : null}
                <Suspense fallback={<PageLoader compact />}>
                  <Outlet />
                </Suspense>
              </PageHeaderSlotContext>
            </PageStatusContext>
          </PageTitleContext>
        </main>
      </div>
    </div>
  );
}

/** «Statistika har soatda yangilanadi · 14:00» (sotuvchi-bosh yuqori qatori). */
function PageStatusLine({ status }: { status: PageStatus }) {
  return (
    <span className={styles.pageStatus} role="status">
      <RefreshCw size={14} aria-hidden />
      {status.label} · <strong>{status.value}</strong>
    </span>
  );
}
