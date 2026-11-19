import { shortPersonName } from '../../shared/lib/personName';
import { Button } from 'antd';
import { Lock, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { getRoleHome } from '../../app/router/routeAccess';
import type { AppRoute } from '../../app/router/routeManifest';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { ROLE_LABEL_KEYS } from '../../features/auth/lib/roleLabels';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { StatusPanel, StatusPanelChip } from '../../shared/ui/StatusPanel/StatusPanel';

/**
 * 403 — boshqa rolning sahifasi (umumiy-403, FE-01 TC2). Yo'naltirish emas:
 * foydalanuvchi o'z karkasida qoladi va nima uchun ochilmaganini ko'radi.
 */
export function ForbiddenPage({ route }: { route: AppRoute }) {
  const { locale, t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const logoutMutation = useLogoutMutation();
  usePageTitle(t('forbidden.title'));

  if (!user) return null;
  const roleName = t(ROLE_LABEL_KEYS[user.role]);
  const lower = (value: string) => value.toLocaleLowerCase(locale);
  const allowed = route.roles.map((role) => lower(t(ROLE_LABEL_KEYS[role])));
  const roles = allowed.length > 1
    ? `${allowed.slice(0, -1).join(', ')} ${t('forbidden.and')} ${allowed.at(-1)}`
    : allowed[0] ?? '';

  return (
    <StatusPanel
      testId="forbidden-page"
      icon={<Lock />}
      code={t('forbidden.code')}
      heading={t('forbidden.heading', { role: lower(roleName) })}
      text={t('forbidden.text', { section: t(route.label), roles, role: lower(roleName) })}
      actions={<>
        <Button type="primary" onClick={() => void navigate(getRoleHome(user.role), { replace: true })}>
          {t('forbidden.home')}
        </Button>
        <Button type="text" icon={<LogOut size={18} aria-hidden />} onClick={() => logoutMutation.mutate()}>
          {t('forbidden.switchAccount')}
        </Button>
      </>}
      aside={{
        title: t('attempt.title'),
        rows: [
          { label: t('attempt.address'), value: <StatusPanelChip>{pathname}</StatusPanelChip> },
          { label: t('attempt.account'), value: shortPersonName(user.name) },
          { label: t('attempt.role'), value: roleName },
          { label: t('attempt.time'), value: formatDateTime(new Date().toISOString(), locale) },
        ],
      }}
    />
  );
}
