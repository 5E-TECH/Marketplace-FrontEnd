import { App, Drawer } from 'antd';
import { History, UserPlus } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { isUserRole } from '../../features/auth/model/authTypes';
import { useAccountsQuery, useStaffQuery, useTeamsQuery, useUserAccountQuery } from '../../features/staff/api/staffQueries';
import { displayName } from '../../features/staff/lib/staffFormat';
import { roleInfo } from '../../features/staff/model/roleCatalog';
import { STAFF_ROLES, type CreateStaffResult, type UserAccount } from '../../features/staff/model/staffTypes';
import { AddOperatorDialog } from '../../features/staff/ui/AddOperatorDialog';
import { ImpersonateDialog } from '../../features/staff/ui/ImpersonateDialog';
import { StaffDialogs, type StaffDialogState } from '../../features/staff/ui/StaffDialogs';
import { TemporaryPasswordDialog } from '../../features/staff/ui/TemporaryPasswordDialog';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock } from '../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { usePageBack, usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { NewStaffPanel } from './components/NewStaffPanel';
import { OperatorsTab } from './components/OperatorsTab';
import { RolePanel } from './components/RolePanel';
import { RolesTab } from './components/RolesTab';
import { SellersSectionLink, SellersTab } from './components/SellersTab';
import { StaffCard, type CardVariant } from './components/StaffCard';
import { StaffTab } from './components/StaffTab';
import { WholesalerAccountsTab, WholesalersSectionLink } from './components/WholesalerAccountsTab';
import { roleStats } from './model/roleStats';
import { AUDIT_PATH, ROLES_PATH } from './model/rolesLinks';
import { parseUsersTab, type UsersTab } from './model/staffList';
import styles from './AdminUsersPage.module.css';

const STAFF_FILTER = { roles: STAFF_ROLES, includeUnknown: true } as const;
const COUNT_PAGE = { page: 1, limit: 1 } as const;

/**
 * «Foydalanuvchilar» (FE-15, admin va superadmin; admin-foydalanuvchilar, admin-foydalanuvchi-karta): yorliqlar —
 * «Xodimlar» (sukut), «Sotuvchilar», «Optoviklar», «Operatorlar jamoasi», «Rollar va ruxsatlar». Xodim kartasi
 * (`/admin/users/:userId`) va «Yangi xodim» (`/admin/users/new`): desktopda ro'yxat yonida panel, planshetda drawer,
 * telefonda ichki sahifa («‹» — ro'yxat).
 */
export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const narrow = useMediaQuery('(max-width: 1023.98px)');
  const tablet = narrow && !phone;
  const auth = useAppSelector(selectAuthUser);
  const navigate = useNavigate();
  const { search } = useLocation();
  const { userId } = useParams<{ userId?: string }>();
  const isNew = Boolean(useMatch('/admin/users/new'));
  const [params, setParams] = useSearchParams();
  const tab = parseUsersTab(params.get('tab'));
  const staff = useStaffQuery(STAFF_FILTER);
  const affiliates = useAccountsQuery({ role: 'AFFILIATE', ...COUNT_PAGE });
  const wholesalers = useAccountsQuery({ role: 'WHOLESALER', ...COUNT_PAGE });
  const [dialog, setDialog] = useState<StaffDialogState | null>(null);
  const [created, setCreated] = useState<{ name: string; code: string; password: string } | null>(null);
  const [impersonate, setImpersonate] = useState<{ id: string; name: string } | null>(null);
  // «Operator qo‘shish» (Operatorlar jamoasi): qaysi jamoaga — sukut bo'yicha birinchi jamoa.
  const [addOperator, setAddOperator] = useState<{ teamId: string | null } | null>(null);
  const teams = useTeamsQuery(tab === 'teams' || addOperator !== null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  // Planshet va telefonda yorliqlar qatori suriladi — tanlangan yorliq ko'rinib tursin (admin-rollar.planshet).
  useEffect(() => {
    if (narrow) selectedTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [narrow, tab]);
  const viewer = { id: auth?.id ?? '', role: auth?.role ?? 'ADMIN' };

  const panelOpen = isNew || Boolean(userId);
  const initial = userId ? staff.data?.find((item) => item.id === userId) : undefined;
  // «Rollar va ruxsatlar»: tanlangan rol (`?tab=roles&role=SUPERVISOR`) — desktop/planshetda o'ngda panel, telefonda
  // ichki sahifa («‹ Rollar va ruxsatlar»).
  const roleParam = params.get('role');
  const selectedRole = tab === 'roles' && isUserRole(roleParam) ? roleParam : null;
  const rolePage = phone && selectedRole !== null && !panelOpen;
  // Telefonda yuqori qatorda — xodim ismi (yoki «Yangi xodim») va «‹ Foydalanuvchilar»; desktop/planshetda karta
  // ro'yxat yonida — «orqaga» havolasi yo'q.
  const card = useUserAccountQuery(phone && userId ? userId : undefined, initial);
  usePageTitle(rolePage ? t(roleInfo(selectedRole).label) : phone && panelOpen ? (isNew ? t('staff.form.title') : card.data ? displayName(card.data) : null) : null);
  usePageBack(rolePage ? { path: ROLES_PATH, label: t('staff.tab.roles') } : phone ? null : 'none');
  // Telefonda ichki sahifa (rol sahifasi, xodim kartasi) shu komponentda ochiladi — ro'yxatdagi joydan emas, tepadan.
  const innerPage = rolePage ? `role:${selectedRole}` : phone && panelOpen ? `card:${userId ?? 'new'}` : null;
  useEffect(() => {
    if (innerPage) window.scrollTo(0, 0);
  }, [innerPage]);
  const stats = useMemo(
    () => roleStats(staff.data, { AFFILIATE: affiliates.data?.total, WHOLESALER: wholesalers.data?.total }),
    [staff.data, affiliates.data?.total, wholesalers.data?.total],
  );

  const all = staff.data ?? [];
  const lastSuperadmin = all.filter((item) => item.role === 'SUPERADMIN' && !item.isBlocked).length === 1;
  const operators = all.filter((item) => item.role === 'OPERATOR_LEAD').length;
  const tabs: [UsersTab, string, number | undefined][] = [
    ['staff', t('staff.tab.staff'), staff.data?.length],
    ['affiliates', t('staff.tab.affiliates'), affiliates.data?.total],
    ['wholesalers', t('staff.tab.wholesalers'), wholesalers.data?.total],
    ['teams', t('staff.tab.teams'), staff.data ? operators : undefined],
    ['roles', t('staff.tab.roles'), undefined],
  ];
  const goTab = (key: UsersTab) => setParams(key === 'staff' ? {} : { tab: key }, { replace: true });
  const openRole = (role: string) => setParams({ tab: 'roles', role });
  const closeRole = () => setParams({ tab: 'roles' });
  const openCard = (user: UserAccount) => void navigate({ pathname: `/admin/users/${encodeURIComponent(user.id)}`, search });
  const close = () => void navigate({ pathname: '/admin/users', search });

  const onCreated = (result: CreateStaffResult) => {
    const name = displayName(result.user);
    const shown = !result.smsSent && result.temporaryPassword;
    notification.success({
      title: t('staff.toast.created', { name }),
      description: t(shown ? 'staff.toast.createdShown' : 'staff.toast.createdSms', { time: tashkentClock() }),
      placement: phone ? 'top' : 'bottomRight',
      duration: 5,
    });
    if (shown && result.temporaryPassword) setCreated({ name, code: result.user.code, password: result.temporaryPassword });
    void navigate({ pathname: `/admin/users/${encodeURIComponent(result.user.id)}`, search });
  };

  const variant: CardVariant = phone ? 'page' : tablet ? 'drawer' : 'panel';
  const panel = isNew
    ? <NewStaffPanel viewerRole={viewer.role} variant={variant} onClose={close} onCreated={onCreated} />
    : userId ? <StaffCard key={userId} userId={userId} initial={initial} viewer={viewer} variant={variant} onClose={phone ? undefined : close} onDialog={setDialog} /> : null;

  const overlays = (
    <>
      <StaffDialogs state={dialog} viewer={viewer} lastSuperadmin={lastSuperadmin} onClose={() => setDialog(null)} />
      {created ? <TemporaryPasswordDialog name={created.name} code={created.code} password={created.password} noSms onClose={() => setCreated(null)} /> : null}
      {addOperator ? (
        <AddOperatorDialog teams={teams.data ?? []} defaultTeamId={addOperator.teamId} onClose={() => setAddOperator(null)} onPassword={(value) => setCreated(value)} />
      ) : null}
      {impersonate ? (
        <ImpersonateDialog userId={impersonate.id} name={impersonate.name} returnTo={`/admin/users${search}`} onClose={() => setImpersonate(null)} />
      ) : null}
    </>
  );

  if (rolePage) {
    return (
      <div className={styles.page} data-testid="admin-users" data-layout="phone">
        <RolePanel role={selectedRole} stat={stats[selectedRole]} viewerId={viewer.id} variant="page" />
      </div>
    );
  }

  if (phone && panelOpen) {
    return (
      <div className={styles.page} data-testid="admin-users" data-layout="phone">
        {panel}
        {overlays}
      </div>
    );
  }

  const staffTab = (compact: boolean) => (
    <StaffTab query={staff} viewer={viewer} phone={phone} compact={compact} selectedId={userId} onOpen={openCard} onDialog={setDialog} />
  );

  return (
    <div className={styles.page} data-testid="admin-users" data-layout={phone ? 'phone' : undefined}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={t('staff.tabs.aria')}>
          {tabs.map(([key, label, count], index) => (
            <Fragment key={key}>
              {/* Hisoblar (xodim, sotuvchi, optovik) va jamoa/rollar orasida ajratgich. */}
              {index === 3 ? <span className={styles.divider} aria-hidden /> : null}
              <button type="button" role="tab" ref={tab === key ? selectedTabRef : undefined} className={styles.tab} aria-selected={tab === key} data-count={count === undefined ? undefined : true} onClick={() => goTab(key)}>
                {label}
                {count === undefined ? null : <span className={styles.count}>{count}</span>}
              </button>
            </Fragment>
          ))}
        </div>
        {phone ? null : tab === 'staff' ? (
          <div className={styles.actions}>
            <Link to={{ pathname: '/admin/users/new', search }} className={styles.primaryAction}><UserPlus aria-hidden />{t('staff.add')}</Link>
          </div>
        ) : tab === 'affiliates' ? <div className={styles.actions}><SellersSectionLink /></div>
          : tab === 'wholesalers' ? <div className={styles.actions}><WholesalersSectionLink /></div>
            : tab === 'roles' && !narrow ? <div className={styles.actions}><Link to={AUDIT_PATH} className={styles.sectionLink}>{t('staff.roles.audit')}<History aria-hidden /></Link></div>
              : tab === 'teams' ? (
                <div className={styles.actions}>
                  <button type="button" className={styles.primaryAction} onClick={() => setAddOperator({ teamId: teams.data?.[0]?.id ?? null })}><UserPlus aria-hidden />{t('staff.ops.add')}</button>
                </div>
              ) : null}
      </div>

      {tab === 'affiliates' ? (
        <SellersTab viewer={viewer} phone={phone} onDialog={setDialog} onImpersonate={(user) => setImpersonate({ id: user.id, name: displayName(user) })} />
      ) : tab === 'wholesalers' ? <WholesalerAccountsTab viewer={viewer} phone={phone} onImpersonate={setImpersonate} />
        : tab === 'roles' ? (
          <RolesTab
            layout={phone ? 'phone' : narrow ? 'tablet' : 'desktop'}
            stats={stats}
            unknown={staff.data?.filter((item) => item.role === null) ?? []}
            staffCount={staff.data?.length ?? null}
            updatedAt={staff.dataUpdatedAt}
            viewerId={viewer.id}
            selected={selectedRole}
            onSelect={openRole}
          />
        )
        : tab === 'teams' ? (
          <OperatorsTab
            layout={phone ? 'phone' : narrow ? 'tablet' : 'desktop'}
            staff={staff.data}
            staffError={staff.isError ? staff.error : null}
            onRetry={() => void staff.refetch()}
            onDialog={setDialog}
            onOpenCard={(user) => void navigate(`/admin/users/${encodeURIComponent(user.id)}`)}
            onAdd={(teamId) => setAddOperator({ teamId })}
          />
        )
        : panelOpen && !narrow ? (
          <div className={styles.split}>
            <div className={styles.listColumn}>{staffTab(true)}</div>
            {panel}
          </div>
        ) : staffTab(false)}

      {selectedRole && !phone ? (
        <Drawer open onClose={closeRole} size="min(480px, 92vw)" closable={false} rootClassName={styles.drawer} aria-label={t(roleInfo(selectedRole).label)}>
          <RolePanel role={selectedRole} stat={stats[selectedRole]} viewerId={viewer.id} variant="drawer" onClose={closeRole} />
        </Drawer>
      ) : null}
      {tablet && panelOpen ? (
        <Drawer open onClose={close} size="min(440px, 86vw)" closable={false} rootClassName={styles.drawer} aria-label={t('staff.tab.staff')}>
          {panel}
        </Drawer>
      ) : null}
      {overlays}
    </div>
  );
}
